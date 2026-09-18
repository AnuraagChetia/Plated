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
  const { data: restaurant } = await client.from("restaurants").select("id").eq("slug", data.restaurant_slug).maybeSingle();
  let logoUrl: string | undefined;
  if (restaurant) {
    const { data: logo } = await client.from("media_assets").select("id").eq("restaurant_id", restaurant.id).eq("kind", "logo").order("created_at", { ascending:false }).limit(1).maybeSingle();
    if (logo) logoUrl = "/api/media/" + logo.id;
  }
  return json({ order: { ...data, restaurant_logo_url: logoUrl } });
}

export const POST = withApi(handlePOST);
