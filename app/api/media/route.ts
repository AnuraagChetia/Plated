import { withApi } from "../../../lib/api-server";
import { routeClient } from "../../../lib/supabase/route";
import { readBytes } from "../../../lib/http";
import { MAX_IMAGE_BYTES } from "../../../lib/media";
import { UUID } from "../../../lib/orders";
import { storage } from "../../../lib/storage";

async function change(request: Request, remove: boolean) {
  const { client, json } = routeClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return json({ error: "Please sign in." }, 401);
  const params = new URL(request.url).searchParams;
  const restaurantId = params.get("restaurant") || "", kind = params.get("kind") || "", dishId = params.get("dish");
  if (!UUID.test(restaurantId) || !["logo", "cover", "menu_item"].includes(kind) ||
    (kind === "menu_item" && (!dishId || !UUID.test(dishId)))) return json({ error: "Choose a valid image location." }, 400);
  const { data: owner } = await client.from("restaurants").select("id").eq("id", restaurantId).eq("owner_id", user.id).maybeSingle();
  if (!owner) return json({ error: "Restaurant unavailable." }, 404);
  if (kind === "menu_item") {
    const { data: dish } = await client.from("menu_items").select("id").eq("id", dishId!).eq("restaurant_id", restaurantId).maybeSingle();
    if (!dish) return json({ error: "Dish unavailable." }, 404);
  }
  let query = client.from("media_assets").select("id,storage_path").eq("restaurant_id", restaurantId).eq("kind", kind);
  if (kind === "menu_item") query = query.eq("menu_item_id", dishId!);
  const { data: existing, error: lookupError } = await query.order("created_at", { ascending: false });
  if (lookupError) return json({ error: "Could not load the current image." }, 503);
  const assets = existing || [];
  let cleanupFailed = false;
  async function cleanFiles(rows: typeof assets) {
    for (const row of rows) if (row.storage_path !== "database") {
      for (let attempt=0; attempt<3; attempt++) {
        try { await storage.delete(row.storage_path); break; }
        catch { if(attempt===2){cleanupFailed=true;console.error("Could not clean up an old image file.");} }
      }
    }
  }
  if (remove) {
    // Remove older associations too, so they cannot reappear as the current image.
    for (const asset of [...assets].reverse()) {
      const { data, error } = await client.from("media_assets").delete().eq("id", asset.id).eq("storage_path", asset.storage_path).select("id").maybeSingle();
      if (error || !data) return json({ error: "The image changed. Refresh and try again." }, 409);
      await cleanFiles([asset]);
    }
    return json({ media: null, ...(cleanupFailed ? {warning:"Image removed from the storefront, but its stored file could not be deleted. Please retry storage cleanup."} : {}) });
  }
  const bytes = await readBytes(request, MAX_IMAGE_BYTES);
  try { if (!bytes) throw new Error(); storage.validate(bytes); }
  catch { return json({ error: "Upload a PNG, JPEG, or WebP image no larger than 3 MB." }, 400); }
  const uploaded = await storage.upload(bytes!);
  const values = { restaurant_id: restaurantId, kind, menu_item_id: kind === "menu_item" ? dishId : null,
    storage_path: uploaded.key, mime_type: uploaded.mime, content_base64: null, alt_text: "" };
  const mutation = assets[0]
    ? client.from("media_assets").update(values).eq("id", assets[0].id).eq("storage_path", assets[0].storage_path)
    : client.from("media_assets").insert(values);
  const { data, error } = await mutation.select("id,kind,alt_text,menu_item_id").maybeSingle();
  if (error || !data) {
    await storage.delete(uploaded.key);
    return json({ error: "Could not save the image. Refresh and retry; the restaurant supports up to 30 images." }, 409);
  }
  await cleanFiles(assets.slice(0, 1));
  // Remove historical duplicates so their files cannot accumulate or reappear.
  for(const asset of assets.slice(1)){
    const {data:removed,error:removeError}=await client.from("media_assets").delete().eq("id",asset.id).eq("storage_path",asset.storage_path).select("id").maybeSingle();
    if(removeError){cleanupFailed=true;continue;}
    if(removed)await cleanFiles([asset]);
  }
  return json({ media: data, url: storage.url(data.id), ...(cleanupFailed ? {warning:"Image saved, but an older image could not be removed from storage. Please contact the restaurant administrator."} : {}) });
}
export const POST = withApi((request: Request) => change(request, false));
export const DELETE = withApi((request: Request) => change(request, true));
