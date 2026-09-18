import {validHours} from "../../../lib/hours";
import { withApi } from "../../../lib/api-server";
import {
  restaurantValidationError,
  validRestaurantPhone,
  storefrontSlug,
  validStorefrontSlug,
} from "../../../lib/restaurant-validation";
import { routeClient } from "../../../lib/supabase/route";
import { readJson } from "../../../lib/http";
import { databaseMessage } from "../../../lib/api-server";

async function handleGET(request: Request) {
  const { client, json } = routeClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const { data, error } = await client
    .from("restaurants")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return error
    ? json({ error: "Could not load your restaurant." }, 500)
    : json({ restaurant: data });
}

async function handlePOST(request: Request) {
  const { client, json } = routeClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return json({ error: "Please sign in to create a restaurant." }, 401);
  const input = (await readJson(request)) as Record<string, any> | null;
  const validation = restaurantValidationError(input);
  if (validation)
    return json({ error: validation.message, step: validation.step }, 400);
  if (!input) return json({ error: "Enter your restaurant details." }, 400);
  const { data, error } = await client.rpc("setup_restaurant", {
    restaurant_name: input.name.trim(),
    restaurant_slug: input.slug,
    restaurant_description: input.description.trim(),
    restaurant_theme: "saffron", // Required by the existing database function; the UI uses one design.
    dish_name: input.dishName.trim(),
    dish_price: input.dishPrice,
    pickup_address_value: input.pickupAddress.trim(),
    phone_value: input.contactPhone.trim(),
  });
  if (error)
    return json(
      {
        error:
          error.code === "23505"
            ? "That storefront address is taken. Choose another address."
            : databaseMessage(
                error,
                "Could not create your restaurant. Please try again.",
              ),
      },
      error.code === "23505" ? 409 : 503,
    );
  const restaurant = Array.isArray(data) ? data[0] : data;
  if (!restaurant?.id)
    return json(
      {
        error:
          "The database did not confirm the restaurant launch. Please retry.",
      },
      503,
    );
  return json({ restaurant }, 201);
}

async function handlePATCH(request: Request) {
  const { client, json } = routeClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const input = (await readJson(request)) as Record<string, any> | null;
  if (
    !input ||
    typeof input.id !== "string" ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100 ||
    typeof input.description !== "string" ||
    !input.description.trim() ||
    input.description.length > 1000 ||
    typeof input.pickup_address !== "string" ||
    input.pickup_address.length > 500 ||
    !validRestaurantPhone(input.contact_phone) ||
    ![
      input.accepts_pickup,
      input.accepts_delivery,
      input.accepting_orders,
      input.is_published,
    ].every((value) => typeof value === "boolean") ||
    (!input.accepts_pickup && !input.accepts_delivery) ||
    (input.accepts_pickup && input.pickup_address.trim().length < 10) ||
    !Number.isInteger(input.estimated_minutes) ||
    input.estimated_minutes < 5 ||
    input.estimated_minutes > 180
  )
    return json(
      {
        error:
          "Check the restaurant details, phone, fulfillment options, and preparation time.",
      },
      400,
    );
  const hoursSupplied = input.opens_at !== undefined || input.closes_at !== undefined || input.timezone !== undefined;
  if(hoursSupplied && !validHours(input.opens_at,input.closes_at,input.timezone)) return json({error:"Choose distinct opening and closing times and a valid timezone, or disable scheduled hours."},400);
  const { data: current, error: lookupError } = await client.from("restaurants")
    .select("name, slug").eq("id", input.id).eq("owner_id", user.id).maybeSingle();
  if (lookupError) return json({ error: "Could not load restaurant settings." }, 503);
  if (!current) return json({ error: "Restaurant not found." }, 404);
  const renamed = input.name.trim() !== current.name;
  const slug = renamed && (input.slug === undefined || input.slug === current.slug)
    ? storefrontSlug(input.name) : input.slug === undefined ? current.slug : input.slug;
  if (!validStorefrontSlug(slug)) return json({ error: "Enter a storefront address using lowercase letters, numbers, and single hyphens (up to 80 characters)." }, 400);
  const { data, error } = await client
    .from("restaurants")
    .update({
      slug,
      ...(hoursSupplied ? {opens_at:input.opens_at,closes_at:input.closes_at,timezone:input.timezone} : {}),
      name: input.name.trim(),
      description: input.description.trim(),
      pickup_address: input.pickup_address.trim(),
      contact_phone: input.contact_phone.trim(),
      accepts_pickup: input.accepts_pickup,
      accepts_delivery: input.accepts_delivery,
      accepting_orders: input.accepting_orders,
      is_published: input.is_published,
      estimated_minutes: input.estimated_minutes,
    })
    .eq("id", input.id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505") return json({ error: "That storefront address is taken. Choose another address." }, 409);
  if (error || !data)
    return json({ error: "Could not save restaurant settings." }, 400);
  return json({ ok: true, slug });
}

export const GET = withApi(handleGET);

export const POST = withApi(handlePOST);

export const PATCH = withApi(handlePATCH);
