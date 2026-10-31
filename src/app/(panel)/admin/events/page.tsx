import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, Flash, input, ist, Pill } from "@/components/ui";
import { api, isStaff, requireMe } from "@/lib/api";
import { createEvent } from "../../../actions";

type Phase = "draft" | "upcoming" | "live" | "ended";
type EventRow = { id: string; title: string; startsAt: string; endsAt: string; phase: Phase; bannerUrl: string | null; paidOutAt: string | null };
const TONE = { draft: "muted", upcoming: "gold", live: "success", ended: "primary" } as const;

// Every event, newest first; several can be live at once. Open one to set it up, preview it and approve its rewards.
export default async function Events({ searchParams }: PageProps<"/admin/events">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const { events } = await api<{ events: EventRow[] }>("GET", "/admin/events");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Events</h1>
        <p className="mt-1 text-sm text-muted">Each event has its own banner, page, leaderboards, tasks and rewards. Several can run at the same time. The app shows them with no update.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="New event" hint="Times are India time. It starts as a draft, visible only to staff until you publish it.">
        <form action={createEvent} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Name
            <input name="title" required maxLength={60} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Starts
            <input name="startsAt" type="datetime-local" required className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Ends
            <input name="endsAt" type="datetime-local" required className={input} />
          </label>
          <button className={button}>Create event</button>
        </form>
      </Card>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        {!events.length && <p className="px-4 py-6 text-sm text-muted">No events yet.</p>}
        {events.map((e) => (
          <Link key={e.id} href={`/admin/events/${e.id}`} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-high">
            {e.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- served by the API, not part of the site build
              <img src={`/${e.bannerUrl}`} alt="" width={112} height={40} className="h-10 w-28 rounded-lg object-cover" />
            ) : (
              <span className="flex h-10 w-28 items-center justify-center rounded-lg bg-surface-high text-xs text-muted">No banner</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{e.title}</span>
              <span className="block text-xs text-muted">
                {ist(e.startsAt)} to {ist(e.endsAt)}
              </span>
            </span>
            <Pill tone={TONE[e.phase]}>{e.phase}</Pill>
            {e.phase === "ended" && <Pill tone={e.paidOutAt ? "success" : "gold"}>{e.paidOutAt ? "rewards paid" : "rewards to approve"}</Pill>}
          </Link>
        ))}
      </section>
    </>
  );
}
