const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./load-typescript.cjs');
const {validHours,serviceStatus}=load('lib/hours.ts');
const {customerDetails}=load('lib/customer.ts');
test('daily hours handle timezone boundaries, overnight service and manual pause',()=>{
 const r={accepting_orders:true,is_published:true,opens_at:'09:00',closes_at:'22:00',timezone:'Asia/Kolkata'};
 assert.equal(serviceStatus(r,new Date('2026-09-18T03:29:00Z')).open,false);
 assert.equal(serviceStatus(r,new Date('2026-09-18T03:30:00Z')).open,true);
 assert.equal(serviceStatus(r,new Date('2026-09-18T16:30:00Z')).open,false);
 assert.equal(serviceStatus({...r,opens_at:'22:00',closes_at:'02:00'},new Date('2026-09-18T18:30:00Z')).open,true);
 assert.equal(serviceStatus({...r,accepting_orders:false},new Date('2026-09-18T05:00:00Z')).open,false);
 assert.equal(validHours('09:00','09:00','UTC'),false);
 assert.equal(validHours('25:00','22:00','UTC'),false);
 assert.equal(validHours(null,null,'Invalid/Zone'),false);
 assert.equal(validHours(null,null,'Asia/Kolkata'),true);
});
test('customer details strip identity fields and validate address/contact limits',()=>{
 assert.deepEqual(customerDetails({user_id:'other',name:' Guest ',phone:'+91 99999 99999'}),{name:'Guest',phone:'919999999999'});
 assert.equal(customerDetails({name:'Guest',phone:'letters'}),null);
 assert.equal(customerDetails({label:'Home',recipient:'Guest',phone:'9999999999',address:'short'},true),null);
 assert.ok(customerDetails({label:'Home',recipient:'Guest',phone:'9999999999',address:'123 Main Street'},true));
});
test('expired sessions return to sign-in while temporary auth failures get a retry screen',async()=>{
 const {NextRequest}=require('next/server');
 for(const [error,path] of [[{name:'AuthApiError',status:400,code:'refresh_token_not_found'},'/sign-in'],[{name:'AuthRetryableFetchError',status:503},'/auth-unavailable']]){
  const {proxy}=load('proxy.ts',{'@supabase/ssr':{createServerClient:()=>({auth:{getUser:async()=>({data:{user:null},error})}})}});
  const response=await proxy(new NextRequest('http://localhost/profile?store=khaoka'));
  assert.equal(new URL(response.headers.get('location')).pathname,path);
 }
});
