import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, danger, Flash, fmt, ghost, Hidden, input, ist, Pill } from "@/components/ui";
import { api, isStaff, requireMe } from "@/lib/api";
import { approveEventPayouts, removeEventPart, saveEventBasics, saveEventBoard, saveEventTask, uploadEventImage } from "../../../../actions";

type Reward = { coins?: number; badgeId?: string; badgeDays?: number | null };
type Board = { id: string; title: string; metric: string; eventGiftsOnly: boolean; size: number; rewards: (Reward & { from: number; to: number; min?: number })[] };
type Task = { id: string; title: string; metric: string; eventGiftsOnly: boolean; target: number; daily: boolean; reward: Reward };
type Event = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
  bannerUrl: string | null;
  bannerHome: boolean;
  bannerRoom: boolean;
  homeTab: "BOTH" | "LIVE" | "ROOMS";
  sortOrder: number;
  giftCategoryId: number | null;
  paidOutAt: string | null;
  config: { page: { headerUrl: string | null; color: string; description: string; rules: string }; boards: Board[]; tasks: Task[] };
};
type Options = { badges: { id: string; name: string }[]; categories: { id: number; name: string }[] };
type Prize = { userId: string; why: string; reward: Reward; paid: boolean; user: { displayName: string | null; publicId?: number } | null };

const METRICS = [
  { v: "GIFTS_SENT", l: "Gifts sent (coins)" },
  { v: "GIFTS_RECEIVED", l: "Gifts received (coins)" },
  { v: "ROOM_GIFTS", l: "Room gift total (coins)" },
  { v: "RECHARGE", l: "Recharge (coins received)" },
];
// datetime-local wants "YYYY-MM-DDTHH:mm" in India time.
const local = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
const rewardText = (r: Reward, badges: Options["badges"]) =>
  [r.coins ? `${fmt(r.coins)} coins` : "", r.badgeId ? `${badges.find((b) => b.id === r.badgeId)?.name ?? r.badgeId} badge${r.badgeDays ? ` (${r.badgeDays} days)` : ""}` : ""]
    .filter(Boolean)
    .join(" + ") || "nothing";

// One event: basics and look, banner and header, leaderboards, tasks, a live preview of its page, and its rewards.
export default async function EventEditor({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const { id } = await params;
  const sp = await searchParams;
  const [e, options, page, payouts] = await Promise.all([
    api<Event>("GET", `/admin/events/${id}`),
    api<Options>("GET", "/admin/event-options"),
    api<{ phase: string }>("GET", `/events/${id}`),
    api<{ phase: string; prizes: Prize[] }>("GET", `/admin/events/${id}/payouts`),
  ]);
  // Preview: the real event page with this event's data handed in (no login needed inside the frame).
  const html = await fetch(`${process.env.API_URL}/games/event/index.html`, { cache: "no-store" }).then((r) => r.text()).catch(() => "");
  const preview = html.replace("<head>", `<head><base href="/games/event/"><script>window.VOYA_DATA=${JSON.stringify(page).replace(/</g, "\\u003c")}</script>`);
  const c = e.config;

  return (
    <>
      <div>
        <Link href="/admin/events" className="text-sm font-semibold text-muted hover:text-ink">
          Events
        </Link>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-extrabold">
          {e.title} <Pill tone={page.phase === "live" ? "success" : page.phase === "ended" ? "primary" : page.phase === "upcoming" ? "gold" : "muted"}>{page.phase}</Pill>
        </h1>
        <p className="mt-1 text-sm text-muted">
          {ist(e.startsAt)} to {ist(e.endsAt)}
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card title="Basics and page" hint="Publish to show it in the app (banners appear while it's live). Times are India time.">
            <form action={saveEventBasics} className="grid gap-3 sm:grid-cols-2">
              <Hidden name="id" value={e.id} />
              <Field label="Name">
                <input name="title" required maxLength={60} defaultValue={e.title} className={input} />
              </Field>
              <Field label="Theme colour">
                <input name="color" type="color" defaultValue={c.page.color} className="h-10 w-20 cursor-pointer rounded-lg border border-line" />
              </Field>
              <Field label="Starts">
                <input name="startsAt" type="datetime-local" required defaultValue={local(e.startsAt)} className={input} />
              </Field>
              <Field label="Ends">
                <input name="endsAt" type="datetime-local" required defaultValue={local(e.endsAt)} className={input} />
              </Field>
              <Field label="Event gifts (category shown only while live)">
                <select name="giftCategoryId" defaultValue={e.giftCategoryId ?? ""} className={input}>
                  <option value="">None</option>
                  {options.categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Banner order (lower first)">
                <input name="sortOrder" inputMode="numeric" pattern="[0-9]+" defaultValue={e.sortOrder} className={input} />
              </Field>
              <Field label="Home banner shows on">
                <select name="homeTab" defaultValue={e.homeTab} className={input}>
                  <option value="BOTH">Live and Rooms tabs</option>
                  <option value="LIVE">Live tab only</option>
                  <option value="ROOMS">Rooms tab only</option>
                </select>
              </Field>
              <Field label="Description" wide>
                <textarea name="description" maxLength={2000} rows={3} defaultValue={c.page.description} className={`${input} h-auto py-2`} />
              </Field>
              <Field label="Rules" wide>
                <textarea name="rules" maxLength={4000} rows={3} defaultValue={c.page.rules} className={`${input} h-auto py-2`} />
              </Field>
              <div className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:col-span-2">
                <Check name="published" on={e.published} label="Published" />
                <Check name="bannerHome" on={e.bannerHome} label="Banner on Home" />
                <Check name="bannerRoom" on={e.bannerRoom} label="Banner in rooms" />
                <button className={`${button} ml-auto`}>Save</button>
              </div>
            </form>
          </Card>

          <Card title="Images" hint="PNG, JPEG or WebP up to 2 MB. Banner: wide, about 1080 × 390. Header: about 1080 × 600.">
            <div className="grid gap-4 sm:grid-cols-2">
              {(["banner", "header"] as const).map((slot) => {
                const url = slot === "banner" ? e.bannerUrl : c.page.headerUrl;
                return (
                  <form key={slot} action={uploadEventImage} className="space-y-2">
                    <Hidden name="id" value={e.id} />
                    <Hidden name="slot" value={slot} />
                    <p className="text-sm font-semibold">{slot === "banner" ? "Banner" : "Page header"}</p>
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by the API, not part of the site build
                      <img src={`/${url}`} alt="" className="aspect-[2.8/1] w-full rounded-lg object-cover" />
                    ) : (
                      <div className="flex aspect-[2.8/1] w-full items-center justify-center rounded-lg bg-surface-high text-sm text-muted">None yet</div>
                    )}
                    <input name="file" type="file" required accept="image/png,image/jpeg,image/webp" className="w-full text-sm" />
                    <button className={ghost}>Upload</button>
                  </form>
                );
              })}
            </div>
          </Card>

          <Card title="Leaderboards" hint="Live rankings for the event's time only. Rewards go to the ranks you set, after you approve them. Room boards are for show (no rewards).">
            <div className="space-y-3">
              {c.boards.map((b, i) => (
                <details key={b.id} className="rounded-xl border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                    {b.title} <span className="font-normal text-muted">({METRICS.find((m) => m.v === b.metric)?.l}, top {b.size})</span>
                  </summary>
                  <div className="space-y-2 px-3 pb-3">
                    <BoardForm id={e.id} index={String(i)} board={b} badges={options.badges} />
                    <Remove id={e.id} kind="board" index={i} />
                  </div>
                </details>
              ))}
              <details className="rounded-xl border border-dashed border-line">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-primary-strong">Add a leaderboard</summary>
                <div className="px-3 pb-3">
                  <BoardForm id={e.id} index="" badges={options.badges} />
                </div>
              </details>
            </div>
          </Card>

          <Card title="Tasks" hint="Goals each person can complete. Daily tasks reset every day (India time) and can be rewarded once per day.">
            <div className="space-y-3">
              {c.tasks.map((t, i) => (
                <details key={t.id} className="rounded-xl border border-line">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                    {t.title} <span className="font-normal text-muted">({rewardText(t.reward, options.badges)})</span>
                  </summary>
                  <div className="space-y-2 px-3 pb-3">
                    <TaskForm id={e.id} index={String(i)} task={t} badges={options.badges} />
                    <Remove id={e.id} kind="task" index={i} />
                  </div>
                </details>
              ))}
              <details className="rounded-xl border border-dashed border-line">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-primary-strong">Add a task</summary>
                <div className="px-3 pb-3">
                  <TaskForm id={e.id} index="" badges={options.badges} />
                </div>
              </details>
            </div>
          </Card>

          <Card title="Rewards" hint="Once the event ends, check the winners and approve. Each reward is paid once, however often you approve.">
            {!payouts.prizes.length ? (
              <p className="text-sm text-muted">{payouts.phase === "ended" ? "Nobody earned a reward." : "Winners show here as the event runs."}</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {payouts.prizes.map((p) => (
                  <li key={`${p.userId}-${p.why}`} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="min-w-0 flex-1">
                      <b>{p.user?.displayName ?? "Someone"}</b> <span className="text-muted">{p.why}</span>
                    </span>
                    <span>{rewardText(p.reward, options.badges)}</span>
                    <Pill tone={p.paid ? "success" : "gold"}>{p.paid ? "paid" : "to approve"}</Pill>
                  </li>
                ))}
              </ul>
            )}
            {payouts.phase === "ended" && payouts.prizes.some((p) => !p.paid) && (
              <form action={approveEventPayouts} className="mt-3">
                <Hidden name="id" value={e.id} />
                <button className={button}>Approve and pay rewards</button>
              </form>
            )}
          </Card>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-sm font-semibold">Preview (as you see it)</p>
          <iframe title="Event page preview" srcDoc={preview} className="h-[720px] w-full rounded-2xl border border-line bg-bg" />
        </aside>
      </div>
    </>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-sm font-semibold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

const Check = ({ name, on, label }: { name: string; on: boolean; label: string }) => (
  <label className="flex items-center gap-2">
    <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4 accent-primary-strong" /> {label}
  </label>
);

function MetricSelect({ value, rooms = true }: { value?: string; rooms?: boolean }) {
  return (
    <select name="metric" defaultValue={value ?? "GIFTS_SENT"} className={input}>
      {METRICS.filter((m) => rooms || m.v !== "ROOM_GIFTS").map((m) => (
        <option key={m.v} value={m.v}>
          {m.l}
        </option>
      ))}
    </select>
  );
}

function RewardInputs({ prefix, reward, badges }: { prefix: string; reward?: Reward; badges: Options["badges"] }) {
  return (
    <>
      <input name={`${prefix}coins`} inputMode="numeric" pattern="[0-9, ]*" placeholder="Coins" aria-label="Coins" defaultValue={reward?.coins ?? ""} className={`${input} w-24`} />
      <select name={`${prefix}badge`} defaultValue={reward?.badgeId ?? ""} aria-label="Badge" className={`${input} w-40`}>
        <option value="">No badge</option>
        {badges.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <input name={`${prefix}days`} inputMode="numeric" pattern="[0-9]*" placeholder="Days" aria-label="Badge days (empty: forever)" defaultValue={reward?.badgeDays ?? ""} className={`${input} w-20`} />
    </>
  );
}

function BoardForm({ id, index, board, badges }: { id: string; index: string; board?: Board; badges: Options["badges"] }) {
  const rows = [...(board?.rewards ?? []), ...Array(5).fill(null)].slice(0, 5) as ((Reward & { from: number; to: number; min?: number }) | null)[];
  return (
    <form action={saveEventBoard} className="space-y-3">
      <Hidden name="id" value={id} />
      <Hidden name="index" value={index} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px]">
        <Field label="Title">
          <input name="title" required maxLength={40} defaultValue={board?.title ?? "Top Gifters"} className={input} />
        </Field>
        <Field label="Counts">
          <MetricSelect value={board?.metric} />
        </Field>
        <Field label="Ranks shown">
          <input name="size" inputMode="numeric" pattern="[0-9]+" defaultValue={board?.size ?? 10} className={input} />
        </Field>
      </div>
      <Check name="eventGiftsOnly" on={board?.eventGiftsOnly ?? false} label="Only count this event's gifts" />
      <div className="space-y-2">
        <p className="text-sm font-semibold">Rewards by rank (leave a row empty to skip it)</p>
        <p className="text-xs text-muted">Every prize needs a minimum score: a rank that doesn&apos;t reach it wins nothing, so a few friends can&apos;t take a prize with a tiny total. It&apos;s shown on the event&apos;s Rules page.</p>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            Rank
            <input name={`r${i}from`} inputMode="numeric" pattern="[0-9]*" aria-label="From rank" defaultValue={r?.from ?? ""} className={`${input} w-16`} />
            to
            <input name={`r${i}to`} inputMode="numeric" pattern="[0-9]*" aria-label="To rank" defaultValue={r?.to ?? ""} className={`${input} w-16`} />
            <RewardInputs prefix={`r${i}`} reward={r ?? undefined} badges={badges} />
            needs at least
            <input name={`r${i}min`} inputMode="numeric" pattern="[0-9,]*" aria-label="Minimum score to win" placeholder="min" defaultValue={r?.min ?? ""} className={`${input} w-28`} />
          </div>
        ))}
      </div>
      <button className={ghost}>Save leaderboard</button>
    </form>
  );
}

function TaskForm({ id, index, task, badges }: { id: string; index: string; task?: Task; badges: Options["badges"] }) {
  return (
    <form action={saveEventTask} className="space-y-3">
      <Hidden name="id" value={id} />
      <Hidden name="index" value={index} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
        <Field label="Title">
          <input name="title" required maxLength={60} defaultValue={task?.title ?? ""} placeholder="Send 1,000 coins of gifts" className={input} />
        </Field>
        <Field label="Counts">
          <MetricSelect value={task?.metric} rooms={false} />
        </Field>
        <Field label="Target">
          <input name="target" required inputMode="numeric" pattern="[0-9, ]+" defaultValue={task?.target ?? ""} className={input} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
        <Check name="eventGiftsOnly" on={task?.eventGiftsOnly ?? false} label="Only this event's gifts" />
        <Check name="daily" on={task?.daily ?? false} label="Daily (resets each day)" />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        Reward
        <RewardInputs prefix="" reward={task?.reward} badges={badges} />
      </div>
      <button className={ghost}>Save task</button>
    </form>
  );
}

function Remove({ id, kind, index }: { id: string; kind: "board" | "task"; index: number }) {
  return (
    <form action={removeEventPart}>
      <Hidden name="id" value={id} />
      <Hidden name="kind" value={kind} />
      <Hidden name="index" value={String(index)} />
      <button className={danger}>Remove {kind === "task" ? "task" : "leaderboard"}</button>
    </form>
  );
}
