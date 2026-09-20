import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { imageType } from "./media";

export interface StorageService {
  validate(bytes: Uint8Array): string;
  upload(bytes: Buffer): Promise<{ key: string; mime: string }>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  url(assetId: string): string;
}
export class LocalStorageService implements StorageService {
  constructor(private root = process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads")) {}
  validate(bytes: Uint8Array) {
    const mime = imageType(bytes);
    if (!mime) throw new Error("Upload a PNG, JPEG, or WebP image no larger than 3 MB.");
    return mime;
  }
  private filename(key: string) {
    if (!/^local\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) throw new Error("Invalid storage key.");
    return path.join(this.root, key.slice(6));
  }
  async upload(bytes: Buffer) {
    const mime = this.validate(bytes);
    const key = `local/${randomUUID()}.${mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp"}`;
    await mkdir(this.root, { recursive: true });
    await writeFile(this.filename(key), bytes, { flag: "wx" });
    return { key, mime };
  }
  read(key: string) { return readFile(this.filename(key)); }
  async delete(key: string) {
    try { await unlink(this.filename(key)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  url(assetId: string) { return `/api/media/${encodeURIComponent(assetId)}`; }
}

/** Private bucket access is server-only; API routes enforce restaurant visibility/ownership first. */
export class SupabaseStorageService implements StorageService {
  private client?: SupabaseClient;
  constructor(client?: SupabaseClient, private bucket = process.env.SUPABASE_STORAGE_BUCKET || "restaurant-images") { this.client = client; }
  private files() {
    if (!this.client) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Supabase image storage requires a URL and server-only service role key.");
      this.client = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});
    }
    return this.client.storage.from(this.bucket);
  }
  validate(bytes: Uint8Array) {
    const mime = imageType(bytes);
    if (!mime) throw new Error("Upload a PNG, JPEG, or WebP image no larger than 3 MB.");
    return mime;
  }
  private filename(key: string) {
    if (!/^supabase\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key)) throw new Error("Invalid storage key.");
    return key.slice(9);
  }
  async upload(bytes: Buffer) {
    const mime = this.validate(bytes);
    const name = randomUUID() + (mime === "image/jpeg" ? ".jpg" : mime === "image/png" ? ".png" : ".webp");
    const {error} = await this.files().upload(name, bytes, {contentType:mime,upsert:false});
    if (error) throw new Error("Could not upload image to Supabase Storage.");
    return {key:"supabase/"+name,mime};
  }
  async read(key: string) {
    const name = this.filename(key);
    const {data,error} = await this.files().download(name);
    if (error || !data) throw new Error("Could not read stored image.");
    return Buffer.from(await data.arrayBuffer());
  }
  async delete(key: string) {
    const name = this.filename(key);
    const {error} = await this.files().remove([name]);
    if (error) throw new Error("Could not delete stored image.");
  }
  url(assetId: string) { return `/api/media/${encodeURIComponent(assetId)}`; }
}
export class RoutedStorageService implements StorageService {
  constructor(private local:StorageService, private remote:StorageService, private provider=process.env.STORAGE_PROVIDER || "local") {
    if (!["local","supabase"].includes(provider)) throw new Error("STORAGE_PROVIDER must be local or supabase.");
  }
  private destination(key:string) {
    if (key.startsWith("local/")) return this.local;
    if (key.startsWith("supabase/")) return this.remote;
    throw new Error("Invalid storage key.");
  }
  validate(bytes:Uint8Array) { return this.local.validate(bytes); }
  upload(bytes:Buffer) { return (this.provider === "supabase" ? this.remote : this.local).upload(bytes); }
  read(key:string) { return this.destination(key).read(key); }
  delete(key:string) { return this.destination(key).delete(key); }
  url(assetId:string) { return this.local.url(assetId); }
}
export const storage: StorageService = new RoutedStorageService(new LocalStorageService(), new SupabaseStorageService());
