import Image from "next/image";
import Link from "next/link";
import { ghost, Pill } from "@/components/ui";
import { isStaff, requireMe, sellerStatus } from "@/lib/api";
import { logout } from "../actions";

// Signed-in area. Links show what this user can use; the API still checks every action.
export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const me = await requireMe();
  const seller = (await sellerStatus()) === "APPROVED";
  const links = [
    ...(isStaff(me)
      ? [
          { href: "/admin", label: "Users & roles" },
          { href: "/admin/sellers", label: "Coin sellers" },
          { href: "/admin/agencies", label: "Agencies" },
          { href: "/admin/gifts", label: "Gifts" },
          { href: "/admin/events", label: "Events" },
          { href: "/admin/salaries", label: "Salaries" },
          { href: "/admin/withdrawals", label: "Withdrawals" },
        ]
      : []),
    ...(seller ? [{ href: "/seller", label: "My seller wallet" }] : []),
  ];

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center">
            <Image src="/logo.png" alt="VoyaLive" width={110} height={36} priority />
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm font-semibold">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-muted hover:bg-surface-high hover:text-ink">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">
              <b>{me.displayName ?? "No name yet"}</b> <span className="text-muted">· {me.publicId}</span>
            </span>
            {me.staffRole && <Pill tone={me.staffRole === "OWNER" ? "gold" : "primary"}>{me.staffRole}</Pill>}
            <form action={logout}>
              <button className={`${ghost} h-9`}>Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
