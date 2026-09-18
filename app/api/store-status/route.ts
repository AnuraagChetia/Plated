import {withApi} from "../../../lib/api-server";
import {routeClient} from "../../../lib/supabase/route";
import {validStorefrontSlug} from "../../../lib/restaurant-validation";
import {serviceStatus} from "../../../lib/hours";
export const GET=withApi(async(request:Request)=>{const {client,json}=routeClient(request);const slug=new URL(request.url).searchParams.get("slug");if(!validStorefrontSlug(slug))return json({error:"Invalid restaurant address."},400);
 const {data,error}=await client.from("restaurants").select("accepting_orders,is_published,opens_at,closes_at,timezone,accepts_pickup,accepts_delivery").eq("slug",slug).maybeSingle();
 if(error)return json({error:"Could not refresh opening status."},503);if(!data)return json({open:false,message:"This restaurant is currently unavailable."});return json({...serviceStatus(data),hours:data});});
