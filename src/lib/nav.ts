import { can, type Me } from "./api";

// Every panel menu, the access switch it needs (server lib/permissions.ts), and its sidebar group. A staff member sees
// only the menus their role allows; the dashboard sends them to the first one.
export const MENUS = [
  { group: "People", href: "/admin", label: "Users", icon: "users", perm: "users.view" },
  { group: "People", href: "/admin/roles", label: "Roles", icon: "shield", perm: "roles.assign" },
  { group: "People", href: "/admin/agencies", label: "Agencies", icon: "agency", perm: "agencies.manage" },
  { group: "People", href: "/admin/sellers", label: "Coin sellers", icon: "coins", perm: "sellers.manage" },
  { group: "App content", href: "/admin/gifts", label: "Gifts", icon: "gift", perm: "gifts.manage" },
  { group: "App content", href: "/admin/events", label: "Events", icon: "trophy", perm: "events.manage" },
  { group: "App content", href: "/admin/notices", label: "Notices", icon: "megaphone", perm: "notices.manage" },
  { group: "App content", href: "/admin/items", label: "Items", icon: "gift", perm: "items.manage" },
  { group: "App content", href: "/admin/svip", label: "SVIP designs", icon: "crown", perm: "svip.manage" },
  { group: "Money", href: "/admin/salaries", label: "Salaries", icon: "salary", perm: "salaries.pay" },
  { group: "Money", href: "/admin/withdrawals", label: "Withdrawals", icon: "withdraw", perm: "withdrawals.decide" },
  { group: "Money", href: "/admin/grants", label: "Give to user", icon: "coins", perm: "grants.give" },
] as const;

export const menusFor = (me: Me) => MENUS.filter((m) => can(me, m.perm));
