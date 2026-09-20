const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { withApi } = load('lib/api-server.ts');
const restaurant = '11111111-1111-4111-8111-111111111111', dish = '22222222-2222-4222-8222-222222222222';
function fixture({user=true,owner=true,dishExists=true,assets=[],failSave=false}={}) {
  const calls=[],deleted=[];let writes=0;
  const client={auth:{getUser:async()=>({data:{user:user?{id:'owner'}:null}})},from(table){
    let action='select',values,filters=[];
    const query={select(){return query},eq(key,value){filters.push([key,value]);return query},order(){return Promise.resolve({data:assets,error:null})},
      insert(value){action='insert';values=value;return query},update(value){action='update';values=value;return query},delete(){action='delete';return query},
      async maybeSingle(){
        calls.push({table,action,values,filters});
        if(table==='restaurants') return {data:owner?{id:restaurant}:null};
        if(table==='menu_items') return {data:dishExists?{id:dish}:null};
        return {data:failSave?null:{id:'image',kind:values?.kind,menu_item_id:values?.menu_item_id},error:failSave?{code:'failure'}:null};
      }};return query;
  }};
  const storage={validate(){},async upload(){writes++;return {key:'local/new.png',mime:'image/png'}},async delete(key){deleted.push(key)},url:id=>'/api/media/'+id};
  const routes=load('app/api/media/route.ts',{
    '../../../lib/api-server':{withApi},'../../../lib/supabase/route':{routeClient:()=>({client,json:(body,status=200)=>Response.json(body,{status})})},
    '../../../lib/http':load('lib/http.ts'),'../../../lib/media':load('lib/media.ts'),'../../../lib/orders':load('lib/orders.ts'),'../../../lib/storage':{storage},
  });
  const request=(method='POST',kind='menu_item')=>new Request(`http://local/api/media?restaurant=${restaurant}&kind=${kind}&dish=${dish}`,{method,...(method==='POST'?{body:'test image bytes'}:{})});
  return {routes,request,calls,deleted,writes:()=>writes};
}
test('image mutations reject guests, nonowners, and dishes outside the restaurant before file writes',async()=>{
  for(const [options,status] of [[{user:false},401],[{owner:false},404],[{dishExists:false},404]]) {
    const f=fixture(options);
    for(const method of ['POST','DELETE']) assert.equal((await f.routes[method](f.request(method))).status,status);
    assert.equal(f.writes(),0);
  }
});
test('replacement persists dish association, clears legacy bytes, and removes old local file after saving',async()=>{
  const f=fixture({assets:[{id:'old',storage_path:'local/old.png'}]});
  assert.equal((await f.routes.POST(f.request())).status,200);
  const mutation=f.calls.find(call=>call.action==='update');
  assert.equal(mutation.values.menu_item_id,dish);assert.equal(mutation.values.content_base64,null);
  assert.deepEqual(f.deleted,['local/old.png']);
});
test('failed metadata save removes new file and preserves old file',async()=>{
  const f=fixture({assets:[{id:'old',storage_path:'local/old.png'}],failSave:true});
  assert.equal((await f.routes.POST(f.request())).status,409);
  assert.deepEqual(f.deleted,['local/new.png']);
});
test('contextual removal clears old associations first so previous images cannot resurface',async()=>{
  const f=fixture({assets:[{id:'new',storage_path:'local/new.png'},{id:'old',storage_path:'database'}]});
  assert.equal((await f.routes.DELETE(f.request('DELETE','logo'))).status,200);
  assert.deepEqual(f.calls.filter(c=>c.action==='delete').map(c=>c.filters.find(([key])=>key==='id')[1]),['old','new']);
  assert.deepEqual(f.deleted,['local/new.png']);
});

test('logo and cover replacements delete all previous bucket objects after saving',async()=>{for(const kind of ['logo','cover']){const f=fixture({assets:[{id:'current',storage_path:'supabase/current.png'},{id:'older',storage_path:'supabase/older.png'}]});assert.equal((await f.routes.POST(f.request('POST',kind))).status,200);assert.deepEqual(f.deleted,['supabase/current.png','supabase/older.png']);assert.equal(f.calls.find(c=>c.action==='update').values.menu_item_id,null);}});
