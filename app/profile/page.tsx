import {createClient} from "../../lib/supabase/server";
import {validStorefrontSlug} from "../../lib/restaurant-validation";
import RestaurantNavigation from "../components/RestaurantNavigation";
import Profile from "./profile";
export default async function Page({searchParams}:{searchParams:Promise<{store?:string}>}){
 const query=await searchParams;const store=validStorefrontSlug(query.store)?query.store:undefined;let restaurant=null,logo=null;
 if(store){const client=await createClient();const result=await client.from("restaurants").select("id,name,slug").eq("slug",store).maybeSingle();restaurant=result.data;if(restaurant){const result=await client.from("media_assets").select("id").eq("restaurant_id",restaurant.id).eq("kind","logo").order("created_at",{ascending:false}).limit(1).maybeSingle();logo=result.data;}}
 return <>{restaurant&&<RestaurantNavigation name={restaurant.name} slug={restaurant.slug} logoUrl={logo?"/api/media/"+logo.id:undefined}/>}<Profile store={store}/></>;
}
