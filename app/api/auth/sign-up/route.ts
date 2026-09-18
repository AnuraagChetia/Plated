import { withApi } from "../../../../lib/api-server";
import { NextResponse } from "next/server";
import { routeClient } from "../../../../lib/supabase/route";
async function handlePOST(request: Request) {
  const { name, email, password } = await request.json();
  const { client, response } = routeClient(request);
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(
    JSON.stringify({ user: data.user, needsConfirmation: !data.session }),
    { status: 200, headers: response.headers },
  );
}

export const POST = withApi(handlePOST);
