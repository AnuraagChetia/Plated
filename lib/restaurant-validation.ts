export function storefrontSlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,80).replace(/-$/, "");
}

export function validStorefrontSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value);
}

export function validRestaurantPhone(value: unknown): value is string {
  return typeof value === "string" && /^\+?[0-9 ()-]+$/.test(value.trim()) &&
    /^[0-9]{7,15}$/.test(value.replace(/\D/g, "")) && value.trim().length <= 25;
}

export function restaurantValidationError(input: Record<string, unknown> | null, step?: number): { message: string; step: number } | null {
  const text = (value: unknown, min: number, max: number) => typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
  if (!input) return { message: "Enter your restaurant details.", step: 0 };
  if (step === undefined || step === 0) {
    if (!text(input.name, 1, 100)) return { message: "Enter a restaurant name between 1 and 100 characters.", step: 0 };
    if (!validStorefrontSlug(input.slug)) return { message: "Use lowercase letters, numbers, and single hyphens or underscores in the storefront address (up to 80 characters).", step: 0 };
    if (!text(input.description, 1, 1000)) return { message: "Enter a restaurant description between 1 and 1,000 characters.", step: 0 };
    if (!text(input.pickupAddress, 10, 500)) return { message: "Enter a complete pickup address between 10 and 500 characters.", step: 0 };
    if (!validRestaurantPhone(input.contactPhone)) return { message: "Enter a restaurant phone number with 7–15 digits. Spaces, parentheses, hyphens, and a leading + are allowed; letters are not.", step: 0 };
  }
  if (step === undefined || step === 1) {
    if (!text(input.dishName, 1, 100)) return { message: "Enter a dish name between 1 and 100 characters.", step: 1 };
    if (typeof input.dishPrice !== "number" || !Number.isInteger(input.dishPrice) || input.dishPrice < 1 || input.dishPrice > 100000) return { message: "Enter a whole-rupee dish price between ₹1 and ₹100,000.", step: 1 };
  }
  return null;
}
