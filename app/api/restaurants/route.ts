import { withApi } from "../../../lib/api-server";
import { restaurantValidationError, validRestaurantPhone } from "../../../lib/restaurant-validation";
import { routeClient } from "../../../lib/supabase/route";
import { readJson } from "../../../lib/http";
import { databaseMessage } from "../../../lib/api-server";

async function handleGET(request: Request) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data, error } = await client.from("restaurants").select("*")
    .eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  return error ? json({ error: "Could not load your restaurant." }, 500) : json({ restaurant: data });
}

async function handlePOST(request: Request) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in to create a restaurant." }, 401);
  const input = await readJson(request) as Record<string, any> | null;
  const validation = restaurantValidationError(input);
  if (validation) return json({ error: validation.message, step: validation.step }, 400);
  if (!input) return json({ error: "Enter your restaurant details." }, 400);
  const { data, error } = await client.rpc("setup_restaurant", {
    restaurant_name: input.name.trim(), restaurant_slug: input.slug,
    restaurant_description: input.description.trim(), restaurant_theme: input.theme,
    dish_name: input.dishName.trim(), dish_price: input.dishPrice,
    pickup_address_value: input.pickupAddress.trim(), phone_value: input.contactPhone.trim(),
  });
  if (error) return json({ error: error.code === "23505"
    ? "That storefront address is taken. Choose another address."
    : databaseMessage(error,"Could not create your restaurant. Please try again.") }, error.code === "23505" ? 409 : 503);
  const restaurant = Array.isArray(data) ? data[0] : data;
  if (!restaurant?.id) return json({error:"The database did not confirm the restaurant launch. Please retry."},503);
  return json({ restaurant }, 201);
}

async function handlePATCH(request: Request) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." },401);
  const input = await readJson(request) as Record<string, any> | null;
  if (!input || typeof input.id !== "string" || typeof input.name !== "string" || !input.name.trim() || input.name.length > 100 ||
    typeof input.description !== "string" || !input.description.trim() || input.description.length > 1000 ||
    !["saffron","olive"].includes(input.theme) || typeof input.pickup_address !== "string" || input.pickup_address.length > 500 ||
    !validRestaurantPhone(input.contact_phone) ||
    ![input.accepts_pickup,input.accepts_delivery,input.accepting_orders,input.is_published].every(value => typeof value === "boolean") ||
    (!input.accepts_pickup && !input.accepts_delivery) || (input.accepts_pickup && input.pickup_address.trim().length < 10) ||
    !Number.isInteger(input.estimated_minutes) || input.estimated_minutes < 5 || input.estimated_minutes > 180) return json({ error:"Check the restaurant details, phone, fulfillment options, and preparation time." },400);
  const { data, error } = await client.from("restaurants").update({ name:input.name.trim(), description:input.description.trim(), theme:input.theme,
    pickup_address:input.pickup_address.trim(), contact_phone:input.contact_phone.trim(), accepts_pickup:input.accepts_pickup,
    accepts_delivery:input.accepts_delivery, accepting_orders:input.accepting_orders, is_published:input.is_published, estimated_minutes:input.estimated_minutes })
    .eq("id",input.id).eq("owner_id",user.id).select("id").maybeSingle();
  if (error || !data) return json({ error:"Could not save restaurant settings." },400);
  return json({ ok:true });
}

export const GET = withApi(handleGET);

export const POST = withApi(handlePOST);

export const PATCH = withApi(handlePATCH);
