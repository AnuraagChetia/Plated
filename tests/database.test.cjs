const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

test('complete database workflow and access policies', async t => {
  const db = new PGlite();
  const owner = randomUUID(), other = randomUUID();
  const role = async (name, id = '') => db.exec(`reset role; set role ${name}; set request.jwt.claim.sub = '${id}';`);
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public,auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      alter default privileges in schema public grant all on tables to anon,authenticated;
    `);
    for (const file of fs.readdirSync(path.resolve(__dirname,'../supabase/migrations')).sort()) await db.exec(fs.readFileSync(path.resolve(__dirname,'../supabase/migrations',file),'utf8'));
    await db.query('insert into auth.users(id) values ($1),($2)',[owner,other]);
    await role('authenticated',owner);
    const launch = () => db.query("select (public.setup_restaurant('Test Kitchen','test_kitchen','Fresh food','olive','Dal',310,'123 Test Street','9999999999')).id");
    const restaurant = (await launch()).rows[0].id;
    const dish = (await db.query('select id,price from public.menu_items')).rows[0];
    const checkout = {phone:'9999999999',fulfillment:'PICKUP',address:'',notes:'No cutlery'};
    const cart = [{id:dish.id,quantity:2,price:1}];
    const requestId = randomUUID();
    const place = async (items = cart,key = requestId,details = checkout) =>
      (await db.query("select public.checkout_order('test_kitchen',' Guest ',$1::jsonb,$2::jsonb,$3) as receipt",[JSON.stringify(items),JSON.stringify(details),key])).rows[0].receipt;
    let receipt;

    await t.test('launch is atomic and retry-safe', async () => {
      assert.equal((await launch()).rows[0].id,restaurant);
      assert.equal((await db.query('select count(*)::int as count from public.menu_items')).rows[0].count,1);
      assert.equal(dish.price,310);
      await role('authenticated',other);
      await assert.rejects(launch(),error => error.code === '23505');
      await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as count from public.restaurants')).rows[0].count,1);
    });
    await t.test('guest checkout uses menu prices, persists details, and deduplicates retries', async () => {
      await role('anon');
      receipt = await place();
      assert.ok(receipt.id && receipt.token);
      assert.deepEqual(await place(),receipt);
      await assert.rejects(place([{id:dish.id,quantity:3}]),error => error.code === '22000');
      assert.equal((await db.query('select * from public.orders')).rows.length,0);
      await assert.rejects(db.query("select public.place_order('test_kitchen','Guest',$1::jsonb)",[JSON.stringify(cart)]),/permission denied/);
      await assert.rejects(db.query("insert into public.orders(restaurant_id,customer_name,total) values ($1,'Guest',1)",[restaurant]),/permission denied/);
      await role('authenticated',owner);
      const saved = (await db.query('select total,customer_name,customer_phone,fulfillment,notes from public.orders where id=$1',[receipt.id])).rows[0];
      assert.deepEqual(saved,{total:620,customer_name:'Guest',customer_phone:'9999999999',fulfillment:'PICKUP',notes:'No cutlery'});
      assert.deepEqual((await db.query('select name,unit_price,quantity from public.order_items where order_id=$1',[receipt.id])).rows,[{name:'Dal',unit_price:310,quantity:2}]);
    });
    await t.test('invalid carts and delivery details roll back',async () => {
      await role('anon');
      for (const bad of [[],[null],[{id:dish.id,quantity:0}],[{id:dish.id,quantity:1.5}],[{id:dish.id,quantity:'2'}],[{id:other,quantity:1}],[{id:dish.id,quantity:1},{id:dish.id,quantity:1}]]) {
        await assert.rejects(place(bad,randomUUID()),error => error.code === '22023');
      }
      await assert.rejects(place(cart,randomUUID(),{...checkout,fulfillment:'DELIVERY',address:'short'}),error => error.code === '22023');
      await assert.rejects(place(cart,randomUUID(),{...checkout,fulfillment:'DELIVERY',address:'123 Long Street'}),error => error.code === '22023');
      await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as count from public.orders')).rows[0].count,1);
    });
    await t.test('private tracking and reviews require the order capability',async () => {
      await role('anon');
      const track = async token => (await db.query('select public.track_order($1,$2) as result',[receipt.id,token])).rows[0].result;
      assert.equal(await track(randomUUID()),null);
      const tracked = await track(receipt.token);
      assert.equal(tracked.status,'NEW');
      assert.equal(tracked.total,620);
      assert.equal(tracked.customer_phone,undefined);
      await assert.rejects(db.query('select public.submit_review($1,$2,5,$3)',[receipt.id,receipt.token,'Great food']),error => error.code === '42501');
    });
    await t.test('owners are isolated and status changes follow the fulfillment flow',async () => {
      await role('authenticated',other);
      assert.equal((await db.query('select * from public.orders')).rows.length,0);
      assert.equal((await db.query("update public.orders set status='PREPARING' where id=$1 returning id",[receipt.id])).rows.length,0);
      await role('authenticated',owner);
      await assert.rejects(db.query('update public.orders set total=1 where id=$1',[receipt.id]),/permission denied/);
      await assert.rejects(db.query("update public.orders set status='COMPLETED' where id=$1",[receipt.id]),error => error.code === '22023');
      for (const status of ['PREPARING','READY','COMPLETED']) await db.query('update public.orders set status=$1 where id=$2',[status,receipt.id]);
      await assert.rejects(db.query("update public.orders set status='NEW' where id=$1",[receipt.id]),error => error.code === '22023');
    });
    await t.test('completed diners submit one review and only owners can reply',async () => {
      await role('anon');
      await assert.rejects(db.query('select public.submit_review($1,$2,5,$3)',[receipt.id,randomUUID(),'Great food']),error => error.code === '42501');
      const submit = () => db.query('select public.submit_review($1,$2,5,$3) as id',[receipt.id,receipt.token,'Great food']);
      const review = (await submit()).rows[0].id;
      assert.equal((await submit()).rows[0].id,review);
      await assert.rejects(db.query('insert into public.reviews(restaurant_id,customer_name,restaurant_rating) values ($1,$2,5)',[restaurant,'Fake']),/permission denied/);
      await role('authenticated',other);
      assert.equal((await db.query("update public.reviews set owner_reply='Bad reply' where id=$1 returning id",[review])).rows.length,0);
      await role('authenticated',owner);
      await assert.rejects(db.query('update public.reviews set restaurant_rating=1 where id=$1',[review]),/permission denied/);
      await db.query("update public.reviews set owner_reply='Thank you!' where id=$1",[review]);
      const summary = (await db.query('select public.dashboard_summary($1) as result',[restaurant])).rows[0].result;
      assert.equal(summary.completed_value,620);
      assert.equal(summary.reviews,1);
      assert.equal(summary.rating,5);
      await role('anon');
      const tracked = (await db.query('select public.track_order($1,$2) as result',[receipt.id,receipt.token])).rows[0].result;
      assert.equal(tracked.review.owner_reply,'Thank you!');
    });
    await t.test('contact rate limiting is shared and retries bypass it safely',async () => {
      await role('anon');
      for (let i=0;i<4;i++) await place(cart,randomUUID());
      await assert.rejects(place(cart,randomUUID()),error => error.code === 'P0429');
      assert.deepEqual(await place(),receipt);
      await role('authenticated',owner);
      await db.query('update public.restaurants set accepting_orders=false where id=$1',[restaurant]);
      await role('anon');
      assert.deepEqual(await place(),receipt);
      await assert.rejects(place(cart,randomUUID(),{...checkout,phone:'8888888888'}),error => error.code === 'P0409');
      await role('authenticated',owner);
      await db.query('update public.restaurants set accepting_orders=true,accepts_delivery=true where id=$1',[restaurant]);
      await role('anon');
      const delivery = await place(cart,randomUUID(),{...checkout,phone:'8888888888',fulfillment:'DELIVERY',address:'123 Delivery Street'});
      assert.ok(delivery.id);
    });
    await t.test('media validates ownership, quotas, and publication visibility',async () => {
      await role('authenticated',other);
      await assert.rejects(db.query("insert into public.media_assets(restaurant_id,kind,storage_path) values ($1,'gallery','database')",[restaurant]),error => error.code === '42501');
      await role('authenticated',owner);
      for (let i=0;i<30;i++) await db.query("insert into public.media_assets(restaurant_id,kind,storage_path,content_base64,mime_type,menu_item_id) values ($1,'menu_item','database','iVBORw0KGgo=','image/png',$2)",[restaurant,dish.id]);
      await assert.rejects(db.query("insert into public.media_assets(restaurant_id,kind,storage_path) values ($1,'gallery','database')",[restaurant]),error => error.code === '22023');
      await role('anon');
      assert.equal((await db.query('select id from public.media_assets')).rows.length,30);
      await role('authenticated',owner);
      await db.query('update public.restaurants set is_published=false where id=$1',[restaurant]);
      await role('anon');
      assert.equal((await db.query('select id from public.media_assets')).rows.length,0);
      assert.equal((await db.query('select id from public.reviews')).rows.length,0);
    });

    await t.test('profiles and addresses are isolated; signed-in orders are attached to the verified customer',async()=>{
      await role('authenticated',owner);
      await db.query('update public.restaurants set is_published=true where id=$1',[restaurant]);
      await db.query("insert into public.customer_profiles(user_id,name,phone) values ($1,'Owner','9999999999')",[owner]);
      await role('authenticated',other);
      assert.equal((await db.query('select * from public.customer_profiles')).rows.length,0);
      await assert.rejects(db.query("insert into public.customer_profiles(user_id,name) values ($1,'Imposter')",[owner]),e=>e.code==='42501');
      await db.query("insert into public.customer_profiles(user_id,name,phone) values ($1,'Customer','7777777777')",[other]);
      const address=(await db.query("insert into public.customer_addresses(user_id,label,recipient,phone,address) values ($1,'Home','Customer','7777777777','123 Customer Street') returning id",[other])).rows[0].id;
      await db.query("update public.customer_addresses set label='Work' where id=$1",[address]);
      const customerReceipt=await place(cart,randomUUID(),{...checkout,phone:'7777777777'});
      let history=(await db.query('select public.customer_order_history() as history')).rows[0].history;
      assert.equal(history.length,1);assert.equal(history[0].id,customerReceipt.id);assert.equal(history[0].tracking_token,customerReceipt.token);
      await role('authenticated',owner);
      assert.equal((await db.query('select * from public.customer_addresses')).rows.length,0);
      assert.equal((await db.query('delete from public.customer_addresses where id=$1 returning id',[address])).rows.length,0);
      assert.equal((await db.query('select public.customer_order_history() as history')).rows[0].history.length,0);
      await role('anon');
      await assert.rejects(db.query('select * from public.customer_profiles'),e=>e.code==='42501');
      await assert.rejects(db.query('select public.customer_order_history()'),e=>e.code==='42501');
      await role('authenticated',other);
      assert.equal((await db.query('delete from public.customer_addresses where id=$1 returning id',[address])).rows.length,1);
    });
    await t.test('opening hours reject new orders but allow retries of confirmed orders',async()=>{
      await role('authenticated',owner);
      await assert.rejects(db.query("update public.restaurants set timezone='Unknown/Zone' where id=$1",[restaurant]),e=>e.code==='22023');
      await db.query("update public.restaurants set timezone='UTC', opens_at=((current_timestamp at time zone 'UTC')+interval '1 hour')::time, closes_at=((current_timestamp at time zone 'UTC')+interval '2 hours')::time where id=$1",[restaurant]);
      await role('anon');
      await assert.rejects(place(cart,randomUUID(),{...checkout,phone:'6666666666'}),e=>e.code==='P0410');
      assert.deepEqual(await place(),receipt);
      await role('authenticated',owner);
      await db.query("update public.restaurants set opens_at=((current_timestamp at time zone 'UTC')-interval '1 hour')::time, closes_at=((current_timestamp at time zone 'UTC')+interval '1 hour')::time where id=$1",[restaurant]);
      await role('anon');assert.ok((await place(cart,randomUUID(),{...checkout,phone:'6666666666'})).id);
    });
  } finally { await db.close(); }
});
