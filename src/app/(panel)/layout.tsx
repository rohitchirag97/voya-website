import { Sidebar, type NavGroup } from "@/components/Sidebar";
import { api, requireMe, sellerStatus } from "@/lib/api";
import { menusFor } from "@/lib/nav";
import { logout } from "../actions";

// Signed-in area: a fixed sidebar of the menus this person's role allows, pages on the right.
export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const me = await requireMe();
  const seller = (await sellerStatus()) === "APPROVED";
  // Only the menus this person's role allows (the API checks every action again), grouped as in lib/nav.ts.
  const mine = menusFor(me);
  const groups: NavGroup[] = [
    ...[...new Set(mine.map((m) => m.group))].map((title) => ({ title, links: mine.filter((m) => m.group === title).map(({ href, label, icon }) => ({ href, label, icon })) })),
    ...(seller ? [{ title: "Selling", links: [{ href: "/seller", label: "My seller wallet", icon: "wallet" as const }] }] : []),
  ];
  const roleName = me.staffRole ? ((await api<{ roles: { id: string; name: string }[] }>("GET", "/staff-roles").catch(() => ({ roles: [] }))).roles.find((r) => r.id === me.staffRole)?.name ?? "Staff") : "Seller";

  const footer = (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
        {(me.displayName ?? "?").slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold text-white">{me.displayName ?? "No name yet"}</span>
        <span className="block truncate text-xs text-white/50">
          {roleName}, ID {me.publicId}
        </span>
      </span>
      <form action={logout}>
        <button
          aria-label="Sign out"
          title="Sign out"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/60 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <Sidebar groups={groups} footer={footer} />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
