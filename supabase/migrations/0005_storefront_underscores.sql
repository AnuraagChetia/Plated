-- Allow underscores in restaurant addresses during onboarding.
create or replace function public.launch_restaurant(restaurant_name text, restaurant_slug text,
  restaurant_description text, restaurant_theme text, dish_name text, dish_price integer)
returns public.restaurants language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid();
  result public.restaurants;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if restaurant_name is null or length(btrim(restaurant_name)) not between 1 and 100
    or restaurant_slug is null or length(restaurant_slug) not between 1 and 80 or restaurant_slug !~ '^[a-z0-9]+([-_][a-z0-9]+)*$'
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
