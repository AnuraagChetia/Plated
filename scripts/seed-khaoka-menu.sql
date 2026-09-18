-- Requested sample dishes promoted to real inventory. Safe to rerun; existing names remain unchanged.
begin;
select id from public.restaurants where slug='khaoka' for update;
insert into public.menu_items(restaurant_id,name,description,price,category,is_available)
select r.id,v.name,v.description,v.price,v.category,true
from public.restaurants r cross join (values
('Masor Tenga','A light, tangy Assamese fish curry with tomatoes and fresh herbs.',280,'Mains'),
('Homestyle Chicken Curry','Slow-cooked chicken in a warming onion and ginger gravy.',260,'Mains'),
('Aloo Pitika','Comforting mashed potatoes with mustard oil, onion, and green chilli.',110,'Sides'),
('Steamed Joha Rice','Fragrant Assamese rice, steamed fresh and served warm.',90,'Sides'),
('Til Pitha','Delicate rice rolls filled with toasted sesame and jaggery.',130,'Desserts'),
('Gondhoraj Lemon Cooler','A bright citrus cooler with mint and a touch of rock salt.',100,'Drinks')
) as v(name,description,price,category)
where r.slug='khaoka' and not exists(select 1 from public.menu_items m where m.restaurant_id=r.id and lower(m.name)=lower(v.name));
commit;
select m.name,m.price,m.category,m.is_available from public.menu_items m join public.restaurants r on r.id=m.restaurant_id where r.slug='khaoka' order by m.category,m.name;
