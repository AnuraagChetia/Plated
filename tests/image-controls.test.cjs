const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const load=require('./load-typescript.cjs');
const api=load('lib/api-client.ts');
const fields=load('app/components/image-field.tsx',{'../../lib/api-client':api});
const Storefront=load('app/r/[slug]/storefront.tsx',{
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '../../components/image-field':fields,
  '../../../lib/orders':load('lib/orders.ts'),
  '../../../lib/browser-storage':load('lib/browser-storage.ts'),
  '../../../lib/api-client':api,
}).default;
const restaurant={id:'test',name:'Kitchen',slug:'kitchen',theme:'olive',pickup_address:'123 Test Street',accepts_pickup:true,accepting_orders:true,estimated_minutes:20};
test('storefront image controls render only for the owner; missing images remain usable',()=>{
  const render=isOwner=>renderToStaticMarkup(React.createElement(Storefront,{restaurant,menu:[],media:[],reviews:[],isOwner}));
  assert.doesNotMatch(render(false),/Edit Cover Photo|Change Logo/);
  assert.match(render(true),/Edit Cover Photo/);
  assert.match(render(true),/Change Logo/);
  assert.match(render(false),/Restaurant logo/);
});
test('image field shows existing preview and supports staged removal and undo',()=>{
  const render=value=>renderToStaticMarkup(React.createElement(fields.ImageField,{current:'/api/media/existing',value,onChange(){}}));
  assert.match(render(undefined),/Image preview/);
  assert.match(render(undefined),/Replace image/);
  assert.match(render(null),/No image selected/);
  assert.match(render(null),/Undo image change/);
  assert.doesNotMatch(render(null),/<img/);
});
