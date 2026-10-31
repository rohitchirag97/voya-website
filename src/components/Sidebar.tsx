"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

// The panel's left navigation: grouped links with icons, the current page highlighted. Fixed on wide screens; on
// phones it slides in from a menu button. Client component only for the highlight and the drawer.
export type NavGroup = { title: string; links: { href: string; label: string; icon: IconName }[] };
type IconName = keyof typeof ICONS;

const path = (d: string) => <path d={d} />;
const ICONS = {
  users: <>{path("M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1")}<circle cx="9.5" cy="7" r="3.5" />{path("M21 19v-1a4 4 0 0 0-3-3.9M15.5 3.6a3.5 3.5 0 0 1 0 6.8")}</>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3" />{path("M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 12v5c0 1.7 2.7 3 6 3 1.3 0 2.5-.2 3.5-.6")}<circle cx="17" cy="16" r="4" /></>,
  agency: <>{path("M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01")}</>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" />{path("M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8zm0 0s1.5-4.5 4-3.5S15 8 12 8z")}</>,
  trophy: <>{path("M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4")}</>,
  megaphone: <>{path("M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a3 3 0 0 1 0 6M7 14l1 5h3l-1-4")}</>,
  salary: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" />{path("M6 10v.01M18 14v.01")}</>,
  withdraw: <>{path("M12 3v12M7 10l5 5 5-5M4 21h16")}</>,
  wallet: <>{path("M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01")}</>,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export function Sidebar({ groups, footer }: { groups: NavGroup[]; footer: ReactNode }) {
  const here = usePathname();
  const [open, setOpen] = useState(false);
  // The most specific link that contains this page ("/admin" must not light up on "/admin/gifts").
  const active = groups
    .flatMap((g) => g.links.map((l) => l.href))
    .filter((h) => here === h || here.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const nav = (
    <nav aria-label="Panel" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-2 text-xs font-semibold text-white/45">{g.title}</p>
          <ul className="space-y-0.5">
            {g.links.map((l) => {
              const on = l.href === active;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={on ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      on ? "bg-primary/15 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {on && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-primary" aria-hidden />}
                    <span className={on ? "text-primary" : ""}>
                      <Icon name={l.icon} />
                    </span>
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/dashboard" className="flex items-center gap-2.5 px-6 py-5 outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white">
        <Image src="/icon.png" alt="" width={26} height={26} priority />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold text-white">VoyaLive</span>
        <span className="block text-xs text-white/50">Admin panel</span>
      </span>
    </Link>
  );

  return (
    <>
      {/* Phones: a top strip with the menu button. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-night px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary outline-none cursor-pointer"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="font-extrabold text-white">VoyaLive</span>
      </div>
      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-night/60 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-night transition-transform duration-200 motion-reduce:transition-none lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {brand}
        {nav}
        <div className="border-t border-white/10 p-3">{footer}</div>
      </aside>
    </>
  );
}
