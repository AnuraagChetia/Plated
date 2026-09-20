// Run locally where data/uploads is available. Defaults to a read-only audit.
const {createClient}=require('@supabase/supabase-js');
const {readFile}=require('node:fs/promises');
const path=require('node:path');
const {randomUUID,createHash}=require('node:crypto');
const apply=process.argv.includes('--apply');
const bucket=process.env.SUPABASE_STORAGE_BUCKET || 'restaurant-images';
const root=process.env.UPLOAD_DIR || path.join(process.cwd(),'data','uploads');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const rows=[];
 for(let start=0;;start+=100){
  const {data,error}=await client.from('media_assets').select('id,storage_path,mime_type,content_base64').order('id').range(start,start+99);
  if(error)throw new Error('Unable to read media metadata.');
  rows.push(...data);if(data.length<100)break;
 }
 console.log('Media records:',rows.length,'Mode:',apply?'apply':'audit only');
 if(apply){
  const {data,error}=await client.storage.listBuckets();if(error)throw new Error('Unable to inspect storage buckets.');
  const existing=data.find(b=>b.id===bucket);
  if(existing?.public)throw new Error('Storage bucket must be private.');
  if(existing){const {error}=await client.storage.updateBucket(bucket,{public:false,fileSizeLimit:3145728,allowedMimeTypes:['image/png','image/jpeg','image/webp']});if(error)throw new Error('Unable to update image bucket limits.');}
  if(!existing){const {error}=await client.storage.createBucket(bucket,{public:false,fileSizeLimit:3145728,allowedMimeTypes:['image/png','image/jpeg','image/webp']});if(error)throw new Error('Unable to create private image bucket.');}
 }
 const files=client.storage.from(bucket);let migrated=0;
 for(const row of rows){
  if(row.storage_path.startsWith('supabase/')){
   if(!/^supabase\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(row.storage_path))throw new Error('Invalid remote image path: '+row.id);
   const {data,error}=await files.download(row.storage_path.slice(9));if(error||!data)throw new Error('Remote image missing: '+row.id);
   continue;
  }
  let bytes;
  if(row.storage_path==='database'&&row.content_base64)bytes=Buffer.from(row.content_base64,'base64');
  else {if(!/^local\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(row.storage_path))throw new Error('Unsupported image path: '+row.id);bytes=await readFile(path.join(root,row.storage_path.slice(6)));}
  const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(bytes.length<12||bytes.length>3145728||!mime||mime!==row.mime_type)throw new Error('Invalid image content: '+row.id);
  if(!apply){console.log('Ready:',row.id);continue;}
  const name=randomUUID()+({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[mime]);
  const {error:uploadError}=await files.upload(name,bytes,{contentType:mime,upsert:false});if(uploadError)throw new Error('Upload failed: '+row.id);
  const {data:copy,error:readError}=await files.download(name);
  if(readError||!copy||hash(Buffer.from(await copy.arrayBuffer()))!==hash(bytes))throw new Error('Verification failed; original retained: '+row.id);
  // Compare-and-swap preserves concurrent owner edits. On uncertain errors retain both copies.
  let update=client.from('media_assets').update({storage_path:'supabase/'+name,content_base64:null}).eq('id',row.id).eq('storage_path',row.storage_path);
  update=row.content_base64?update.eq('content_base64',row.content_base64):update.is('content_base64',null);
  const {data:saved,error:saveError}=await update.select('id');
  if(saveError)throw new Error('Metadata update failed; both copies retained: '+row.id);
  if(!saved.length){await files.remove([name]);throw new Error('Image changed during migration; rerun: '+row.id);}
  migrated++;console.log('Migrated:',row.id);
 }
 console.log('Complete. Migrated:',migrated,'. Original local files retained.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
