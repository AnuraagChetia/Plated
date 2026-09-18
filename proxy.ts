import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // API handlers validate their own sessions and return JSON on every error path.
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  try {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      } },
    );
    const { data: { user }, error } = await client.auth.getUser();
    const protectedPage = /^\/(dashboard|onboarding|profile)(\/|$)/.test(request.nextUrl.pathname);
    const invalidSession = error && (error.name === "AuthSessionMissingError" || error.status === 400 || error.status === 401 || ["refresh_token_not_found","refresh_token_already_used","session_not_found","bad_jwt"].includes(error.code || ""));
    if (error && !invalidSession && protectedPage) throw error;
    if (!user && protectedPage) {
      const target = new URL("/sign-in", request.url);
      const store=request.nextUrl.searchParams.get("store");if(store)target.searchParams.set("store",store);
      const redirect = NextResponse.redirect(target);
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      return redirect;
    }
    return response;
  } catch {
    if (!/^\/(dashboard|onboarding|profile)(\/|$)/.test(request.nextUrl.pathname)) return response;
    const target=new URL("/auth-unavailable",request.url);
    target.searchParams.set("next",request.nextUrl.pathname+request.nextUrl.search);
    const redirect=NextResponse.redirect(target);response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));redirect.headers.set("Cache-Control","no-store");return redirect;
  }
}
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };
