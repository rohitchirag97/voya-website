import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS } from "./session";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// Calls the VoyaLive API from the server with the signed-in user's token.
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = (await cookies()).get(ACCESS)?.value;
  const form = body instanceof FormData; // file uploads go as multipart; fetch sets the boundary
  const res = await fetch(`${process.env.API_URL}/v1${path}`, {
    method,
    headers: { ...(!form && { "content-type": "application/json" }), ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error?.code ?? "ERROR", data.error?.message ?? `Request failed (${res.status})`);
  return data as T;
}

// A staff role id ("OWNER", or a role made in Roles); permissions: the role's access switches (server lib/permissions.ts).
export type StaffRole = string;
export type Me = { userId: string; displayName: string | null; publicId: number; staffRole: StaffRole | null; permissions: string[] };

export const getMe = () => api<Me>("GET", "/me").catch(() => null);

// For pages: the signed-in user, or off to /login.
export async function requireMe() {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}

// Whether this user's role has a switch (pages redirect away otherwise; the API checks again on every action).
// The owner can always do everything, even if the server hasn't sent the list.
export const can = (me: Me, perm: string) => me.staffRole === "OWNER" || (me.permissions ?? []).includes(perm);

export async function sellerStatus() {
  return (await api<{ status: "PENDING" | "APPROVED" | "REJECTED" | null }>("GET", "/coin-sellers/me").catch(() => ({ status: null }))).status;
}
