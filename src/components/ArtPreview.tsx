"use client";

import { useEffect, useRef, useState } from "react";

// A small thumbnail that, on hover (or tap / keyboard focus), opens a larger preview: the SVGA animation playing, or the
// picture. For checking a frame, bubble, profile card, badge, gift or SVIP design is the right one before giving it.
type SvgaPlayer = { loops: number; clearsAfterStop: boolean; setContentMode(m: string): void; setVideoItem(v: unknown): void; startAnimation(): void; clear(): void };
type SvgaLib = { Player: new (el: HTMLElement) => SvgaPlayer; Parser: new (el: HTMLElement) => { load(url: string, ok: (v: unknown) => void, fail: (e: unknown) => void): void } };
declare global {
  interface Window {
    SVGA?: SvgaLib;
  }
}

// The web player the server already uses for its own previews, loaded once.
let loading: Promise<SvgaLib> | null = null;
const svgaLib = () =>
  (loading ??= new Promise<SvgaLib>((ok, fail) => {
    if (window.SVGA) return ok(window.SVGA);
    const s = document.createElement("script");
    s.src = "/games/fx/lib/svga.min.js";
    s.onload = () => (window.SVGA ? ok(window.SVGA) : fail(new Error("no player")));
    s.onerror = () => {
      loading = null;
      fail(new Error("player didn't load"));
    };
    document.head.appendChild(s);
  }));

const url = (p: string) => (/^(https?|data):/.test(p) ? p : "/" + p.replace(/^\//, ""));
// The picture inside an uploaded item's SVG (href="/games/items/...").
export const pictureOf = (svg?: string | null) => svg?.match(/href="([^"]+)"/)?.[1] ?? null;

export function ArtPreview({
  svga: animOrPicture,
  image: picture,
  svg,
  bubble,
  wide,
  label,
}: {
  svga?: string | null;
  image?: string | null;
  svg?: string | null; // drawn artwork (built-in items): shown as is
  bubble?: { gradient: string[]; border: string; text: string } | null;
  wide?: boolean; // profile cards: a wide picture
  label: string;
}) {
  // An effect uploaded as a picture (gifts, entry effects) is shown as a picture.
  const still = !!animOrPicture && /\.(png|webp|jpe?g)$/i.test(animOrPicture);
  const svga = still ? null : animOrPicture;
  const image = still ? animOrPicture : picture;
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const pic = image ?? pictureOf(svg);
  const drawn = !pic && svg && !svga ? svg : null;

  useEffect(() => {
    if (!open || !svga || !stage.current) return;
    let player: SvgaPlayer | null = null;
    let alive = true;
    const el = stage.current;
    svgaLib()
      .then((SVGA) => {
        if (!alive) return;
        player = new SVGA.Player(el);
        player.loops = 0;
        player.setContentMode("AspectFit");
        new SVGA.Parser(el).load(
          url(svga),
          (v) => {
            if (!alive || !player) return;
            player.setVideoItem(v);
            player.startAnimation();
          },
          () => alive && setFailed(true),
        );
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      player?.clear();
      el.innerHTML = "";
    };
  }, [open, svga]);

  const thumb = bubble ? (
    <span className="flex h-full w-full items-center justify-center rounded-lg border-2 text-[11px] font-bold" style={{ background: `linear-gradient(135deg, ${bubble.gradient[0]}, ${bubble.gradient[1]})`, borderColor: bubble.border, color: bubble.text }}>
      Hi!
    </span>
  ) : pic ? (
    // eslint-disable-next-line @next/next/no-img-element -- served by the API
    <img src={url(pic)} alt="" className={`h-full w-full rounded-lg bg-surface-high ${wide ? "object-cover" : "object-contain"}`} />
  ) : drawn ? (
    <span className="block h-full w-full rounded-lg bg-surface-high p-0.5 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: drawn }} />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded-lg bg-night text-[10px] font-bold text-white">{svga ? "▶ SVGA" : "none"}</span>
  );

  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={`Preview ${label}`}
        aria-expanded={open}
        className={`block cursor-zoom-in rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary ${wide ? "h-12 w-28" : "h-12 w-12"}`}
      >
        {thumb}
      </button>
      {open && (
        <span role="dialog" aria-label={label} className="absolute left-0 top-14 z-40 block w-64 rounded-2xl border border-line bg-night p-3 shadow-2xl">
          <span className="mb-2 block truncate text-xs font-semibold text-white/80">{label}</span>
          {svga ? (
            failed ? (
              <span className="flex h-56 items-center justify-center text-xs text-white/60">This animation couldn&apos;t be played</span>
            ) : (
              <div ref={stage} className="h-56 w-full" />
            )
          ) : (
            <span className="block h-56 w-full">{thumb}</span>
          )}
        </span>
      )}
    </span>
  );
}
