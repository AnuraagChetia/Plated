import{NextResponse}from"next/server";import{routeClient}from"../../../../lib/supabase/route";
export async function POST(request:Request){const{client,response}=routeClient(request);await client.auth.signOut();return new NextResponse(JSON.stringify({ok:true}),{status:200,headers:response.headers})}
