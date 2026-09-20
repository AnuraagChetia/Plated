const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const load=require('./load-typescript.cjs');
const api=load('lib/api-client.ts');
const fields=load('app/components/image-field.tsx',{'../../lib/api-client':api});
const RestaurantNavigation=load('app/components/RestaurantNavigation.tsx',{'next/navigation':{useRouter:()=>({refresh(){}})},'../../lib/supabase/client':{createClient(){throw new Error('Effects should not run on server');}}}).default;
const Storefront=load('app/r/[slug]/storefront.tsx',{
  'next/navigation':{useRouter:()=>({refresh(){}})},
  '../../components/DishArtwork':{default:load('app/components/DishArtwork.tsx').default},
  '../../components/image-field':fields,
  '../../components/ReviewCarousel':{default:load('app/components/ReviewCarousel.tsx').default},
  '../../components/OrderConfirmation':{default:()=>null},
  '../../../lib/hours':load('lib/hours.ts'),
  '../../components/RestaurantNavigation':{default:RestaurantNavigation},
  '../../../lib/orders':load('lib/orders.ts'),
  '../../../lib/browser-storage':load('lib/browser-storage.ts'),
  '../../../lib/api-client':api,
}).default;
const restaurant={id:'test',name:'Kitchen',slug:'kitchen',pickup_address:'123 Test Street',accepts_pickup:true,accepting_orders:true,estimated_minutes:20};
test('storefront image controls render only for the owner; missing images remain usable',()=>{
  const render=isOwner=>renderToStaticMarkup(React.createElement(Storefront,{restaurant,menu:[],media:[],reviews:[],isOwner}));
  assert.doesNotMatch(render(false),/Edit Cover Photo|Edit restaurant logo/);
  assert.match(render(true),/Edit Cover Photo/);
  assert.match(render(true),/Edit restaurant logo/);
  assert.doesNotMatch(render(true),/>Change Logo</);
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

test('restaurant navigation uses restaurant branding and excludes platform links',()=>{
 const html=renderToStaticMarkup(React.createElement(RestaurantNavigation,{name:'Test Kitchen',slug:'test-kitchen',logoUrl:'/api/media/logo'}));
 assert.match(html,/Test Kitchen/); assert.match(html,/href="\/r\/test-kitchen"/); assert.match(html,/src="\/api\/media\/logo"/);
 assert.doesNotMatch(html,/How it works|Features|Get started|plated/);
});

test('storefront reviews show customer feedback without owner replies',()=>{
 const html=renderToStaticMarkup(React.createElement(Storefront,{restaurant,menu:[],media:[],reviews:[{id:'review',customer_name:'Guest',restaurant_rating:5,comment:'Delicious food',owner_reply:'Private test owner response'}]}));
 assert.match(html,/Delicious food/); assert.match(html,/Verified order/); assert.doesNotMatch(html,/Private test owner response|Restaurant reply/);
});

test('demo feedback remains labeled without preview UI or slideshow controls',()=>{
 const {demoDishes,demoReviews}=load('lib/storefront-demo.ts');
 const html=renderToStaticMarkup(React.createElement(Storefront,{restaurant,menu:demoDishes,media:[],reviews:demoReviews}));
 assert.doesNotMatch(html,/Demo storefront|Show real reviews only|Pause slideshow|Previous review|Next review/);assert.match(html,/Masor Tenga/);assert.match(html,/Demo review/);assert.match(html,/Preview only/);
 assert.doesNotMatch(html,/Verified order|Add Masor Tenga to cart/);
});

test('review cards display a stable calendar date',()=>{const ReviewCarousel=load('app/components/ReviewCarousel.tsx').default;const html=renderToStaticMarkup(React.createElement(ReviewCarousel,{reviews:[{id:'dated',customer_name:'Guest',restaurant_rating:5,created_at:'2026-09-18T00:00:00Z'}]}));assert.match(html,/<time[^>]+dateTime="2026-09-18T00:00:00Z"/);assert.match(html,/18 Sept 2026|18 Sep 2026/);});
