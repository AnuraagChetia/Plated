export async function readBytes(request: Request, maximum: number): Promise<Buffer | null> {
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    const reader = request.body?.getReader();
    if (!reader) return null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch { return null; }
}

export async function readJson(request: Request, maximum = 20000): Promise<unknown> {
  const bytes = await readBytes(request, maximum);
  try { return bytes ? JSON.parse(bytes.toString("utf8")) : null; } catch { return null; }
}
