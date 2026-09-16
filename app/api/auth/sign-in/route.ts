import { withApi } from "../../../../lib/api-server";
import{NextResponse}from"next/server";import{routeClient}from"../../../../lib/supabase/route";
async function handlePOST(request:Request){const{email,password}=await request.json();const{client,response}=routeClient(request);const{data,error}=await client.auth.signInWithPassword({email,password});if(error)return NextResponse.json({error:error.message},{status:401});response.headers.set("Content-Type","application/json");response.body;return new NextResponse(JSON.stringify({user:data.user}),{status:200,headers:response.headers})}

export const POST = withApi(handlePOST);
