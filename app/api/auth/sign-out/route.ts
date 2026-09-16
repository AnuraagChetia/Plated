import { withApi } from "../../../../lib/api-server";
import{NextResponse}from"next/server";import{routeClient}from"../../../../lib/supabase/route";
async function handlePOST(request:Request){const{client,response}=routeClient(request);await client.auth.signOut();return new NextResponse(JSON.stringify({ok:true}),{status:200,headers:response.headers})}

export const POST = withApi(handlePOST);
