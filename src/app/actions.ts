"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { ACCESS, REFRESH, setTokens, type Tokens } from "@/lib/session";

// Every action re-checks nothing itself: the API enforces who may do what. These only shape requests and messages.

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const amount = (f: FormData) => Number(str(f, "amount").replace(/[, ]/g, ""));
// Only same-site paths, so a crafted form can't bounce users elsewhere.
const backTo = (f: FormData, fallback: string) => {
  const b = str(f, "back");
  return b.startsWith("/") && !b.startsWith("//") ? b : fallback;
};
const withMsg = (path: string, key: "ok" | "error", msg: string) => {
  const u = new URL(path, "http://x");
  u.searchParams.delete("ok");
  u.searchParams.delete("error");
  u.searchParams.set(key, msg);
  return u.pathname + u.search;
};

// Runs an API call and returns to the page with a success or error message. redirect() must stay outside the try.
async function run(back: string, fn: () => Promise<string>) {
  let to: string;
  try {
    to = withMsg(back, "ok", await fn());
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 401) redirect("/login");
    to = withMsg(back, "error", friendly(e));
  }
  redirect(to);
}

// API messages written for people pass through; technical ones (validation dumps, bare codes) get a plain sentence.
const FRIENDLY: Record<string, string> = {
  VALIDATION_ERROR: "Please check what you entered. Amounts must be whole numbers from 1 to 1,00,00,000.",
  USER_NOT_FOUND: "We couldn’t find that user. Check the ID or name and try again.",
  FORBIDDEN: "Your account isn’t allowed to do that.",
  RATE_LIMITED: "Too many attempts in a short time. Wait a minute and try again.",
  INTERNAL: "Something went wrong on our side. Nothing was changed. Please try again.",
};
const friendly = (e: ApiError) => FRIENDLY[e.code] ?? (e.message === e.code || /^[A-Z_]+$/.test(e.message) ? "That didn’t work. Please try again." : e.message);

const fmt = (n: number) => n.toLocaleString("en-IN");

// ---------- sign in / out ----------

async function signedIn(tokens: Tokens) {
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  setTokens(await cookies(), tokens, secure);
}

export async function requestOtp(f: FormData) {
  const phone = str(f, "phone").replace(/[\s-]/g, "");
  let to: string;
  try {
    const r = await api<{ devCode?: string }>("POST", "/auth/otp/request", { phone });
    to = `/login?phone=${encodeURIComponent(phone)}${r.devCode ? `&dev=${r.devCode}` : ""}`;
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    to = `/login?error=${encodeURIComponent(e.message)}`;
  }
  redirect(to);
}

export async function verifyOtp(f: FormData) {
  const phone = str(f, "phone");
  try {
    await signedIn(await api<Tokens>("POST", "/auth/otp/verify", { phone, code: str(f, "code") }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    redirect(`/login?phone=${encodeURIComponent(phone)}&error=${encodeURIComponent(e.message)}`);
  }
  redirect("/dashboard");
}

// Called by the Google button with the ID token Google gave the browser.
export async function googleSignIn(idToken: string) {
  try {
    await signedIn(await api<Tokens>("POST", "/auth/google", { idToken }));
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return e.message;
  }
  redirect("/dashboard");
}

export async function logout() {
  await api("POST", "/auth/logout").catch(() => {});
  const jar = await cookies();
  jar.delete(ACCESS);
  jar.delete(REFRESH);
  redirect("/login");
}

// ---------- staff ----------

export async function setStaffRole(f: FormData) {
  const role = str(f, "role") || null;
  await run(backTo(f, "/admin"), async () => {
    await api("POST", `/admin/users/${str(f, "userId")}/staff-role`, { role });
    return role === "OWNER" ? "Ownership handed over. You are now an admin." : `Role set to ${role ?? "regular user"}`;
  });
}

// Empty specialId removes it.
export async function setSpecialId(f: FormData) {
  const specialId = str(f, "specialId") || null;
  await run(backTo(f, "/admin"), async () => {
    await api("POST", `/admin/users/${str(f, "userId")}/special-id`, { specialId });
    return specialId ? `Special ID ${specialId} given` : "Special ID removed";
  });
}

export async function decideSeller(f: FormData) {
  const approve = str(f, "approve") === "true";
  await run(backTo(f, "/admin/sellers"), async () => {
    await api("POST", `/admin/coin-sellers/${str(f, "userId")}/decision`, { approve });
    return approve ? "Coin seller approved" : "Coin seller revoked";
  });
}

export async function mintCoins(f: FormData) {
  await run(backTo(f, "/admin/sellers"), async () => {
    const r = await api<{ balance: number }>("POST", `/admin/coin-sellers/${str(f, "userId")}/mint`, { amount: amount(f), idempotencyKey: str(f, "key") });
    return `Added ${fmt(amount(f))} coins. Seller wallet: ${fmt(r.balance)}`;
  });
}

// ---------- seller ----------

export async function sellCoins(f: FormData) {
  await run("/seller", async () => {
    const r = await api<{ balance: number; to: { displayName: string | null; publicId: number } }>("POST", "/coin-sellers/wallet/sell", {
      to: str(f, "to"),
      amount: amount(f),
      idempotencyKey: str(f, "key"),
    });
    return `Sent ${fmt(amount(f))} coins to ${r.to.displayName ?? r.to.publicId}. Seller wallet: ${fmt(r.balance)}`;
  });
}

export async function addSubSeller(f: FormData) {
  await run("/seller", async () => {
    await api("POST", "/coin-sellers/sub-sellers", { user: str(f, "user") });
    return "Sub seller added";
  });
}

export async function topUpSubSeller(f: FormData) {
  await run("/seller", async () => {
    const r = await api<{ balance: number }>("POST", `/coin-sellers/sub-sellers/${str(f, "userId")}/topup`, { amount: amount(f), idempotencyKey: str(f, "key") });
    return `Sent ${fmt(amount(f))} coins to the sub seller. Your seller wallet: ${fmt(r.balance)}`;
  });
}

export async function removeSubSeller(f: FormData) {
  await run("/seller", async () => {
    const r = await api<{ returned: number }>("DELETE", `/coin-sellers/sub-sellers/${str(f, "userId")}`);
    return `Sub seller removed. ${fmt(r.returned)} coins came back to your seller wallet.`;
  });
}
