import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export function routeClient(request: Request) {
  const response = NextResponse.json({});
  // Constructing a Request from the incoming Request transfers/locks its body.
  // Only copy URL and headers so the route can still read the submitted JSON.
  const cookies = new NextRequest(request.url, { headers: request.headers }).cookies;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: {
      getAll: () => cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } },
  );
  function json(body: unknown, status = 200) {
    const result = NextResponse.json(body, { status, headers: response.headers });
    result.headers.set("Cache-Control", "no-store");
    return result;
  }
  return { client, response, json };
}
