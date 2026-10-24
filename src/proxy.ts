import { NextResponse, type NextRequest } from "next/server";
import { ACCESS, expiresAt, REFRESH, setTokens, type Tokens } from "./lib/session";

// Keeps the 15-minute access token fresh: when it is missing or about to expire, trade the refresh token for new ones.
// Server Components can't set cookies, so this is the one place that can rotate them before the page renders.
export async function proxy(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH)?.value;
  if (!refreshToken || expiresAt(req.cookies.get(ACCESS)?.value) - 60 > Date.now() / 1000) return NextResponse.next();

  const res = await fetch(`${process.env.API_URL}/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => null);
  // On failure, carry on: the page sees no valid token and sends the user to /login.
  if (!res?.ok) return NextResponse.next();

  const tokens = (await res.json()) as Tokens;
  req.cookies.set(ACCESS, tokens.accessToken); // so this same request renders signed in
  req.cookies.set(REFRESH, tokens.refreshToken);
  const next = NextResponse.next({ request: { headers: req.headers } });
  setTokens(next.cookies, tokens, req.nextUrl.protocol === "https:");
  return next;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
