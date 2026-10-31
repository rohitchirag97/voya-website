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
  CANNOT_BAN_STAFF: "Staff can’t be banned. Remove their staff role first.",
  CANNOT_BAN_SELF: "You can’t ban yourself.",
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

const BAN_LABEL: Record<string, string> = { "24h": "24 hours", "3d": "3 days", "7d": "7 days", "1m": "1 month", "1y": "1 year", life: "life" };

// Ban for a while or for good; they're signed out at once and see the reason and end time when they try to sign in.
export async function banUser(f: FormData) {
  const duration = str(f, "duration");
  await run(backTo(f, "/admin"), async () => {
    await api("POST", `/admin/users/${str(f, "userId")}/ban`, { duration, reason: str(f, "reason") });
    return duration === "life" ? "User banned for life" : `User banned for ${BAN_LABEL[duration] ?? duration}`;
  });
}

export async function unbanUser(f: FormData) {
  await run(backTo(f, "/admin"), async () => {
    await api("POST", `/admin/users/${str(f, "userId")}/unban`);
    return "User unbanned. They can sign in again.";
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

// ---------- agencies ----------

export async function createAgency(f: FormData) {
  await run("/admin/agencies", async () => {
    const a = await api<{ name: string; code: number }>("POST", "/admin/agencies", { owner: str(f, "owner"), name: str(f, "name") });
    return `Agency "${a.name}" created. Its Agency ID is ${a.code}.`;
  });
}

const AGENCY_DONE = { ACTIVE: "Agency is active", SUSPENDED: "Agency suspended", CLOSED: "Agency closed. All its hosts were let go." } as Record<string, string>;
export async function updateAgency(f: FormData) {
  const status = str(f, "status") || undefined;
  const name = str(f, "name") || undefined;
  await run("/admin/agencies", async () => {
    await api("PATCH", `/admin/agencies/${str(f, "agencyId")}`, { status, name });
    return status ? AGENCY_DONE[status]! : "Agency renamed";
  });
}

export async function setAgencyImage(f: FormData) {
  const file = f.get("file");
  await run("/admin/agencies", async () => {
    const body = new FormData();
    if (file instanceof File && file.size) body.append("file", file);
    await api("POST", `/admin/agencies/${str(f, "agencyId")}/image`, body);
    return "Agency image updated";
  });
}

// ---------- salaries and withdrawals ----------

export async function paySalaries(f: FormData) {
  const month = str(f, "month");
  await run(`/admin/salaries?month=${month}`, async () => {
    await api("POST", `/admin/salaries/${month}/pay`);
    return `Salaries for ${month} paid`;
  });
}

export async function decideWithdrawal(f: FormData) {
  const paid = str(f, "paid") === "true";
  await run(backTo(f, "/admin/withdrawals"), async () => {
    await api("POST", `/admin/withdrawals/${str(f, "id")}/decision`, { paid, note: str(f, "note") || null });
    return paid ? "Marked as paid" : "Rejected. The amount went back to their balance.";
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

// ---------- gift catalog ----------

// Sends the gift form on as multipart: text fields as typed, files only when chosen.
const giftBody = (f: FormData) => {
  const body = new FormData();
  for (const k of ["name", "categoryId", "coinPrice", "maxQuantity", "sortOrder", "enabled"]) if (str(f, k)) body.append(k, k === "name" ? str(f, k) : str(f, k).replace(/[, ]/g, ""));
  for (const k of ["icon", "effect"]) {
    const file = f.get(k);
    if (file instanceof File && file.size) body.append(k, file);
  }
  return body;
};
const giftCheck = (e: unknown) => {
  if (e instanceof ApiError && e.code === "VALIDATION_ERROR")
    throw new ApiError(400, "GIFT_INVALID", "Check the gift: a name up to 24 characters, a price from 1 to 1,00,00,000 coins, and up to 999 per send.");
  throw e;
};

export async function createGift(f: FormData) {
  await run(backTo(f, "/admin/gifts"), async () => {
    const g = await api<{ name: string }>("POST", "/admin/gifts", giftBody(f)).catch(giftCheck);
    return `"${g.name}" added. It's hidden: preview it, then press Show to put it in the gift box.`;
  });
}

export async function updateGift(f: FormData) {
  const enabled = str(f, "enabled");
  await run(backTo(f, "/admin/gifts"), async () => {
    const g = await api<{ name: string }>("PATCH", `/admin/gifts/${encodeURIComponent(str(f, "giftId"))}`, giftBody(f)).catch(giftCheck);
    return enabled === "true" ? `"${g.name}" is in the gift box` : enabled === "false" ? `"${g.name}" is hidden` : `"${g.name}" saved`;
  });
}

export async function createCategory(f: FormData) {
  await run(backTo(f, "/admin/gifts"), async () => {
    const c = await api<{ name: string }>("POST", "/admin/gift-categories", { name: str(f, "name"), sortOrder: Number(str(f, "sortOrder") || 100) });
    return `Category "${c.name}" added`;
  });
}

export async function updateCategory(f: FormData) {
  const enabled = str(f, "enabled");
  const body = enabled ? { enabled: enabled === "true" } : { name: str(f, "name"), sortOrder: Number(str(f, "sortOrder")) };
  await run(backTo(f, "/admin/gifts"), async () => {
    const c = await api<{ name: string }>("PATCH", `/admin/gift-categories/${str(f, "id")}`, body);
    return enabled === "true" ? `"${c.name}" shows in the gift box` : enabled === "false" ? `"${c.name}" is hidden, with its gifts` : `Category "${c.name}" saved`;
  });
}
