import { withApi } from "../../../../lib/api-server";
import { routeClient } from "../../../../lib/supabase/route";
import { imageType } from "../../../../lib/media";
import { UUID } from "../../../../lib/orders";
import { storage } from "../../../../lib/storage";

async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, json, response } = routeClient(request);
  if (!UUID.test(id)) return json({ error: "Image not found." }, 404);
  const { data, error } = await client.from("media_assets").select("storage_path,content_base64,mime_type").eq("id",id).maybeSingle();
  if (error || !data) return json({ error: "Image not found." }, 404);
  let bytes: Buffer;
  try {
    bytes = data.content_base64 ? Buffer.from(data.content_base64, "base64") : await storage.read(data.storage_path);
  } catch { return json({ error: "Image not found." }, 404); }
  const mime = imageType(bytes);
  if (!mime || mime !== data.mime_type) return json({ error: "Image unavailable." }, 404);
  const headers = new Headers(response.headers);
  headers.set("Content-Type", mime);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(bytes, { headers });
}

export const GET = withApi(handleGET);
