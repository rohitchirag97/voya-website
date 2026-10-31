import { Sidebar, type NavGroup } from "@/components/Sidebar";
import { isStaff, requireMe, sellerStatus } from "@/lib/api";
import { logout } from "../actions";

// Signed-in area: a fixed sidebar of what this user can use (the API still checks every action), pages on the right.
export default async function PanelLayout({ children }: LayoutProps<"/">) {
  const me = await requireMe();
  const seller = (await sellerStatus()) === "APPROVED";
  const groups: NavGroup[] = [
    ...(isStaff(me)
      ? [
          {
            title: "People",
            links: [
              { href: "/admin", label: "Users & roles", icon: "users" as const },
              { href: "/admin/agencies", label: "Agencies", icon: "agency" as const },
              { href: "/admin/sellers", label: "Coin sellers", icon: "coins" as const },
            ],
          },
          {
            title: "App content",
            links: [
              { href: "/admin/gifts", label: "Gifts", icon: "gift" as const },
              { href: "/admin/events", label: "Events", icon: "trophy" as const },
              { href: "/admin/notices", label: "Notices", icon: "megaphone" as const },
            ],
          },
          {
            title: "Money",
            links: [
              { href: "/admin/salaries", label: "Salaries", icon: "salary" as const },
              { href: "/admin/withdrawals", label: "Withdrawals", icon: "withdraw" as const },
            ],
          },
        ]
      : []),
    ...(seller ? [{ title: "Selling", links: [{ href: "/seller", label: "My seller wallet", icon: "wallet" as const }] }] : []),
  ];

  const footer = (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
        {(me.displayName ?? "?").slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold text-white">{me.displayName ?? "No name yet"}</span>
        <span className="block truncate text-xs text-white/50">
          {me.staffRole ? me.staffRole.charAt(0) + me.staffRole.slice(1).toLowerCase() : "Seller"}, ID {me.publicId}
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
