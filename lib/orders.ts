export type CartLine = { id: string; quantity: number };
export type Checkout = { phone: string; fulfillment: "PICKUP" | "DELIVERY"; address: string; notes: string };
export type OrderInput = { slug: string; customerName: string; items: CartLine[]; requestId: string; checkout: Checkout };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
export const nextStatus: Record<string, string> = { NEW: "PREPARING", PREPARING: "READY", READY: "COMPLETED" };

export function parseOrder(value: unknown): OrderInput | null {
  if (!value || typeof value !== "object") return null;
  const { slug, customerName, items, requestId, checkout } = value as Record<string, unknown>;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  if (typeof customerName !== "string" || !customerName.trim() || customerName.trim().length > 100) return null;
  if (typeof requestId !== "string" || !UUID.test(requestId)) return null;
  if (!checkout || typeof checkout !== "object") return null;
  const details = checkout as Record<string, unknown>;
  if (typeof details.phone !== "string" || !/^[+0-9 ()-]+$/.test(details.phone)) return null;
  const phone = details.phone.replace(/\D/g, "");
  if (!/^[0-9]{7,15}$/.test(phone) || !["PICKUP", "DELIVERY"].includes(String(details.fulfillment))) return null;
  if (typeof details.address !== "string" || details.address.length > 500 || (details.fulfillment === "DELIVERY" && details.address.trim().length < 10)) return null;
  if (typeof details.notes !== "string" || details.notes.length > 500) return null;
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return null;
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !UUID.test(item.id) ||
      !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || seen.has(item.id.toLowerCase())) return null;
    seen.add(item.id.toLowerCase());
  }
  return { slug, customerName: customerName.trim(), requestId: requestId.toLowerCase(),
    checkout: { phone, fulfillment: details.fulfillment as Checkout["fulfillment"], address: details.fulfillment === "DELIVERY" ? details.address.trim() : "", notes: details.notes.trim() },
    items: items.map(({ id, quantity }) => ({ id: id.toLowerCase(), quantity })).sort((a,b) => a.id.localeCompare(b.id)) };
}

export function restoreCart(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, quantity]) =>
    UUID.test(id) && Number.isInteger(quantity) && Number(quantity) > 0 && Number(quantity) <= 99).slice(0,50));
}
