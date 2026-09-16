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
    const protectedPage = /^\/(dashboard|onboarding)(\/|$)/.test(request.nextUrl.pathname);
    if (error && error.name !== "AuthSessionMissingError" && protectedPage) throw error;
    if (!user && protectedPage) {
      const redirect = NextResponse.redirect(new URL("/sign-in", request.url));
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      return redirect;
    }
    return response;
  } catch {
    if (!/^\/(dashboard|onboarding)(\/|$)/.test(request.nextUrl.pathname)) return response;
    return new NextResponse("Sign-in is temporarily unavailable. Please reload this page in a moment.", { status:503, headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"} });
  }
}
export const config = { matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"] };
