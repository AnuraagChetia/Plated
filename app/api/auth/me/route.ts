import { withApi } from "../../../../lib/api-server";
import{NextResponse}from"next/server";import{routeClient}from"../../../../lib/supabase/route";
async function handleGET(request:Request){const{client,response}=routeClient(request);const{data:{user}}=await client.auth.getUser();return new NextResponse(JSON.stringify({user:user?{id:user.id,name:user.user_metadata.name,email:user.email}:null}),{status:200,headers:response.headers})}

export const GET = withApi(handleGET);
