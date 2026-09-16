import { withApi } from "../../../lib/api-server";
import { routeClient } from "../../../lib/supabase/route";
import { nextStatus, parseOrder, UUID } from "../../../lib/orders";
import { readJson } from "../../../lib/http";
import { databaseMessage } from "../../../lib/api-server";

async function handlePOST(request: Request) {
  const { client, json } = routeClient(request);
  const input = parseOrder(await readJson(request));
  if (!input) return json({ error: "Check your contact details, fulfillment option, and cart." }, 400);
  const { data, error } = await client.rpc("checkout_order", {
    restaurant_slug: input.slug, diner_name: input.customerName, cart: input.items,
    checkout: input.checkout, request_key: input.requestId,
  });
  if (error) {
    if (error.code === "P0429") return json({ error: "Too many orders for this phone number. Try again in ten minutes." }, 429);
    if (error.code === "22000") return json({ error: "This checkout was already submitted with different details." }, 409);
    if (error.code === "22023") return json({ error: "The cart or fulfillment option is unavailable. Refresh the menu and check your details." }, 400);
    return json({ error: databaseMessage(error,"We couldn’t confirm your order. Retry with the same details to check it safely.") }, 503);
  }
  return json({ order: data }, 201);
}

async function handlePATCH(request: Request) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const input = await readJson(request) as { id?: string; status?: string; previous?: string } | null;
  if (!input || typeof input.id !== "string" || !UUID.test(input.id) || typeof input.previous !== "string" ||
    !(input.previous in nextStatus) || (input.status !== nextStatus[input.previous] && input.status !== "CANCELLED")) {
    return json({ error: "Choose a valid order status." }, 400);
  }
  const { data, error } = await client.from("orders").update({ status: input.status })
    .eq("id", input.id).eq("status", input.previous).select("id,status").maybeSingle();
  if (error) return json({ error: "Could not update this order." }, 400);
  if (!data) return json({ error: "The order changed or is unavailable. Refresh and try again." }, 409);
  return json({ order: data });
}

export const POST = withApi(handlePOST);

export const PATCH = withApi(handlePATCH);
