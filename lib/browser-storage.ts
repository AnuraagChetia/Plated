export function readStored(key: string): unknown {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; } catch { return null; }
}
export function writeStored(key: string, value: unknown): boolean {
  try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; }
}
export function removeStored(key: string): void {
  try { localStorage.removeItem(key); } catch { /* A saved retry can still safely recover its receipt. */ }
}
