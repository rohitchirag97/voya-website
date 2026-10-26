import { redirect } from "next/navigation";
import { button, Card, danger, first, Flash, fmt, ghost, Hidden, IdemKey, input, Pill } from "@/components/ui";
import { api, isStaff, requireMe, type StaffRole } from "@/lib/api";
import { banUser, decideSeller, mintCoins, setSpecialId, setStaffRole, unbanUser } from "../../actions";

type AdminUser = {
  userId: string;
  displayName: string | null;
  publicId: number;
  specialId: string | null;
  staffRole: StaffRole | null;
  status: string;
  bannedUntil: string | null; // status BANNED: when it lifts (null = lifetime)
  banReason: string | null;
  coins: number | null;
  seller: { status: "PENDING" | "APPROVED" | "REJECTED"; balance: number; parentId: string | null } | null; // null: never applied
};

const ROLES: StaffRole[] = ["SUPPORT", "MODERATOR", "ADMIN", "OWNER"];
const BAN_LENGTHS = [
  ["24h", "24 hours"],
  ["3d", "3 days"],
  ["7d", "7 days"],
  ["1m", "1 month"],
  ["1y", "1 year"],
  ["life", "Lifetime"],
] as const;
// India time, e.g. "2 Nov 2026, 3:45 pm".
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

// Find a user, then set their staff role (owner only), coin seller tag, or top up their seller wallet.
export default async function AdminUsers({ searchParams }: PageProps<"/admin">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const q = first(sp.q).trim();
  // A bad search shows a message instead of the error page.
  const found = q ? await api<{ users: AdminUser[] }>("GET", `/admin/users?q=${encodeURIComponent(q)}`).catch(() => null) : { users: [] };
  const users = found?.users ?? [];
  const back = `/admin?q=${encodeURIComponent(q)}`;
  const owner = me.staffRole === "OWNER";

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-muted">
          {owner ? "As owner you can give any staff role, hand over ownership, and manage coin sellers." : "As admin you can manage coin sellers. Only the owner changes staff roles."}
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error || (found ? undefined : "Search didn’t work. Use a profile ID, special ID, or the start of a name (up to 40 characters).")} />

      <form className="flex gap-2">
        <input name="q" defaultValue={q} required placeholder="Profile ID, special ID, or name" className={`${input} w-full max-w-md`} aria-label="Search users" />
        <button className={button}>Search</button>
      </form>

      {q && found && !users.length && <p className="text-sm text-muted">No users match “{q}”.</p>}

      <div className="space-y-4">
        {users.map((u) => {
          const seller = u.seller?.status === "APPROVED";
          const self = u.userId === me.userId;
          return (
            <Card
              key={u.userId}
              title={u.displayName ?? "(no name yet)"}
              hint={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">ID {u.publicId}</span>
                  {u.specialId && <Pill tone="gold">Special {u.specialId}</Pill>}
                  {u.staffRole && <Pill tone={u.staffRole === "OWNER" ? "gold" : "primary"}>{u.staffRole}</Pill>}
                  {seller && <Pill tone="success">{u.seller?.parentId ? "Sub seller" : "Coin seller"}</Pill>}
                  {u.seller?.status === "PENDING" && <Pill>Seller application pending</Pill>}
                  {u.status !== "ACTIVE" && <Pill tone="danger">{u.status}</Pill>}
                  <span>· {fmt(u.coins ?? 0)} coins in main wallet</span>
                  {seller && <span>· {fmt(u.seller?.balance ?? 0)} in seller wallet</span>}
                </span>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {owner && (
                  <form action={setStaffRole} className="space-y-2">
                    <Hidden name="userId" value={u.userId} />
                    <Hidden name="back" value={back} />
                    <label className="block text-xs font-semibold text-muted">
                      Staff role
                      <div className="mt-1.5 flex gap-2">
                        <select name="role" defaultValue={u.staffRole ?? ""} disabled={self} className={`${input} w-full`}>
                          <option value="">Regular user</option>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r === "OWNER" ? "OWNER (hand over ownership)" : r}
                            </option>
                          ))}
                        </select>
                        <button disabled={self} className={ghost}>Save</button>
                      </div>
                    </label>
                    {self && <p className="text-xs text-muted">That’s you. To step down, make someone else the owner.</p>}
                  </form>
                )}

                <div className="space-y-2">
                  <form action={setSpecialId}>
                    <Hidden name="userId" value={u.userId} />
                    <Hidden name="back" value={back} />
                    <label className="block text-xs font-semibold text-muted">
                      Special ID (3–9 letters or numbers)
                      <div className="mt-1.5 flex gap-2">
                        <input name="specialId" defaultValue={u.specialId ?? ""} required pattern="[A-Za-z0-9]{3,9}" maxLength={9} autoCapitalize="characters" placeholder="e.g. 888 or VIP88" className={`${input} w-full uppercase`} />
                        <button className={ghost}>{u.specialId ? "Change" : "Give"}</button>
                      </div>
                    </label>
                  </form>
                  {u.specialId && (
                    <form action={setSpecialId}>
                      <Hidden name="userId" value={u.userId} />
                      <Hidden name="back" value={back} />
                      <Hidden name="specialId" value="" />
                      <button className={`${danger} h-8 px-3 text-xs`}>Remove special ID {u.specialId}</button>
                    </form>
                  )}
                </div>

                <form action={decideSeller} className="space-y-2">
                  <Hidden name="userId" value={u.userId} />
                  <Hidden name="back" value={back} />
                  <Hidden name="approve" value={String(!seller)} />
                  <p className="text-xs font-semibold text-muted">Coin seller tag</p>
                  <button className={seller ? danger : ghost}>{seller ? "Revoke seller" : u.seller?.status === "PENDING" ? "Approve application" : "Make coin seller"}</button>
                </form>

                {/* Ban / unban: not for staff (change their role first) or yourself. */}
                {!u.staffRole && !self && (
                  u.status === "BANNED" ? (
                    <form action={unbanUser} className="space-y-2">
                      <Hidden name="userId" value={u.userId} />
                      <Hidden name="back" value={back} />
                      <p className="text-xs font-semibold text-muted">Banned</p>
                      <p className="text-sm">
                        {u.bannedUntil ? <>Until <span className="font-semibold">{when(u.bannedUntil)}</span></> : <span className="font-semibold">For life</span>}
                        {u.banReason && <span className="block text-muted">Reason: {u.banReason}</span>}
                      </p>
                      <button className={ghost}>Unban</button>
                    </form>
                  ) : (
                    <form action={banUser} className="space-y-2">
                      <Hidden name="userId" value={u.userId} />
                      <Hidden name="back" value={back} />
                      <label className="block text-xs font-semibold text-muted">
                        Ban user
                        <select name="duration" defaultValue="24h" className={`${input} mt-1.5 w-full`} aria-label="Ban length">
                          {BAN_LENGTHS.map(([v, label]) => (
                            <option key={v} value={v}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <textarea name="reason" required minLength={3} maxLength={300} rows={2} placeholder="Reason (they’ll see this)" className={`${input} h-auto w-full py-2`} aria-label="Ban reason" />
                      <button className={danger}>Ban</button>
                    </form>
                  )
                )}

                {seller && (
                  <form action={mintCoins} className="space-y-2">
                    <Hidden name="userId" value={u.userId} />
                    <Hidden name="back" value={back} />
                    <IdemKey />
                    <label className="block text-xs font-semibold text-muted">
                      Add coins to seller wallet
                      <div className="mt-1.5 flex gap-2">
                        <input name="amount" type="number" min={1} max={10_000_000} required placeholder="Amount" className={`${input} w-full`} />
                        <button className={button}>Add</button>
                      </div>
                    </label>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
