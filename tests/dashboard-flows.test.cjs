const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const load=require('./load-typescript.cjs');
const api=load('lib/api-client.ts');
const fields=load('app/components/image-field.tsx',{'../../lib/api-client':api});
const {MenuEditor}=load('app/dashboard/editors.tsx',{'../../lib/restaurant-validation':load('lib/restaurant-validation.ts'),'../components/image-field':fields,'../../lib/api-client':api});
test('menu editor offers existing categories and a named creation flow',()=>{
  const render=category=>renderToStaticMarkup(React.createElement(MenuEditor,{dish:{name:'Dal',category},categories:['Mains','Desserts'],restaurantId:'restaurant',onCancel(){},onSaved(){}}));
  assert.match(render('Desserts'),/value="Desserts" selected/);
  assert.match(render('Desserts'),/Create new category/);
  assert.match(render(''),/New category name/);
  assert.match(render(''),/category is created when you save this dish/);
});
test('homepage start redirects by verified session',async()=>{
  for(const user of [null,{id:'owner'}]) {
    const {GET}=load('app/start/route.ts',{
      '../../lib/api-server':load('lib/api-server.ts'),
      '../../lib/supabase/route':{routeClient:()=>({client:{auth:{getUser:async()=>({data:{user},error:null})}},response:Response.json({})})},
    });
    const result=await GET(new Request('http://localhost/start'));
    assert.equal(result.status,303);
    assert.equal(result.headers.get('location'),'http://localhost/'+(user?'dashboard':'onboarding'));
    assert.equal(result.headers.get('cache-control'),'no-store');
  }
});
