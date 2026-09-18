import {withApi} from "../../../../lib/api-server";
import {routeClient} from "../../../../lib/supabase/route";
import {readJson} from "../../../../lib/http";
import {customerDetails} from "../../../../lib/customer";
import {UUID} from "../../../../lib/orders";
async function save(request:Request){
 const {client,json}=routeClient(request);const {data:{user}}=await client.auth.getUser();if(!user)return json({error:"Please sign in."},401);
 const input=await readJson(request) as Record<string,unknown>|null;const details=customerDetails(input,true);
 if(!details||(request.method==="PATCH"&&(typeof input?.id!=="string"||!UUID.test(input.id))))return json({error:"Enter an address label, recipient, valid phone number, and full delivery address."},400);
 if(request.method==="POST"){
 const {data:existing,error}=await client.from("customer_addresses").select("id,label,recipient,phone,address").eq("user_id",user.id);
 if(error)return json({error:"Could not load saved addresses."},503);
 const match=existing?.find(a=>a.address===details.address&&a.recipient===details.recipient&&a.phone===details.phone);
 if(match)return json({address:match});
 if((existing?.length||0)>=20)return json({error:"You can save up to 20 addresses. Remove an old address from your profile first."},400);
 }
 const query=request.method==="PATCH"?client.from("customer_addresses").update(details).eq("id",input!.id).eq("user_id",user.id):client.from("customer_addresses").insert({...details,user_id:user.id});
 const {data,error}=await query.select("id,label,recipient,phone,address").maybeSingle();
 if(error)return json({error:"Could not save your address."},503);if(!data)return json({error:"Address not found."},404);return json({address:data});
}
export const POST=withApi(save);export const PATCH=withApi(save);
export const DELETE=withApi(async(request:Request)=>{
 const {client,json}=routeClient(request);const {data:{user}}=await client.auth.getUser();if(!user)return json({error:"Please sign in."},401);
 const input=await readJson(request) as {id?:string}|null;if(typeof input?.id!=="string"||!UUID.test(input.id))return json({error:"Choose a valid address."},400);
 const {data,error}=await client.from("customer_addresses").delete().eq("id",input.id).eq("user_id",user.id).select("id").maybeSingle();
 return error?json({error:"Could not remove the address."},503):!data?json({error:"Address not found."},404):json({ok:true});
});
