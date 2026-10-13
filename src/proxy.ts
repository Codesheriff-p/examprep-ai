import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decrypt } from "@/lib/session";

// Optimistic check only: pages and actions still verify the session and ownership.
const PROTECTED = ["/dashboard", "/courses", "/account"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  if (!session && PROTECTED.some((p) => path.startsWith(p))) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (session && AUTH_PAGES.includes(path)) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/courses/:path*", "/account/:path*", "/login", "/signup"],
};
