import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
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
    if (!mime) throw new Error("Upload a PNG, JPEG, or WebP image no larger than 2 MB.");
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
export const storage: StorageService = new LocalStorageService();
