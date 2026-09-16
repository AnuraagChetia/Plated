-- Checkout metadata and capability tokens. Guest access only through the functions below.
alter table public.restaurants
  add column pickup_address text not null default '',
  add column contact_phone text not null default '',
  add column accepts_pickup boolean not null default true,
  add column accepts_delivery boolean not null default false,
  add column accepting_orders boolean not null default true,
  add column estimated_minutes integer not null default 30 check (estimated_minutes between 5 and 180);
alter table public.orders
  add column customer_phone text,
  add column fulfillment text check (fulfillment in ('PICKUP','DELIVERY')),
  add column delivery_address text,
  add column notes text,
  add column client_request_id uuid,
  add column request_payload jsonb,
  add column tracking_token uuid not null default gen_random_uuid(),
  add column updated_at timestamptz not null default now();
create unique index orders_request_key on public.orders(restaurant_id, client_request_id);
create index orders_contact_rate on public.orders(restaurant_id, customer_phone, created_at);

-- Retain the validated price calculator internally, but remove the old guest entry point.
revoke execute on function public.place_order(text, text, jsonb) from anon, authenticated;

create function public.checkout_order(restaurant_slug text, diner_name text, cart jsonb, checkout jsonb, request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.restaurants;
  existing public.orders;
  new_id uuid;
  phone text;
  mode text;
  address text;
  payload jsonb;
begin
  if request_key is null or jsonb_typeof(checkout) is distinct from 'object' then
    raise exception 'Invalid checkout' using errcode = '22023';
  end if;
  phone := regexp_replace(coalesce(checkout->>'phone',''), '[^0-9]', '', 'g');
  mode := checkout->>'fulfillment';
  address := btrim(coalesce(checkout->>'address',''));
  if phone !~ '^[0-9]{7,15}$' or mode is null or mode not in ('PICKUP','DELIVERY')
    or (mode = 'DELIVERY' and length(address) not between 10 and 500)
    or length(address) > 500 or length(coalesce(checkout->>'notes','')) > 500 then
    raise exception 'Invalid contact or fulfillment details' using errcode = '22023';
  end if;
  select * into r from public.restaurants where slug = restaurant_slug;
  if not found then raise exception 'Restaurant unavailable' using errcode = '22023'; end if;
  payload := jsonb_build_object('name', btrim(diner_name), 'cart', cart, 'checkout', checkout);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.id::text || request_key::text, 0));
  select * into existing from public.orders where restaurant_id = r.id and client_request_id = request_key;
  if found then
    if existing.request_payload is distinct from payload then
      raise exception 'This request key was already used for a different order' using errcode = '22000';
    end if;
    return jsonb_build_object('id', existing.id, 'token', existing.tracking_token);
  end if;
  if not r.is_published or not r.accepting_orders or
    (mode = 'PICKUP' and (not r.accepts_pickup or length(btrim(r.pickup_address)) = 0)) or
    (mode = 'DELIVERY' and not r.accepts_delivery) then
    raise exception 'This fulfillment option is unavailable' using errcode = '22023';
  end if;
  -- Shared database limit; retries above do not consume another order allowance.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(r.id::text || phone, 1));
  if (select count(*) from public.orders where restaurant_id = r.id and customer_phone = phone
      and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many orders for this contact. Try again in ten minutes.' using errcode = 'P0429';
  end if;
  new_id := public.place_order(restaurant_slug, diner_name, cart);
  update public.orders set customer_phone = phone, fulfillment = mode,
    delivery_address = case when mode = 'DELIVERY' then address else null end,
    notes = nullif(btrim(checkout->>'notes'), ''), client_request_id = request_key, request_payload = payload
    where id = new_id returning * into existing;
  return jsonb_build_object('id', existing.id, 'token', existing.tracking_token);
end;
$$;
revoke all on function public.checkout_order(text,text,jsonb,jsonb,uuid) from public;
grant execute on function public.checkout_order(text,text,jsonb,jsonb,uuid) to anon, authenticated;

create function public.validate_order_status() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'NEW' and new.status in ('PREPARING','CANCELLED')) or
    (old.status = 'PREPARING' and new.status in ('READY','CANCELLED')) or
    (old.status = 'READY' and new.status in ('COMPLETED','CANCELLED'))
  ) then raise exception 'Invalid order status transition' using errcode = '22023'; end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger orders_status_transition before update on public.orders for each row execute function public.validate_order_status();

create function public.track_order(order_id_value uuid, access_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',o.id,'status',o.status,'total',o.total,'created_at',o.created_at,
    'fulfillment',o.fulfillment,'restaurant_name',r.name,'restaurant_slug',r.slug,
    'pickup_address',r.pickup_address,'contact_phone',r.contact_phone,'estimated_minutes',r.estimated_minutes,
    'items',(select coalesce(jsonb_agg(jsonb_build_object('name',i.name,'quantity',i.quantity,'unit_price',i.unit_price)),'[]'::jsonb)
      from public.order_items i where i.order_id = o.id),
    'review',(select jsonb_build_object('rating',v.restaurant_rating,'comment',v.comment,'owner_reply',v.owner_reply)
      from public.reviews v where v.order_id = o.id order by v.created_at desc limit 1))
  from public.orders o join public.restaurants r on r.id = o.restaurant_id
  where o.id = order_id_value and o.tracking_token = access_token;
$$;
revoke all on function public.track_order(uuid,uuid) from public;
grant execute on function public.track_order(uuid,uuid) to anon, authenticated;

-- Preserve existing review data; serialize submissions to guarantee one new review per order.
drop policy "Owners manage restaurant reviews" on public.reviews;
create policy "Owners read their reviews" on public.reviews for select to authenticated
  using (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())));
create policy "Owners reply to reviews" on public.reviews for update to authenticated
  using (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())))
  with check (exists(select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())));
revoke insert, update, delete on public.reviews from anon, authenticated;
grant update(owner_reply) on public.reviews to authenticated;
alter table public.reviews add constraint reviews_reply_length check (length(owner_reply) <= 1000) not valid;
create index reviews_restaurant_created on public.reviews(restaurant_id,created_at desc);

create function public.submit_review(order_id_value uuid, access_token uuid, score integer, feedback text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.orders; result uuid;
begin
  if score is null or score not between 1 and 5 or length(coalesce(feedback,'')) > 2000 then
    raise exception 'Invalid review' using errcode = '22023'; end if;
  select * into o from public.orders where id = order_id_value and tracking_token = access_token for update;
  if not found or o.status <> 'COMPLETED' then raise exception 'Completed order required' using errcode = '42501'; end if;
  select id into result from public.reviews where order_id = o.id order by created_at limit 1;
  if found then return result; end if;
  insert into public.reviews(restaurant_id,order_id,customer_name,restaurant_rating,comment)
    values(o.restaurant_id,o.id,o.customer_name,score,nullif(btrim(feedback),'')) returning id into result;
  return result;
end;
$$;
revoke all on function public.submit_review(uuid,uuid,integer,text) from public;
grant execute on function public.submit_review(uuid,uuid,integer,text) to anon, authenticated;

-- Small images live in the existing database, with no storage service credentials.
alter table public.media_assets
  add column content_base64 text check (length(content_base64) <= 2796204),
  add column mime_type text check (mime_type in ('image/jpeg','image/png','image/webp')),
  add column menu_item_id uuid references public.menu_items(id) on delete set null;
create index media_restaurant_created on public.media_assets(restaurant_id,created_at desc);
create function public.validate_media_asset() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.menu_item_id is not null and not exists(select 1 from public.menu_items where id = new.menu_item_id and restaurant_id = new.restaurant_id) then
    raise exception 'Dish belongs to another restaurant' using errcode = '22023'; end if;
  if tg_op = 'INSERT' then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.restaurant_id::text, 2));
    if (select count(*) from public.media_assets where restaurant_id = new.restaurant_id) >= 30 then
      raise exception 'Media library limit reached (30 images)' using errcode = '22023'; end if;
  end if;
  return new;
end;
$$;
create trigger media_asset_limits before insert or update on public.media_assets for each row execute function public.validate_media_asset();

create function public.dashboard_summary(restaurant_id_value uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'orders',count(*),'active',count(*) filter(where status in ('NEW','PREPARING','READY')),
    'completed_value',coalesce(sum(total) filter(where status = 'COMPLETED'),0),
    'reviews',(select count(*) from public.reviews where restaurant_id = restaurant_id_value),
    'rating',(select round(avg(restaurant_rating),1) from public.reviews where restaurant_id = restaurant_id_value)
  ) from public.orders where restaurant_id = restaurant_id_value
    and exists(select 1 from public.restaurants r where r.id = restaurant_id_value and r.owner_id = (select auth.uid()));
$$;
revoke all on function public.dashboard_summary(uuid) from public;
grant execute on function public.dashboard_summary(uuid) to authenticated;

create function public.setup_restaurant(restaurant_name text, restaurant_slug text, restaurant_description text,
  restaurant_theme text, dish_name text, dish_price integer, pickup_address_value text, phone_value text)
returns public.restaurants language plpgsql security definer set search_path = '' as $$
declare result public.restaurants;
begin
  if pickup_address_value is null or length(btrim(pickup_address_value)) not between 10 and 500
    or phone_value is null or regexp_replace(phone_value,'[^0-9]','','g') !~ '^[0-9]{7,15}$' then
    raise exception 'Pickup address and contact phone required' using errcode = '22023'; end if;
  result := public.launch_restaurant(restaurant_name,restaurant_slug,restaurant_description,restaurant_theme,dish_name,dish_price);
  update public.restaurants set pickup_address = btrim(pickup_address_value), contact_phone = btrim(phone_value)
    where id = result.id returning * into result;
  return result;
end;
$$;
revoke all on function public.setup_restaurant(text,text,text,text,text,integer,text,text) from public;
grant execute on function public.setup_restaurant(text,text,text,text,text,integer,text,text) to authenticated;
