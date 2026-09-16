-- Verification only: every data change below is rolled back.
begin;
do $$
declare
  owner_id_value uuid;
  r public.restaurants;
  dish_id uuid;
  request_id uuid := gen_random_uuid();
  receipt jsonb;
  retry jsonb;
  tracked jsonb;
  review_id uuid;
  test_slug text := 'plated-smoke-' || left(gen_random_uuid()::text,8);
begin
  select u.id into owner_id_value from auth.users u
    where not exists(select 1 from public.restaurants existing_restaurant where existing_restaurant.owner_id = u.id)
    order by u.created_at limit 1;
  if owner_id_value is null then raise exception 'This test needs an existing account without a restaurant.'; end if;
  perform set_config('request.jwt.claim.sub',owner_id_value::text,true);
  set local role authenticated;
  r := public.setup_restaurant('Plated transaction test',test_slug,'Rollback verification only','olive','Test dish',125,'123 Test Street, verification only','9999999999');
  select id into dish_id from public.menu_items where restaurant_id = r.id;
  if dish_id is null then raise exception 'Launch did not create a menu item'; end if;

  set local role anon;
  perform set_config('request.jwt.claim.sub','',true);
  receipt := public.checkout_order(test_slug,'Verification diner',jsonb_build_array(jsonb_build_object('id',dish_id,'quantity',2)),
    '{"phone":"9999999999","fulfillment":"PICKUP","address":"","notes":"Rollback verification"}'::jsonb,request_id);
  retry := public.checkout_order(test_slug,'Verification diner',jsonb_build_array(jsonb_build_object('id',dish_id,'quantity',2)),
    '{"phone":"9999999999","fulfillment":"PICKUP","address":"","notes":"Rollback verification"}'::jsonb,request_id);
  if retry is distinct from receipt then raise exception 'Duplicate checkout was not recovered'; end if;
  tracked := public.track_order((receipt->>'id')::uuid,(receipt->>'token')::uuid);
  if (tracked->>'total')::integer is distinct from 250 then raise exception 'Incorrect checkout total'; end if;
  if exists(select 1 from public.orders where restaurant_id = r.id) then raise exception 'Guest could read private orders'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',owner_id_value::text,true);
  update public.orders set status = 'PREPARING' where id = (receipt->>'id')::uuid;
  update public.orders set status = 'READY' where id = (receipt->>'id')::uuid;
  update public.orders set status = 'COMPLETED' where id = (receipt->>'id')::uuid;
  set local role anon;
  perform set_config('request.jwt.claim.sub','',true);
  review_id := public.submit_review((receipt->>'id')::uuid,(receipt->>'token')::uuid,5,'Transaction verification only');
  if review_id is null then raise exception 'Review was not created'; end if;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',owner_id_value::text,true);
  update public.reviews set owner_reply = 'Verification reply' where id = review_id;
  tracked := public.track_order((receipt->>'id')::uuid,(receipt->>'token')::uuid);
  if tracked->'review'->>'owner_reply' is distinct from 'Verification reply' then raise exception 'Review reply was not saved'; end if;
end;
$$;
rollback;
select 'Launch, checkout, duplicate protection, tracking, order statuses, and reviews passed. Test records rolled back.' as result;
