const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rmdir } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const load = require('./load-typescript.cjs');
const { LocalStorageService } = load('lib/storage.ts', {'./media':load('lib/media.ts')});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6SAAAAABJRU5ErkJggg==','base64');
test('local storage persists bytes, validates files, isolates paths, and deletes safely', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(),'plated-storage-'));
  const storage = new LocalStorageService(root);
  try {
    await assert.rejects(storage.upload(Buffer.from('<svg onload="alert(1)">')),/PNG/);
    const file = await storage.upload(png);
    assert.equal(file.mime,'image/png');
    assert.deepEqual(await storage.read(file.key),png);
    assert.throws(() => storage.read('../.env.local'),/Invalid storage key/);
    await assert.rejects(storage.delete('local/../../.env.local'),/Invalid storage key/);
    await storage.delete(file.key);
    await storage.delete(file.key);
    await assert.rejects(storage.read(file.key),{code:'ENOENT'});
  } finally { await rmdir(root); }
});

const {SupabaseStorageService,RoutedStorageService}=load('lib/storage.ts',{'./media':load('lib/media.ts')});
test('private remote storage validates uploads, preserves bytes and reports failures',async()=>{
 const objects=new Map();let fail=false,calls=0;
 const remote=new SupabaseStorageService({storage:{from(bucket){assert.equal(bucket,'test-images');return {
 async upload(name,bytes,options){calls++;assert.equal(options.upsert,false);if(fail)return {error:{}};objects.set(name,bytes);return {error:null};},
 async download(name){return objects.has(name)?{data:new Blob([objects.get(name)]),error:null}:{error:{}};},
 async remove(names){if(fail)return {error:{}};names.forEach(n=>objects.delete(n));return {error:null};}
 };}}},'test-images');
 await assert.rejects(remote.upload(Buffer.from('<svg>bad</svg>')),/PNG/);assert.equal(calls,0);
 const uploaded=await remote.upload(png);assert.ok(uploaded.key.startsWith("supabase/"));assert.deepEqual(await remote.read(uploaded.key),png);
 await assert.rejects(remote.read('supabase/../../secret'),/Invalid storage key/);
 fail=true;await assert.rejects(remote.upload(png),/Could not upload/);await assert.rejects(remote.delete(uploaded.key),/Could not delete/);
 fail=false;await remote.delete(uploaded.key);await assert.rejects(remote.read(uploaded.key),/Could not read/);
});
test('provider switch retains reads and deletes for existing local images',async()=>{
 const calls=[];const backend=name=>({validate:()=> 'image/png',upload:async()=>{calls.push(name+':upload');return {key:name+'/new',mime:'image/png'};},read:async()=>{calls.push(name+':read');return png;},delete:async()=>{calls.push(name+':delete');},url:id=>'/api/media/'+id});
 const routed=new RoutedStorageService(backend('local'),backend('supabase'),'supabase');
 await routed.upload(png);await routed.read('local/old');await routed.read('supabase/new');await routed.delete('local/old');
 assert.deepEqual(calls,['supabase:upload','local:read','supabase:read','local:delete']);
 assert.throws(()=>routed.read('../secret'),/Invalid storage key/);
 assert.throws(()=>new RoutedStorageService(backend('local'),backend('supabase'),'typo'),/STORAGE_PROVIDER/);
});
