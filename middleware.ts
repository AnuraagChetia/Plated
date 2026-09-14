import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "./lib/auth";
export async function middleware(request: NextRequest) { if (request.nextUrl.pathname.startsWith("/dashboard") && !(await readSession(request.cookies.get(SESSION_COOKIE)?.value))) return NextResponse.redirect(new URL("/sign-in", request.url)); return NextResponse.next(); }
export const config = { matcher: ["/dashboard/:path*"] };
