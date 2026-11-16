import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { button, Flash, first, fmt, ghost, Hidden, input, Pill } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { createSong, updateSong } from "../../../actions";

type Song = {
  songId: string;
  title: string;
  artist: string;
  cover: string | null;
  durationMs: number;
  givenDurationMs: number | null;
  hasOriginal: boolean;
  enabled: boolean;
  plays: number;
  track: string;
  original: string | null;
  lyrics: string;
  createdAt: string;
};

const length = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const AUDIO = "audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a";

// The karaoke song library: a backing track (no vocals) and LRC lyrics are needed; the original with vocals and a
// cover are optional. Songs show in the app's Karaoke song list at once; Hide takes one out without deleting it.
export default async function Songs({ searchParams }: PageProps<"/admin/songs">) {
  const me = await requireMe();
  if (!can(me, "songs.manage")) redirect("/dashboard");
  const sp = await searchParams;
  const { songs } = await api<{ songs: Song[] }>("GET", "/admin/songs");
  const q = first(sp.q).trim().toLowerCase();
  const shown = q ? songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)) : songs;
  const back = `/admin/songs${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Karaoke songs</h1>
          <p className="mt-1 text-sm text-muted">
            Each song needs a backing track (MP3 or M4A, no vocals) and synced lyrics (an .lrc file: lines like <code>[00:12.50]text</code>, optional word times
            like <code>&lt;00:12.80&gt;</code>). The original with vocals and a cover are optional.
          </p>
        </div>
        <form className="flex gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Search songs" aria-label="Search songs" className={`${input} w-56`} />
          <button className={ghost}>Search</button>
        </form>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <details className="w-full rounded-2xl border border-line bg-surface open:p-4 [&:not([open])]:w-auto">
        <summary className={`${ghost} inline-flex list-none items-center border-0`}>Add a song</summary>
        <form action={createSong} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Hidden name="back" value={back} />
          <Field label="Title">
            <input name="title" required maxLength={80} className={input} />
          </Field>
          <Field label="Artist">
            <input name="artist" maxLength={80} className={input} />
          </Field>
          <Field label="Length in minutes (optional, e.g. 3.5)">
            <input name="minutes" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" className={input} />
          </Field>
          <Field label="Backing track, no vocals (MP3/M4A, max 30 MB)">
            <input name="track" type="file" required accept={AUDIO} className="text-sm" />
          </Field>
          <Field label="Original with vocals (optional)">
            <input name="original" type="file" accept={AUDIO} className="text-sm" />
          </Field>
          <Field label="Cover (JPEG/PNG, optional)">
            <input name="cover" type="file" accept="image/jpeg,image/png" className="text-sm" />
          </Field>
          <Field label="Lyrics file (.lrc)">
            <input name="lyricsFile" type="file" required accept=".lrc,.txt,text/plain" className="text-sm" />
          </Field>
          <div className="flex items-end">
            <button className={button}>Add song</button>
          </div>
        </form>
      </details>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_70px_70px_140px] gap-3 border-b border-line px-4 py-2 text-xs font-semibold text-muted sm:grid">
          <span />
          <span>Song</span>
          <span>Artist</span>
          <span>Length</span>
          <span>Sung</span>
          <span>Status</span>
        </div>
        {!shown.length && <p className="px-4 py-6 text-sm text-muted">{q ? "No songs match that search." : "No songs yet. Add the first one above."}</p>}
        {shown.map((s) => (
          <details key={s.songId} className="group border-b border-line last:border-b-0">
            <summary className="grid cursor-pointer list-none grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 hover:bg-surface-high sm:grid-cols-[48px_minmax(0,2fr)_minmax(0,1fr)_70px_70px_140px]">
              {s.cover ? <img src={s.cover} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-high text-lg" aria-hidden>🎤</span>}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-muted sm:hidden">{s.artist}</span>
              </span>
              <span className="hidden truncate text-sm sm:block">{s.artist || "—"}</span>
              <span className="hidden text-sm sm:block">{length(s.durationMs)}</span>
              <span className="hidden text-sm sm:block">{fmt(s.plays)}</span>
              <span className="flex flex-wrap gap-1">
                <Pill tone={s.enabled ? "success" : "muted"}>{s.enabled ? "shown" : "hidden"}</Pill>
                {s.hasOriginal && <Pill tone="primary">vocals</Pill>}
              </span>
            </summary>

            <div className="space-y-4 bg-bg px-4 py-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex flex-col gap-1 font-semibold">
                  Backing track
                  <audio controls preload="none" src={s.track} className="h-9" />
                </label>
                {s.original && (
                  <label className="flex flex-col gap-1 font-semibold">
                    Original
                    <audio controls preload="none" src={s.original} className="h-9" />
                  </label>
                )}
              </div>

              <form action={updateSong} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Hidden name="back" value={back} />
                <Hidden name="songId" value={s.songId} />
                <Field label="Title">
                  <input name="title" required maxLength={80} defaultValue={s.title} className={input} />
                </Field>
                <Field label="Artist">
                  <input name="artist" maxLength={80} defaultValue={s.artist} className={input} />
                </Field>
                <Field label={`Length in minutes (${s.givenDurationMs ? "set" : "guessed from the lyrics"}: ${length(s.durationMs)})`}>
                  <input name="minutes" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" defaultValue={s.givenDurationMs ? (s.givenDurationMs / 60000).toFixed(2) : ""} className={input} />
                </Field>
                <Field label="Replace backing track">
                  <input name="track" type="file" accept={AUDIO} className="text-sm" />
                </Field>
                <Field label={`${s.original ? "Replace" : "Add"} original with vocals`}>
                  <input name="original" type="file" accept={AUDIO} className="text-sm" />
                </Field>
                <Field label={`${s.cover ? "Replace" : "Add"} cover`}>
                  <input name="cover" type="file" accept="image/jpeg,image/png" className="text-sm" />
                </Field>
                <Field label="Replace lyrics (.lrc)">
                  <input name="lyricsFile" type="file" accept=".lrc,.txt,text/plain" className="text-sm" />
                </Field>
                <div className="flex items-end">
                  <button className={ghost}>Save changes</button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-3">
                <form action={updateSong}>
                  <Hidden name="back" value={back} />
                  <Hidden name="songId" value={s.songId} />
                  <Hidden name="enabled" value={String(!s.enabled)} />
                  <button className={s.enabled ? ghost : button}>{s.enabled ? "Hide from the song list" : "Show in the song list"}</button>
                </form>
              </div>

              <details>
                <summary className="cursor-pointer text-sm font-semibold">Lyrics</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-line bg-surface p-3 text-xs">{s.lyrics}</pre>
              </details>
            </div>
          </details>
        ))}
      </section>
    </>
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
