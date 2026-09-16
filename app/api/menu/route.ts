import { routeClient } from "../../../lib/supabase/route";
import { readJson } from "../../../lib/http";
import { withApi } from "../../../lib/api-server";

async function save(request: Request, editing: boolean) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const input = await readJson(request) as Record<string, any> | null;
  if (!input || typeof input.restaurant_id !== "string" ||
    (editing && typeof input.id !== "string") ||
    typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100 ||
    typeof input.category !== "string" || !input.category.trim() || input.category.trim().length > 60 ||
    !Number.isInteger(input.price) || input.price < 1 || input.price > 100000 ||
    typeof input.is_available !== "boolean" || typeof input.description !== "string" || input.description.length > 1000) {
    return json({ error: "Enter a dish name, category, and whole-rupee price between 1 and 100,000." }, 400);
  }
  const { data: restaurant, error: ownerError } = await client.from("restaurants").select("id")
    .eq("id", input.restaurant_id).eq("owner_id", user.id).maybeSingle();
  if (ownerError || !restaurant) return json({ error: "Restaurant unavailable." }, 404);
  const dish = { name: input.name.trim(), description: input.description.trim(), category: input.category.trim(), price: input.price, is_available: input.is_available };
  const query = editing
    ? client.from("menu_items").update(dish).eq("id", input.id).eq("restaurant_id", restaurant.id)
    : client.from("menu_items").insert({ ...dish, restaurant_id: restaurant.id });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return json({ error: "Could not save the dish." }, 500);
  if (!data) return json({ error: "Dish unavailable. Refresh and try again." }, 404);
  return json({ dish: data }, editing ? 200 : 201);
}

export const POST = withApi((request: Request) => save(request, false));
export const PATCH = withApi((request: Request) => save(request, true));
