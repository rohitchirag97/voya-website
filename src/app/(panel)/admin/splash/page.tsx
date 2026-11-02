import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ArtPreview } from "@/components/ArtPreview";
import { button, Card, danger, Flash, ghost, Hidden, input, ist, Pill } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { deleteSplash, saveSplash } from "../../../actions";

type Action = { type: "event" | "notice" | "room" | "profile" | "url"; target: string; label?: string } | null;
type Splash = { id: string; title: string; art: string; startsAt: string; endsAt: string; action: Action; sortOrder: number; enabled: boolean };
type Option = { id: string; title: string };

// datetime-local wants "YYYY-MM-DDTHH:mm" in India time.
const local = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
const phase = (s: Splash, now = Date.now()) => (!s.enabled ? "off" : now < Date.parse(s.startsAt) ? "upcoming" : now < Date.parse(s.endsAt) ? "live" : "ended");
const TONE = { off: "muted", upcoming: "gold", live: "success", ended: "primary" } as const;
const ACTION_TEXT: Record<string, string> = { event: "Opens event", notice: "Opens notice", room: "Opens room", profile: "Opens profile", url: "Opens link" };

// Splash screens: full-screen artwork the app shows when it opens, between the start and end you set (several live at
// once take turns). With none live, the app's default start screen shows.
export default async function Splashes({ searchParams }: PageProps<"/admin/splash">) {
  const me = await requireMe();
  if (!can(me, "splash.manage")) redirect("/dashboard");
  const sp = await searchParams;
  const { splashes, events, notices } = await api<{ splashes: Splash[]; events: Option[]; notices: Option[] }>("GET", "/admin/splashes");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Splash screens</h1>
        <p className="mt-1 text-sm text-muted">
          Shown full screen for a few seconds each time the app opens, from start to end (India time). Phones download it ahead, so it shows instantly. With none live, the default start screen shows.
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="New splash" hint="Portrait artwork works best (about 1080 × 1920). SVGA, PNG or WebP.">
        <SplashForm events={events} notices={notices} />
      </Card>

      <section className="space-y-3">
        {!splashes.length && <p className="text-sm text-muted">No splash screens yet.</p>}
        {splashes.map((s) => (
          <details key={s.id} className="rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
              <ArtPreview svga={s.art} label={s.title} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="block text-xs text-muted">
                  {ist(s.startsAt)} to {ist(s.endsAt)}
                  {s.action ? `. ${ACTION_TEXT[s.action.type]}${s.action.label ? `: ${s.action.label}` : ""}` : ""}
                </span>
              </span>
              <Pill tone={TONE[phase(s)]}>{phase(s)}</Pill>
            </summary>
            <div className="border-t border-line px-4 py-4">
              <SplashForm splash={s} events={events} notices={notices} />
              <form action={deleteSplash} className="mt-3 flex justify-end">
                <Hidden name="id" value={s.id} />
                <button className={danger}>Delete splash</button>
              </form>
            </div>
          </details>
        ))}
      </section>
    </>
  );
}

function SplashForm({ splash, events, notices }: { splash?: Splash; events: Option[]; notices: Option[] }) {
  const a = splash?.action;
  // One menu for what a tap opens: a listed event or notice, or a room / profile / website given in the box below.
  const current = !a ? "" : a.type === "event" || a.type === "notice" ? `${a.type}:${a.target}` : `${a.type}:`;
  return (
    <form action={saveSplash} className="grid gap-3 sm:grid-cols-2">
      {splash && <Hidden name="id" value={splash.id} />}
      {a && <Hidden name="keep" value={`${a.type}:${a.target}`} />}
      <Field label="Name (only staff see it)">
        <input name="title" required maxLength={60} defaultValue={splash?.title} placeholder="Diwali greeting" className={input} />
      </Field>
      <Field label={`${splash ? "Replace artwork" : "Artwork"}: SVGA, PNG or WebP`}>
        <input name="art" type="file" accept=".svga,image/png,image/webp,image/jpeg" required={!splash} className="text-sm" />
      </Field>
      <Field label="Starts">
        <input name="startsAt" type="datetime-local" required defaultValue={splash && local(splash.startsAt)} className={input} />
      </Field>
      <Field label="Ends">
        <input name="endsAt" type="datetime-local" required defaultValue={splash && local(splash.endsAt)} className={input} />
      </Field>
      <Field label="Tapping it opens">
        <select name="action" defaultValue={current} className={input}>
          <option value="">Nothing</option>
          {events.length > 0 && (
            <optgroup label="Events">
              {events.map((e) => (
                <option key={e.id} value={`event:${e.id}`}>
                  {e.title}
                </option>
              ))}
            </optgroup>
          )}
          {notices.length > 0 && (
            <optgroup label="Notices">
              {notices.map((n) => (
                <option key={n.id} value={`notice:${n.id}`}>
                  {n.title}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Give it below">
            <option value="room:">A room (paste its share link)</option>
            <option value="profile:">A profile (9-digit or Special ID)</option>
            <option value="url:">A website (https:// link)</option>
          </optgroup>
        </select>
      </Field>
      <Field label="Room link, user ID or website (for those choices)">
        <input name="target" maxLength={300} defaultValue={a?.type === "url" ? a.target : ""} placeholder={a?.type === "room" || a?.type === "profile" ? `Empty: keep ${a.label ?? "the current one"}` : "https://… or 1234567890"} className={input} />
      </Field>
      <Field label="Order when several are live (lower first)">
        <input name="sortOrder" inputMode="numeric" pattern="[0-9]+" defaultValue={splash?.sortOrder ?? 0} className={input} />
      </Field>
      <div className="flex flex-wrap items-center gap-4 self-end text-sm font-semibold">
        {splash && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={splash.enabled} className="h-4 w-4 accent-primary-strong" /> On
          </label>
        )}
        <button className={`${splash ? ghost : button} ml-auto`}>{splash ? "Save" : "Add splash"}</button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}
