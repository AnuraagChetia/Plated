-- Prices are whole Indian rupees, matching the existing menu schema.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name text not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 99)
);
create index order_items_order_id_idx on public.order_items(order_id);
create index orders_restaurant_created_idx on public.orders(restaurant_id, created_at desc);
create index menu_items_restaurant_idx on public.menu_items(restaurant_id);
create index restaurants_owner_idx on public.restaurants(owner_id);
alter table public.order_items enable row level security;
create policy "Owners read order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o join public.restaurants r on r.id = o.restaurant_id
    where o.id = order_id and r.owner_id = (select auth.uid())));

-- Guest writes must go through place_order so totals cannot be supplied by clients.
drop policy "Guests create orders" on public.orders;
revoke insert on public.orders from anon, authenticated;
revoke all on public.order_items from anon;
revoke insert, update, delete on public.order_items from authenticated;
grant select on public.order_items to authenticated;
revoke update on public.orders from authenticated;
grant update (status) on public.orders to authenticated;
create policy "Owners update order status" on public.orders for update to authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())));

create or replace function public.place_order(restaurant_slug text, diner_name text, cart jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  restaurant_id_value uuid;
  order_id_value uuid;
  total_value bigint;
  lines jsonb;
begin
  if diner_name is null or length(btrim(diner_name)) not between 1 and 100
    or cart is null or jsonb_typeof(cart) <> 'array' then
    raise exception 'Invalid order' using errcode = '22023';
  end if;
  if jsonb_array_length(cart) not between 1 and 50 then
    raise exception 'Invalid cart size' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(cart) x
    where jsonb_typeof(x) <> 'object' or coalesce(x->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(x->'quantity') is distinct from 'number'
    or coalesce(x->>'quantity', '') !~ '^[1-9][0-9]?$') then
    raise exception 'Invalid cart line' using errcode = '22023';
  end if;
  if (select count(distinct (x->>'id')::uuid) from jsonb_array_elements(cart) x) <> jsonb_array_length(cart) then
    raise exception 'Duplicate cart line' using errcode = '22023';
  end if;
  select id into restaurant_id_value from public.restaurants where slug = restaurant_slug and is_published;
  if restaurant_id_value is null then
    raise exception 'Restaurant unavailable' using errcode = '22023';
  end if;
  -- Capture prices and quantities together; the same snapshot drives both total and lines.
  select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'quantity', (x->>'quantity')::integer)),
    sum(m.price::bigint * (x->>'quantity')::integer)
  into lines, total_value
  from jsonb_array_elements(cart) x join public.menu_items m on m.id = (x->>'id')::uuid
  where m.restaurant_id = restaurant_id_value and m.is_available;
  if lines is null or jsonb_array_length(lines) <> jsonb_array_length(cart) or total_value > 2147483647 then
    raise exception 'Menu items unavailable' using errcode = '22023';
  end if;
  insert into public.orders(restaurant_id, customer_name, total, status)
    values (restaurant_id_value, btrim(diner_name), total_value::integer, 'NEW') returning id into order_id_value;
  insert into public.order_items(order_id, menu_item_id, name, unit_price, quantity)
    select order_id_value, (x->>'id')::uuid, x->>'name', (x->>'price')::integer, (x->>'quantity')::integer
    from jsonb_array_elements(lines) x;
  return order_id_value;
end;
$$;
revoke all on function public.place_order(text, text, jsonb) from public;
grant execute on function public.place_order(text, text, jsonb) to anon, authenticated;

-- Create the restaurant and its first dish in one transaction. Serialize retries per owner.
create or replace function public.launch_restaurant(restaurant_name text, restaurant_slug text,
  restaurant_description text, restaurant_theme text, dish_name text, dish_price integer)
returns public.restaurants language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
  result public.restaurants;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if restaurant_name is null or length(btrim(restaurant_name)) not between 1 and 100
    or restaurant_slug is null or length(restaurant_slug) not between 1 and 80 or restaurant_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or restaurant_description is null or length(btrim(restaurant_description)) not between 1 and 1000
    or restaurant_theme is null or restaurant_theme not in ('saffron', 'olive')
    or dish_name is null or length(btrim(dish_name)) not between 1 and 100
    or dish_price is null or dish_price not between 1 and 100000 then
    raise exception 'Invalid restaurant details' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 0));
  select * into result from public.restaurants where owner_id = owner order by created_at limit 1;
  if found then return result; end if;
  insert into public.restaurants(owner_id, name, slug, description, theme, is_published)
    values(owner, btrim(restaurant_name), restaurant_slug, btrim(restaurant_description), restaurant_theme, true)
    returning * into result;
  insert into public.menu_items(restaurant_id, name, price, category)
    values(result.id, btrim(dish_name), dish_price, 'Mains');
  return result;
end;
$$;
revoke all on function public.launch_restaurant(text, text, text, text, text, integer) from public;
grant execute on function public.launch_restaurant(text, text, text, text, text, integer) to authenticated;
