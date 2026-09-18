const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { responseJson, ApiError } = load('lib/api-client.ts');
const { readJson } = load('lib/http.ts');
const { withApi, databaseMessage } = load('lib/api-server.ts');

test('cookie helper preserves POST body and response cookies', async () => {
  const { routeClient } = load('lib/supabase/route.ts', {
    '@supabase/ssr': { createServerClient(_url,_key,options) { options.cookies.setAll([{name:'session',value:'updated',options:{httpOnly:true}}]); return {}; } },
  });
  const request = new Request('http://localhost/api/restaurants',{method:'POST',headers:{Cookie:'session=old'},body:JSON.stringify({name:'Test Kitchen'})});
  const { json } = routeClient(request);
  assert.equal(request.bodyUsed,false);
  assert.deepEqual(await readJson(request),{name:'Test Kitchen'});
  const result = json({ok:true});
  assert.match(result.headers.get('set-cookie'),/session=updated/);
  assert.equal(result.headers.get('cache-control'),'no-store');
});

test('empty and HTML server responses become recoverable errors, not JSON parser crashes', async () => {
  for (const response of [new Response('',{status:500}),new Response('<html>Build failed</html>',{status:502}),new Response('',{status:200})]) {
    await assert.rejects(responseJson(response),error => error instanceof ApiError && !error.message.includes('Unexpected end'));
  }
  await assert.rejects(responseJson(Response.json({error:'Please sign in.'},{status:401})),/Please sign in/);
  assert.deepEqual(await responseJson(Response.json({restaurant:{id:'test'}})),{restaurant:{id:'test'}});
});

test('malformed and oversized requests cannot escape JSON error handling', async () => {
  assert.equal(await readJson(new Request('http://local',{method:'POST',body:'{'})),null);
  assert.equal(await readJson(new Request('http://local',{method:'POST',body:'a'.repeat(100)}),20),null);
  const response = await withApi(async () => { throw new TypeError('Unexpected failure'); })();
  assert.equal(response.status,503);
  assert.equal(typeof (await response.json()).error,'string');
  assert.match(databaseMessage({code:'PGRST202'},'fallback'),/0004/);
});

test('launch handles both Supabase composite response shapes and reports missing migrations', async () => {
  let databaseResult = {data:{id:'restaurant'},error:null};
  const { POST } = load('app/api/restaurants/route.ts', {
    '../../../lib/supabase/route': { routeClient: () => ({client:{auth:{getUser:async () => ({data:{user:{id:'owner'}}})},rpc:async () => databaseResult},json:(body,status=200) => Response.json(body,{status})}) },
    '../../../lib/hours':load('lib/hours.ts'),
    '../../../lib/restaurant-validation':load('lib/restaurant-validation.ts'),
    '../../../lib/http':{readJson}, '../../../lib/api-server':{withApi,databaseMessage},
  });
  const request = () => new Request('http://local/api/restaurants',{method:'POST',body:JSON.stringify({name:'Test Kitchen',slug:'test-kitchen',description:'Seasonal food',dishName:'Dal',dishPrice:310,pickupAddress:'123 Test Street',contactPhone:'9999999999'})});
  for (const data of [{id:'restaurant'},[{id:'restaurant'}]]) {
    databaseResult = {data,error:null};
    const response = await POST(request()); assert.equal(response.status,201); assert.equal((await response.json()).restaurant.id,'restaurant');
  }
  databaseResult = {data:null,error:{code:'PGRST202'}};
  const response = await POST(request()); assert.equal(response.status,503); assert.match((await response.json()).error,/migration/);
});
