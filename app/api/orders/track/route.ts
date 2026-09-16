import { withApi } from "../../../../lib/api-server";
import { routeClient } from "../../../../lib/supabase/route";
import { UUID } from "../../../../lib/orders";
import { readJson } from "../../../../lib/http";

async function handlePOST(request: Request) {
  const { client, json } = routeClient(request);
  const input = await readJson(request) as { id?: string; token?: string } | null;
  if (!input || typeof input.id !== "string" || !UUID.test(input.id) || typeof input.token !== "string" || !UUID.test(input.token)) return json({ error: "Invalid order link." }, 400);
  const { data, error } = await client.rpc("track_order", { order_id_value: input.id, access_token: input.token });
  if (error) return json({ error: "Could not refresh this order. Please try again." }, 503);
  if (!data) return json({ error: "Order not found. Open the original private order link." }, 404);
  return json({ order: data });
}

export const POST = withApi(handlePOST);
