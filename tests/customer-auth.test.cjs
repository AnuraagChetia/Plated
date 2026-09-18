const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const load=require('./load-typescript.cjs');

test('customer sign-in redirects owners to dashboard and diners to the originating restaurant',async()=>{
  for(const owner of [true,false]){
    let destination, index=0;
    const values=['Guest','guest@example.test','password','',false];
    const query={select(){return this;},eq(key,value){assert.equal(key,'owner_id');assert.equal(value,'verified-user');return this;},limit(){return this;},async maybeSingle(){return {data:owner?{id:'restaurant'}:null,error:null};}};
    const Form=load('app/components/AuthForm.tsx',{
      react:{...React,useState:()=>[values[index++],()=>{}]},
      'next/navigation':{useRouter:()=>({push:value=>{destination=value;},refresh(){}})},
      '../../lib/supabase/client':{createClient:()=>({auth:{signInWithPassword:async()=>({data:{user:{id:'verified-user'},session:{}},error:null})},from:()=>query})},
    }).default;
    const tree=Form({mode:'sign-in',store:'test_kitchen',name:'Test Kitchen'});
    const find=node=>{if(!node||typeof node!=='object')return null;if(node.type==='form')return node;return React.Children.toArray(node.props?.children).map(find).find(Boolean);};
    await find(tree).props.onSubmit({preventDefault(){}});
    assert.equal(destination,owner?'/dashboard':'/r/test_kitchen');
  }
});
