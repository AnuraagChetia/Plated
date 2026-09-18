const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const load=require('./load-typescript.cjs');
test('every confirmation provides a private tracking URL, copy control, and guest recovery guidance',()=>{
 const Confirmation=load('app/components/OrderConfirmation.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Confirmation,{receipt:{id:'order-id',token:'private-token'},onClose(){}}));
 assert.match(html,/href="\/order\/order-id#private-token"/);
 assert.match(html,/Track your order/);
 assert.match(html,/Copy tracking link/);
 assert.match(html,/especially if you ordered as a guest/);
});
test('checkout distinguishes manual pauses and closed hours from uncertain network failures',async()=>{
 let code='P0409';
 const {POST}=load('app/api/orders/route.ts',{
  '../../../lib/api-server':load('lib/api-server.ts'),
  '../../../lib/http':load('lib/http.ts'),
  '../../../lib/orders':load('lib/orders.ts'),
  '../../../lib/supabase/route':{routeClient:()=>({client:{rpc:async()=>({data:null,error:{code}})},json:(body,status=200)=>Response.json(body,{status})})},
 });
 const request=()=>new Request('http://localhost/api/orders',{method:'POST',body:JSON.stringify({slug:'khaoka',customerName:'Guest',requestId:'11111111-1111-4111-8111-111111111111',items:[{id:'22222222-2222-4222-8222-222222222222',quantity:1}],checkout:{phone:'9999999999',fulfillment:'PICKUP',address:'',notes:''}})});
 const paused=await POST(request());assert.equal(paused.status,409);assert.match((await paused.json()).error,/stopped taking/);
 code='P0410';const closed=await POST(request());assert.equal(closed.status,409);assert.match((await closed.json()).error,/currently closed/);
 code='08006';const uncertain=await POST(request());assert.equal(uncertain.status,503);assert.match((await uncertain.json()).error,/Retry with the same details/);
});
