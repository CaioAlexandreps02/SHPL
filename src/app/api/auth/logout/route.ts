import { NextResponse } from "next/server";

import { AUTH_COOKIE, getAuthCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(AUTH_COOKIE, "", {
    ...getAuthCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
