import AuthForm from "../components/AuthForm";
import {validStorefrontSlug} from "../../lib/restaurant-validation";
import {createClient} from "../../lib/supabase/server";
export default async function Page({searchParams}:{searchParams:Promise<{store?:string}>}){
 const query=await searchParams;const store=validStorefrontSlug(query.store)?query.store:undefined;
 let name:string|undefined;
 if(store){const client=await createClient();const {data}=await client.from("restaurants").select("name").eq("slug",store).maybeSingle();name=data?.name;}
 return <AuthForm mode="sign-in" store={store} name={name}/>;
}
