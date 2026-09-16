import { withApi } from "../../../lib/api-server";
import { routeClient } from "../../../lib/supabase/route";
import { UUID } from "../../../lib/orders";
import { readJson } from "../../../lib/http";

async function handlePOST(request: Request) {
  const { client, json } = routeClient(request);
  const input = await readJson(request) as { id?: string; token?: string; rating?: number; comment?: string } | null;
  if (!input || typeof input.id !== "string" || !UUID.test(input.id) || typeof input.token !== "string" || !UUID.test(input.token) ||
    !Number.isInteger(input.rating) || input.rating! < 1 || input.rating! > 5 || typeof input.comment !== "string" || input.comment.length > 2000) return json({ error: "Choose a rating from 1 to 5 and keep your comment under 2,000 characters." }, 400);
  const { data, error } = await client.rpc("submit_review", { order_id_value: input.id, access_token: input.token, score: input.rating, feedback: input.comment });
  if (error) return json({ error: "Reviews are available after your order is completed." }, error.code === "42501" ? 403 : 400);
  return json({ reviewId: data }, 201);
}

async function handlePATCH(request: Request) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const input = await readJson(request) as { id?: string; reply?: string } | null;
  if (!input || typeof input.id !== "string" || !UUID.test(input.id) || typeof input.reply !== "string" || input.reply.length > 1000) return json({ error: "Keep your reply under 1,000 characters." }, 400);
  const { data, error } = await client.from("reviews").update({ owner_reply: input.reply.trim() || null }).eq("id", input.id).select("id").maybeSingle();
  if (error || !data) return json({ error: "Could not save your reply." }, 400);
  return json({ ok: true });
}

export const POST = withApi(handlePOST);

export const PATCH = withApi(handlePATCH);
