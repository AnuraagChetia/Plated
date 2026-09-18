-- Customer-owned profiles and addresses, private order history, and daily service hours.
create table public.customer_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),
 phone text not null default '' check(phone = '' or phone ~ '^[0-9]{7,15}$')
);
create table public.customer_addresses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 40),
 recipient text not null check(length(btrim(recipient)) between 1 and 100),
 phone text not null check(phone ~ '^[0-9]{7,15}$'),
 address text not null check(length(btrim(address)) between 10 and 500),
 created_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
revoke all on public.customer_profiles,public.customer_addresses from anon;
grant select,insert,update,delete on public.customer_profiles,public.customer_addresses to authenticated;
create policy profile_self on public.customer_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy address_self on public.customer_addresses for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create index customer_addresses_user on public.customer_addresses(user_id);
alter table public.orders add column customer_user_id uuid references auth.users(id) on delete set null;
create index orders_customer on public.orders(customer_user_id,created_at desc);
alter table public.restaurants add column opens_at time, add column closes_at time, add column timezone text not null default 'Asia/Kolkata';
alter table public.restaurants add constraint restaurant_hours_pair check((opens_at is null and closes_at is null) or (opens_at is not null and closes_at is not null and opens_at <> closes_at));
create function public.validate_restaurant_timezone() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone' using errcode='22023'; end if;
 return new;
end; $$;
create trigger restaurant_timezone before insert or update on public.restaurants for each row execute function public.validate_restaurant_timezone();
create function public.restaurant_is_open(r public.restaurants) returns boolean language sql stable set search_path='' as $$
 select r.accepting_orders and r.is_published and (r.opens_at is null or
 case when r.opens_at < r.closes_at then (current_timestamp at time zone r.timezone)::time >= r.opens_at and (current_timestamp at time zone r.timezone)::time < r.closes_at
 else (current_timestamp at time zone r.timezone)::time >= r.opens_at or (current_timestamp at time zone r.timezone)::time < r.closes_at end);
$$;
create or replace function public.checkout_order(restaurant_slug text, diner_name text, cart jsonb, checkout jsonb, request_key uuid)
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
  select * into r from public.restaurants where slug = restaurant_slug for share;
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
  if not r.accepting_orders or not r.is_published then
    raise exception 'The restaurant has stopped accepting new orders.' using errcode = 'P0409';
  end if;
  if not public.restaurant_is_open(r) then
    raise exception 'The restaurant is outside its opening hours.' using errcode = 'P0410';
  end if;
  if
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
  update public.orders set customer_user_id = auth.uid(), customer_phone = phone, fulfillment = mode,
    delivery_address = case when mode = 'DELIVERY' then address else null end,
    notes = nullif(btrim(checkout->>'notes'), ''), client_request_id = request_key, request_payload = payload
    where id = new_id returning * into existing;
  return jsonb_build_object('id', existing.id, 'token', existing.tracking_token);
end;
$$;
revoke all on function public.checkout_order(text,text,jsonb,jsonb,uuid) from public;
grant execute on function public.checkout_order(text,text,jsonb,jsonb,uuid) to anon, authenticated;

create function public.customer_order_history() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(recent)), '[]'::jsonb) from (
 select o.id,o.status,o.total,o.created_at,o.tracking_token,r.name as restaurant_name,r.slug as restaurant_slug
 from public.orders o join public.restaurants r on r.id=o.restaurant_id
 where o.customer_user_id=auth.uid() order by o.created_at desc limit 100
 ) recent;
$$;
revoke all on function public.customer_order_history() from public;
grant execute on function public.customer_order_history() to authenticated;
