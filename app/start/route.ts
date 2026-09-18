import { routeClient } from "../../lib/supabase/route";
import { withApi } from "../../lib/api-server";

export const GET = withApi(async (request: Request) => {
  const { client, response, json } = routeClient(request);
  const { data: { user }, error } = await client.auth.getUser();
  if (error && error.status !== 400 && error.status !== 401 && error.status !== 403) {
    return json({ error: "Could not check your session. Please retry." }, 503);
  }
  const headers = new Headers(response.headers);
  headers.set("Location", new URL(user ? "/dashboard" : "/onboarding", request.url).toString());
  headers.set("Cache-Control", "no-store");
  return new Response(null, { status: 303, headers });
});
