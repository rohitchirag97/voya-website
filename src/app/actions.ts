"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Part, Prize } from "@/lib/rewards";
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
// `next`: where to go on success when it isn't `back` (decided by the call, e.g. a page for what it just created).
async function run(back: string, fn: () => Promise<string>, next?: () => string) {
  let to: string;
  try {
    const msg = await fn();
    to = withMsg(next?.() ?? back, "ok", msg);
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

// ---------- events ----------

// Boards and tasks as the panel's builder sends them (components/EventBuilder.tsx); the API checks every field.
type EventConfig = {
  page: { headerUrl: string | null; color: string; description: string; rules: string };
  boards: (Part & { rewards: Prize[] })[];
  tasks: Part[];
};
type AdminEvent = { id: string; title: string; config: EventConfig };

// Times are typed in India time (datetime-local has no zone).
const istDate = (f: FormData, k: string) => (str(f, k) ? new Date(`${str(f, k)}:00+05:30`).toISOString() : undefined);
const num = (f: FormData, k: string) => Number(str(f, k).replace(/[, ]/g, "") || 0);
const eventPath = (id: string) => `/admin/events/${encodeURIComponent(id)}`;
// Read-change-write the event's settings (boards and tasks live inside them).
async function changeConfig(id: string, change: (c: EventConfig) => EventConfig) {
  const e = await api<AdminEvent>("GET", eventPath(id));
  await api("PATCH", eventPath(id), { config: change(e.config) });
}

export async function createEvent(f: FormData) {
  let to = "/admin/events";
  await run("/admin/events", async () => {
    const e = await api<AdminEvent>("POST", "/admin/events", {
      title: str(f, "title"),
      startsAt: istDate(f, "startsAt"),
      endsAt: istDate(f, "endsAt"),
      published: false,
      bannerHome: true,
      bannerRoom: true,
      sortOrder: 0,
      giftCategoryId: null,
      config: { page: { headerUrl: null, color: "#08C9D9", description: "", rules: "" }, boards: [], tasks: [] },
    });
    to = eventPath(e.id);
    return `"${e.title}" created as a draft. Add its banner, page, leaderboards and tasks, then publish it.`;
  }, () => to);
}

export async function saveEventBasics(f: FormData) {
  const id = str(f, "id");
  await run(eventPath(id), async () => {
    const e = await api<AdminEvent>("GET", eventPath(id));
    await api("PATCH", eventPath(id), {
      title: str(f, "title"),
      startsAt: istDate(f, "startsAt"),
      endsAt: istDate(f, "endsAt"),
      published: f.get("published") === "on",
      bannerHome: f.get("bannerHome") === "on",
      bannerRoom: f.get("bannerRoom") === "on",
      homeTab: str(f, "homeTab") || "BOTH",
      repeat: str(f, "repeat") || "NONE",
      sortOrder: num(f, "sortOrder"),
      giftCategoryId: str(f, "giftCategoryId") ? num(f, "giftCategoryId") : null,
      config: { ...e.config, page: { ...e.config.page, color: str(f, "color") || "#08C9D9", description: str(f, "description"), rules: str(f, "rules") } },
    });
    return "Event saved";
  });
}

export async function uploadEventImage(f: FormData) {
  const id = str(f, "id");
  const slot = str(f, "slot") === "header" ? "header" : "banner";
  const file = f.get("file");
  await run(eventPath(id), async () => {
    const body = new FormData();
    if (file instanceof File && file.size) body.append("file", file);
    await api("POST", `${eventPath(id)}/${slot}`, body);
    return slot === "banner" ? "Banner updated" : "Page header updated";
  });
}

// The builder's JSON for one board or task ("part").
const partOf = (f: FormData): Part => {
  try {
    return JSON.parse(String(f.get("part") ?? ""));
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "That didn't save. Reload the page and try again.");
  }
};

export async function saveEventBoard(f: FormData) {
  const id = str(f, "id");
  const index = str(f, "index");
  await run(eventPath(id), async () => {
    const p = partOf(f);
    const rewards = p.metric === "ROOM_GIFTS" ? [] : (p.rewards ?? []).filter((r) => r.items.length);
    const missing = rewards.find((r) => !r.min || r.min < 1);
    if (missing) throw new ApiError(400, "VALIDATION_ERROR", `Set a minimum score for the prize of rank ${missing.from}${missing.to > missing.from ? ` to ${missing.to}` : ""}`);
    await changeConfig(id, (c) => {
      const board = { id: index === "" ? "" : c.boards[Number(index)]!.id, title: p.title, metric: p.metric, game: p.game, filters: p.filters, size: p.size ?? 10, rewards };
      return { ...c, boards: index === "" ? [...c.boards, board] : c.boards.map((b, i) => (i === Number(index) ? board : b)) };
    });
    return "Leaderboard saved";
  });
}

export async function saveEventTask(f: FormData) {
  const id = str(f, "id");
  const index = str(f, "index");
  await run(eventPath(id), async () => {
    const p = partOf(f);
    if (!p.reward?.items.length) throw new ApiError(400, "VALIDATION_ERROR", "Add at least one reward item to the task");
    await changeConfig(id, (c) => {
      const task = { id: index === "" ? "" : c.tasks[Number(index)]!.id, title: p.title, metric: p.metric, game: p.game, filters: p.filters, target: p.target ?? 0, daily: !!p.daily, reward: p.reward! };
      return { ...c, tasks: index === "" ? [...c.tasks, task] : c.tasks.map((t, i) => (i === Number(index) ? task : t)) };
    });
    return "Task saved";
  });
}

export async function removeEventPart(f: FormData) {
  const id = str(f, "id");
  const kind = str(f, "kind") === "task" ? "tasks" : "boards";
  const index = Number(str(f, "removeIndex") || str(f, "index"));
  await run(eventPath(id), async () => {
    await changeConfig(id, (c) => ({ ...c, [kind]: (c[kind] as unknown[]).filter((_, i) => i !== index) }));
    return kind === "tasks" ? "Task removed" : "Leaderboard removed";
  });
}

export async function approveEventPayouts(f: FormData) {
  const id = str(f, "id");
  await run(eventPath(id), async () => {
    const r = await api<{ paid: number; failures: string[] }>("POST", `${eventPath(id)}/payouts/approve`);
    return `${r.paid} ${r.paid === 1 ? "reward" : "rewards"} paid${r.failures.length ? `. These items couldn't be given (check they still exist in Items): ${r.failures.join(", ")}` : ""}`;
  });
}

// ---------- notices ----------

const NOTICES = "/admin/notices";
const noticeBody = (f: FormData) => ({
  title: str(f, "title"),
  body: String(f.get("body") ?? "").trim(),
  color: str(f, "color") || "#08C9D9",
  startsAt: istDate(f, "startsAt"),
  endsAt: istDate(f, "endsAt"),
  published: f.get("published") === "on",
  inInbox: f.get("inInbox") === "on",
  homeTab: str(f, "homeTab") || "BOTH",
  sortOrder: num(f, "sortOrder"),
});

export async function createNotice(f: FormData) {
  const file = f.get("file");
  await run(NOTICES, async () => {
    const n = await api<{ id: string; title: string }>("POST", NOTICES, noticeBody(f));
    if (file instanceof File && file.size) {
      const body = new FormData();
      body.append("file", file);
      await api("POST", `${NOTICES}/${n.id}/image`, body);
    }
    return `"${n.title}" saved${f.get("published") === "on" ? " and published" : " as a draft"}`;
  });
}

export async function updateNotice(f: FormData) {
  const id = encodeURIComponent(str(f, "id"));
  const file = f.get("file");
  await run(NOTICES, async () => {
    await api("PATCH", `${NOTICES}/${id}`, noticeBody(f));
    if ((file instanceof File && file.size) || f.get("removeImage") === "on") {
      const body = new FormData();
      if (f.get("removeImage") === "on") body.append("remove", "1");
      else body.append("file", file as File);
      await api("POST", `${NOTICES}/${id}/image`, body);
    }
    return "Notice saved";
  });
}

export async function deleteNotice(f: FormData) {
  await run(NOTICES, async () => {
    await api("DELETE", `${NOTICES}/${encodeURIComponent(str(f, "id"))}`);
    return "Notice deleted";
  });
}

// ---------- prize items ----------

const ITEMS = "/admin/items";
// The item form as the API wants it: text fields, colours (bubbles), and the picture / animation files if chosen.
const itemBody = (f: FormData, editing: boolean) => {
  const body = new FormData();
  for (const k of ["name", "description", "from", "to", "border", "text"]) if (str(f, k)) body.append(k, str(f, k));
  if (editing) body.append("enabled", f.get("enabled") === "on" ? "true" : "false");
  body.append("forPrize", f.get("forPrize") === "on" ? "true" : "false");
  body.append("forMall", f.get("forMall") === "on" ? "true" : "false");
  for (const k of ["image", "svga"]) {
    const file = f.get(k);
    if (file instanceof File && file.size) body.append(k, file);
  }
  return body;
};
const KIND_NAME: Record<string, string> = { BADGE: "Badge", AVATAR_FRAME: "Frame", CARD_DECOR: "Profile card", CHAT_BUBBLE: "Chat bubble", ENTRY_EFFECT: "Entry effect" };

export async function createItem(f: FormData) {
  const kind = str(f, "kind");
  await run(ITEMS, async () => {
    await api("POST", `${ITEMS}/${encodeURIComponent(kind)}`, itemBody(f, false));
    return `${KIND_NAME[kind] ?? "Item"} "${str(f, "name")}" added.`;
  });
}

export async function updateItem(f: FormData) {
  const kind = str(f, "kind");
  await run(ITEMS, async () => {
    await api("PATCH", `${ITEMS}/${encodeURIComponent(kind)}/${encodeURIComponent(str(f, "itemId"))}`, itemBody(f, true));
    return `"${str(f, "name")}" saved`;
  });
}

// ---------- give to user (owner) ----------

export async function giveToUser(f: FormData) {
  await run("/admin/grants", async () => {
    let items: unknown;
    try {
      items = JSON.parse(String(f.get("items") ?? "[]"));
    } catch {
      items = [];
    }
    const r = await api<{ user: { name: string | null }; failures: string[] }>("POST", "/admin/grants", { user: str(f, "user"), reason: str(f, "reason"), items });
    return `Given to ${r.user.name ?? "them"}. They got a message in their inbox.${r.failures.length ? ` Some items couldn't be given: ${r.failures.join(", ")}.` : ""}`;
  });
}
