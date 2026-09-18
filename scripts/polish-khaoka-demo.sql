-- Improve placeholder copy only; preserve owner-written replacements and operational settings.
begin;
update public.restaurants set description='Comforting Assamese-inspired meals, fragrant rice, and familiar favorites. Explore tangy fish curry, homestyle chicken, thoughtful sides, and a sweet finish with sesame pitha. Make it a quick lunch or a meal to share — order directly from our kitchen.' where slug='khaoka' and description='Your best traditional food destination';
update public.menu_items set description='A simple, satisfying sandwich for a quick lunch or a lighter bite.' where restaurant_id=(select id from public.restaurants where slug='khaoka') and name='Healthy Sandwich' and description='Sandwich with lots of health';
commit;
select name,description,accepting_orders from public.restaurants where slug='khaoka';
