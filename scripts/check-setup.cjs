const { createClient } = require("@supabase/supabase-js");

async function main() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error("Set both Supabase variables in .env.local.");
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const checks = [
    [
      "restaurants",
      "id,pickup_address,contact_phone,accepts_pickup,accepts_delivery,accepting_orders,estimated_minutes",
    ],
    [
      "orders",
      "id,customer_phone,fulfillment,client_request_id,tracking_token",
    ],
    ["order_items", "id,unit_price,quantity"],
    ["reviews", "id,owner_reply"],
    ["media_assets", "id,content_base64,mime_type,menu_item_id"],
  ];
  const results = await Promise.all(
    checks.map(async ([table, columns]) => {
      const { error } = await client.from(table).select(columns).limit(0);
      const protectedTable = table === "order_items" && error?.code === "42501";
      console.log(
        `${protectedTable ? "PROTECTED (expected)" : error ? "MISSING/UNREACHABLE" : "OK"}: ${table}${error && !protectedTable ? ` (${error.code || "connection error"})` : ""}`,
      );
      return !error || protectedTable;
    }),
  );
  if (results.some((ready) => !ready)) {
    console.error(
      "Apply unapplied migrations in numeric order through 0004, then rerun this check. No database data was changed.",
    );
    process.exitCode = 1;
  } else
    console.log(
      "Required database columns are present. No database data was changed.",
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
