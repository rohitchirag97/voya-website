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

export type StaffRole = "SUPPORT" | "MODERATOR" | "ADMIN" | "OWNER";
export type Me = { userId: string; displayName: string | null; publicId: number; staffRole: StaffRole | null };

export const getMe = () => api<Me>("GET", "/me").catch(() => null);

// For pages: the signed-in user, or off to /login.
export async function requireMe() {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}

export const isStaff = (me: Me) => me.staffRole === "OWNER" || me.staffRole === "ADMIN";

export async function sellerStatus() {
  return (await api<{ status: "PENDING" | "APPROVED" | "REJECTED" | null }>("GET", "/coin-sellers/me").catch(() => ({ status: null }))).status;
}
