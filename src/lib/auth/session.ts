export const AUTH_COOKIE = "shpl_session";

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
