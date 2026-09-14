create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text not null default '',
  theme text not null default 'saffron',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null, description text not null default '', price integer not null check (price >= 0),
  category text not null default 'Mains', rating numeric(2,1) not null default 0, rating_count integer not null default 0,
  is_available boolean not null default true, created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), restaurant_id uuid not null references public.restaurants(id),
  customer_name text not null, total integer not null check (total >= 0), status text not null default 'NEW', created_at timestamptz not null default now()
);
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
create policy "Owners manage their restaurants" on public.restaurants for all using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Public reads published restaurants" on public.restaurants for select using (is_published or (select auth.uid()) = owner_id);
create policy "Owners manage their menu" on public.menu_items for all using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid()))) with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())));
create policy "Public reads available menu" on public.menu_items for select using (is_available and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_published));
create policy "Owners read orders" on public.orders for select using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())));
create policy "Guests create orders" on public.orders for insert with check (true);
