import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

// Public landing page. Fully static: no session, no client JS.
const androidUrl = process.env.NEXT_PUBLIC_ANDROID_URL;
const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <Features />
      <Trust />
      <Footer />
    </div>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 text-lg font-extrabold tracking-tight ${light ? "text-white" : ""}`}>
      <Image src="/logo.svg" alt="" width={36} height={36} className="rounded-xl" priority />
      VoyaLive
    </span>
  );
}

function Hero() {
  return (
    <header className="relative overflow-hidden bg-night text-white">
      {/* Stage lights */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-40 h-112 w-md rounded-full bg-primary/40 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-24 h-104 w-104 rounded-full bg-accent/50 blur-[120px]" />

      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo light />
        <div className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
          <a href="#features" className="hidden rounded-lg px-3 py-2 text-white/75 hover:text-white sm:block">Features</a>
          <a href="#safety" className="hidden rounded-lg px-3 py-2 text-white/75 hover:text-white sm:block">Safety</a>
          <Link href="/salary" className="hidden rounded-lg px-3 py-2 text-white/75 hover:text-white sm:block">Host salary</Link>
          <Link href="/login" className="rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10">Seller &amp; staff sign in</Link>
        </div>
      </nav>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px] shadow-primary" /> Rooms are live right now
          </p>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Pull up a seat.
            <br />
            <span className="bg-linear-to-r from-primary to-[#b98cff] bg-clip-text text-transparent">The party talks back.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-white/70">
            VoyaLive is live voice rooms with real people. Take the mic, cheer on a streamer, send a gift that fills the screen, or join a round of Greedy between songs.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {androidUrl ? (
              <a href={androidUrl} className="inline-flex h-12 items-center gap-3 rounded-xl bg-white px-5 font-bold text-night hover:bg-white/90">
                <AndroidIcon /> Get it for Android
              </a>
            ) : (
              <span className="inline-flex h-12 items-center gap-3 rounded-xl bg-white/90 px-5 font-bold text-night">
                <AndroidIcon /> Android: coming soon
              </span>
            )}
            <span className="inline-flex h-12 items-center rounded-xl border border-white/20 px-5 font-semibold text-white/70">iPhone: coming soon</span>
          </div>
        </div>
        <RoomPreview />
      </div>
    </header>
  );
}

// A stylised voice room: host in the middle, a ring of seats, someone speaking, a gift floating up.
function RoomPreview() {
  const seats = [
    { c: "#8B5CF6", t: "AR", speaking: true },
    { c: "#06B6D4", t: "MK" },
    { c: "#F97316", t: "PS" },
    { c: "#10B981", t: "RJ", speaking: true },
    { c: "#D946EF", t: "NV" },
    { c: "#3B82F6", t: "SK" },
    { c: "#F43F5E", t: "DY" },
    { c: "", t: "" },
  ];
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-104">
      <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 bg-white/4 backdrop-blur-sm" />
      <div className="absolute left-6 right-6 top-5 flex items-center justify-between text-xs text-white/70">
        <span className="font-bold text-white">🎶 Late night chai</span>
        <span className="rounded-full bg-primary/90 px-2 py-0.5 font-bold text-white">LIVE · 128</span>
      </div>
      {/* host */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="relative mx-auto h-24 w-24">
          <span className="animate-speak absolute inset-0 rounded-full border-2 border-gold" />
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-primary to-accent text-2xl font-extrabold ring-4 ring-gold/80">VL</span>
        </div>
        <p className="mt-2 text-sm font-bold">Host</p>
      </div>
      {seats.map((s, i) => {
        const a = (i / seats.length) * 2 * Math.PI - Math.PI / 2;
        return (
          <div key={i} className="absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2" style={{ left: `${50 + 36 * Math.cos(a)}%`, top: `${54 + 34 * Math.sin(a)}%` }}>
            {s.speaking && <span className="animate-speak absolute inset-0 rounded-full border-2 border-white/80" />}
            {s.t ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold" style={{ background: s.c }}>{s.t}</span>
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-xl text-white/50">+</span>
            )}
          </div>
        );
      })}
      <span className="animate-float absolute bottom-16 right-10 text-4xl">🌹</span>
      <span className="animate-float absolute bottom-12 left-12 text-3xl [animation-delay:1.4s]">👑</span>
    </div>
  );
}

function Features() {
  const items: { icon: string; title: string; body: string }[] = [
    { icon: "🎙️", title: "Voice rooms", body: "Rooms of 8 to 20 seats. Raise your hand, take a seat, and talk. Hosts and room admins keep the stage running." },
    { icon: "📺", title: "Live & PK battles", body: "Go live on camera, or challenge another host to a timed PK. Gifts from your fans decide who wins." },
    { icon: "🎁", title: "Gifts, levels & SVIP", body: "Send animated gifts, climb levels, and unlock frames, chat bubbles and badges that show on your profile." },
    { icon: "🎲", title: "Games in the room", body: "Play Greedy and Rocket together without leaving the room. Rounds every few seconds, with leaderboards." },
  ];
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
      <h2 className="max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">Everything happens out loud.</h2>
      <p className="mt-3 max-w-xl text-muted">Text is fine. Voice is better. VoyaLive is built around hearing the people you hang out with.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((f) => (
          <div key={f.title} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-high text-2xl">{f.icon}</span>
            <h3 className="mt-4 font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section id="safety" className="border-y border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">A friendly place, by design.</h2>
          <p className="mt-3 text-muted">
            Good rooms need good manners. Hosts can mute, remove and lock seats, anyone can report or block, and our team watches for anyone pretending to be staff.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <Point>Staff accounts carry the <b>Official</b> mark. Nobody else can use staff-style names.</Point>
            <Point>Report a person or a room in two taps. Blocked people can’t reach you.</Point>
            <Point>Room owners pick their own admins and can make a room private.</Point>
          </ul>
        </div>
        <div className="rounded-3xl bg-surface-high p-6 sm:p-8">
          <h3 className="text-lg font-bold">Buying coins? Look for the badge.</h3>
          <p className="mt-2 text-sm text-muted">
            Authorised sellers carry one of these badges on their profile. Only buy coins from them, and never share your login with anyone.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Badge src="/coin-seller.svg" name="Coin Seller" body="Appointed by VoyaLive." />
            <Badge src="/sub-seller.svg" name="Sub Seller" body="Appointed by a Coin Seller." />
          </div>
          <p className="mt-6 text-xs text-muted">The full list of authorised sellers is in the app: Settings → Authorised Coin Sellers.</p>
        </div>
      </div>
    </section>
  );
}

const Point = ({ children }: { children: ReactNode }) => (
  <li className="flex gap-3">
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-xs text-success">✓</span>
    <span>{children}</span>
  </li>
);

const Badge = ({ src, name, body }: { src: string; name: string; body: string }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-surface p-4">
    <Image src={src} alt={`${name} badge`} width={52} height={52} />
    <div>
      <p className="font-bold">{name}</p>
      <p className="text-xs text-muted">{body}</p>
    </div>
  </div>
);

function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <Logo />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {supportEmail && <a href={`mailto:${supportEmail}`} className="hover:text-ink">{supportEmail}</a>}
        <Link href="/salary" className="hover:text-ink">Host salary levels</Link>
        <Link href="/login" className="hover:text-ink">Seller &amp; staff sign in</Link>
        <span>© {new Date().getFullYear()} VoyaLive</span>
      </div>
    </footer>
  );
}

const AndroidIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
    <path d="M17.6 9.48l1.84-3.18a.38.38 0 00-.66-.38l-1.87 3.23a11.4 11.4 0 00-9.82 0L5.22 5.92a.38.38 0 00-.66.38l1.84 3.18A10.8 10.8 0 001 18h22a10.8 10.8 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
  </svg>
);
