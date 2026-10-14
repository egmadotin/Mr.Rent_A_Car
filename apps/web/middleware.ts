import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Cheap edge check: no session cookie → straight to the ERP login.
 * The (app) layout re-validates the session and staff role on the server.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!getSessionCookie(request)) {
    const url = new URL("/admin/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
