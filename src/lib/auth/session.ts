export const AUTH_COOKIE = "shpl_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function createSessionValue(email: string) {
  return Buffer.from(
    JSON.stringify({
      email,
      issuedAt: Date.now(),
    })
  ).toString("base64url");
}

export function readSessionValue(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      email: string;
      issuedAt: number;
    };
  } catch {
    return null;
  }
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE_SECONDS,
  };
}
