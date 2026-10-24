// Session cookies, shared by the proxy (refresh) and server actions (sign in / out). httpOnly: the browser JS never sees tokens.
export const ACCESS = "voya_at";
export const REFRESH = "voya_rt";

export type Tokens = { accessToken: string; refreshToken: string; accessTokenExpiresAt: number };

type CookieJar = { set(name: string, value: string, options: object): unknown };

export function setTokens(jar: CookieJar, t: Tokens, secure: boolean) {
  const base = { httpOnly: true, sameSite: "lax", secure, path: "/" };
  jar.set(ACCESS, t.accessToken, { ...base, expires: new Date(t.accessTokenExpiresAt * 1000) });
  jar.set(REFRESH, t.refreshToken, { ...base, maxAge: 30 * 24 * 3600 }); // the server's refresh lifetime
}

// Seconds-since-epoch expiry from a JWT, without verifying it (the API does that).
export function expiresAt(jwt: string | undefined) {
  try {
    return JSON.parse(atob(jwt!.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))).exp as number;
  } catch {
    return 0;
  }
}
