import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { button, Card, danger, Flash, Hidden, input, ist, Pill } from "@/components/ui";
import { api, requireMe } from "@/lib/api";
import { createNotice, deleteNotice, updateNotice } from "../../../actions";

type HomeTab = "BOTH" | "LIVE" | "ROOMS";
type Notice = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  color: string;
  startsAt: string;
  endsAt: string;
  published: boolean;
  inInbox: boolean;
  homeTab: HomeTab;
  sortOrder: number;
};
const TAB_LABEL: Record<HomeTab, string> = { BOTH: "Live and Rooms tabs", LIVE: "Live tab", ROOMS: "Rooms tab" };
const local = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 16);
const phase = (n: Notice, now = Date.now()) =>
  !n.published ? "draft" : now < Date.parse(n.startsAt) ? "upcoming" : now < Date.parse(n.endsAt) ? "live" : "ended";
const TONE = { draft: "muted", upcoming: "gold", live: "success", ended: "primary" } as const;

// Notices: announcements (hiring, requirements, news) in the app's home carousel between their times, on the tab
// chosen, and optionally under the inbox Notices tile. Owner and Admin only, like events.
export default async function Notices({ searchParams }: PageProps<"/admin/notices">) {
  const me = await requireMe();
  if (me.staffRole !== "OWNER" && me.staffRole !== "ADMIN") redirect("/dashboard");
  const sp = await searchParams;
  const { notices } = await api<{ notices: Notice[] }>("GET", "/admin/notices");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Notices</h1>
        <p className="mt-1 text-sm text-muted">
          Post a requirement, notice or news. It shows in the app&apos;s home carousel while it&apos;s live, and opens to the full text when tapped. With no image the app
          draws a slide in your colour.
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="New notice" hint="Times are India time.">
        <NoticeForm action={createNotice} submit="Save notice" />
      </Card>

      <section className="space-y-3">
        {!notices.length && <p className="text-sm text-muted">No notices yet.</p>}
        {notices.map((n) => (
          <details key={n.id} className="rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
              {n.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by the API, not part of the site build
                <img src={`/${n.imageUrl}`} alt="" width={112} height={40} className="h-10 w-28 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-28 items-center justify-center rounded-lg bg-night text-xs font-semibold text-white" style={{ boxShadow: `inset 0 0 18px ${n.color}` }}>
                  Drawn slide
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{n.title}</span>
                <span className="block text-xs text-muted">
                  {ist(n.startsAt)} to {ist(n.endsAt)}. {TAB_LABEL[n.homeTab]}
                  {n.inInbox ? ", inbox too" : ""}
                </span>
              </span>
              <Pill tone={TONE[phase(n)]}>{phase(n)}</Pill>
            </summary>
            <div className="border-t border-line px-4 py-4">
              <NoticeForm action={updateNotice} submit="Save" n={n} />
              <form action={deleteNotice} className="mt-3 flex justify-end">
                <Hidden name="id" value={n.id} />
                <button className={danger}>Delete notice</button>
              </form>
            </div>
          </details>
        ))}
      </section>
    </>
  );
}

function NoticeForm({ action, submit, n }: { action: (f: FormData) => Promise<void>; submit: string; n?: Notice }) {
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {n && <Hidden name="id" value={n.id} />}
      <Field label="Title" wide>
        <input name="title" required maxLength={80} defaultValue={n?.title} className={input} />
      </Field>
      <Field label="Full text (shown when tapped)" wide>
        <textarea name="body" maxLength={4000} rows={4} defaultValue={n?.body} className={`${input} h-auto py-2`} />
      </Field>
      <Field label="Starts">
        <input name="startsAt" type="datetime-local" required defaultValue={n && local(n.startsAt)} className={input} />
      </Field>
      <Field label="Ends">
        <input name="endsAt" type="datetime-local" required defaultValue={n && local(n.endsAt)} className={input} />
      </Field>
      <Field label="Shows on">
        <select name="homeTab" defaultValue={n?.homeTab ?? "BOTH"} className={input}>
          <option value="BOTH">Live and Rooms tabs</option>
          <option value="LIVE">Live tab only</option>
          <option value="ROOMS">Rooms tab only</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Colour">
          <input name="color" type="color" defaultValue={n?.color ?? "#08C9D9"} className="h-10 w-20 cursor-pointer rounded-lg border border-line" />
        </Field>
        <Field label="Order (lower first)">
          <input name="sortOrder" inputMode="numeric" pattern="[0-9]+" defaultValue={n?.sortOrder ?? 0} className={input} />
        </Field>
      </div>
      <Field label={n?.imageUrl ? "Replace image (wide, about 2.8 : 1; PNG, JPEG or WebP, max 2 MB)" : "Image (optional: wide, about 2.8 : 1; max 2 MB)"} wide>
        <input name="file" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
      </Field>
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:col-span-2">
        <Check name="published" on={n?.published ?? false} label="Published" />
        <Check name="inInbox" on={n?.inInbox ?? false} label="Also in everyone's inbox (Notices)" />
        {n?.imageUrl && <Check name="removeImage" on={false} label="Remove image (use drawn slide)" />}
        <button className={`${button} ml-auto`}>{submit}</button>
      </div>
    </form>
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
