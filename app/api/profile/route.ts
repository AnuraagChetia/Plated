import {withApi} from "../../../lib/api-server";
import {routeClient} from "../../../lib/supabase/route";
import {readJson} from "../../../lib/http";
import {customerDetails} from "../../../lib/customer";
export const GET=withApi(async(request:Request)=>{
 const {client,json}=routeClient(request);const {data:{user}}=await client.auth.getUser();if(!user)return json({error:"Please sign in."},401);
 const [profile,addresses,orders]=await Promise.all([
 client.from("customer_profiles").select("name,phone").eq("user_id",user.id).maybeSingle(),
 client.from("customer_addresses").select("id,label,recipient,phone,address").eq("user_id",user.id).order("created_at"),
 client.rpc("customer_order_history")]);
 if(profile.error||addresses.error||orders.error)return json({error:"Could not load your profile. Please retry."},503);
 return json({profile:profile.data||{name:typeof user.user_metadata?.name==="string"?user.user_metadata.name:"",phone:""},addresses:addresses.data||[],orders:orders.data||[]});
});
export const PUT=withApi(async(request:Request)=>{
 const {client,json}=routeClient(request);const {data:{user}}=await client.auth.getUser();if(!user)return json({error:"Please sign in."},401);
 const details=customerDetails(await readJson(request));if(!details)return json({error:"Enter your name and a valid phone number (7–15 digits), or leave phone blank."},400);
 const {error}=await client.from("customer_profiles").upsert({...details,user_id:user.id},{onConflict:"user_id"});
 return error?json({error:"Could not save your profile."},503):json({ok:true});
});
