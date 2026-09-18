const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./load-typescript.cjs');
const {showcaseReviews}=load('lib/storefront-demo.ts');
test('showcase preserves real feedback first and fills only six slots',()=>{
 const real=Array.from({length:2},(_,i)=>({id:'real-'+i,created_at:'2026-08-0'+(i+1)}));
 const result=showcaseReviews(real);
 assert.equal(result.length,6);
 assert.deepEqual(result.slice(0,2).map(r=>r.id),['real-1','real-0']);
 assert.ok(result.slice(2).every(r=>r.is_demo));
 assert.equal(real[0].id,'real-0');
});
test('six real reviews leave no fictional feedback slots',()=>{
 const real=Array.from({length:8},(_,i)=>({id:'real-'+i,created_at:'2026-08-0'+(i+1)}));
 const result=showcaseReviews(real);
 assert.equal(result.length,6);
 assert.ok(result.every(r=>!r.is_demo));
 assert.equal(result[0].id,'real-7');
});
