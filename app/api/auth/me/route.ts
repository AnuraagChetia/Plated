import{NextResponse}from"next/server";import{routeClient}from"../../../../lib/supabase/route";
export async function GET(request:Request){const{client,response}=routeClient(request);const{data:{user}}=await client.auth.getUser();return new NextResponse(JSON.stringify({user:user?{id:user.id,name:user.user_metadata.name,email:user.email}:null}),{status:200,headers:response.headers})}
