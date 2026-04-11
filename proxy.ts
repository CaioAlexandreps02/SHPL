import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE } from "@/lib/auth/session";

const publicRoutes = ["/", "/login", "/signup"];
const publicApiRoutes = ["/api/auth/login", "/api/auth/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(request.cookies.get(AUTH_COOKIE)?.value);
  const isPublicRoute = publicRoutes.includes(pathname);
  const isPublicApiRoute = publicApiRoutes.includes(pathname);

  if (isPublicApiRoute) {
    return NextResponse.next();
  }

  if (isAuthenticated && (pathname === "/" || pathname === "/login")) {
    return NextResponse.redirect(new URL("/menu", request.url));
  }

  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
