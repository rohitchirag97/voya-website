import { redirect } from "next/navigation";
import { button, Card, danger, first, Flash, fmt, ghost, Hidden, IdemKey, input, Pill } from "@/components/ui";
import { api, isStaff, requireMe, type StaffRole } from "@/lib/api";
import { decideSeller, mintCoins, setStaffRole } from "../../actions";

type AdminUser = {
  userId: string;
  displayName: string | null;
  publicId: number;
  specialId: string | null;
  staffRole: StaffRole | null;
  status: string;
  coins: number | null;
  seller: { status: "PENDING" | "APPROVED" | "REJECTED" | null; balance: number | null; parentId: string | null };
};

const ROLES: StaffRole[] = ["SUPPORT", "MODERATOR", "ADMIN", "OWNER"];

// Find a user, then set their staff role (owner only), coin seller tag, or top up their seller wallet.
export default async function AdminUsers({ searchParams }: PageProps<"/admin">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const users = q ? (await api<{ users: AdminUser[] }>("GET", `/admin/users?q=${encodeURIComponent(q)}`)).users : [];
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
      <Flash ok={sp.ok} error={sp.error} />

      <form className="flex gap-2">
        <input name="q" defaultValue={q} required placeholder="Profile ID, special ID, or name" className={`${input} w-full max-w-md`} aria-label="Search users" />
        <button className={button}>Search</button>
      </form>

      {q && !users.length && <p className="text-sm text-muted">No users match “{q}”.</p>}

      <div className="space-y-4">
        {users.map((u) => {
          const seller = u.seller.status === "APPROVED";
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
                  {seller && <Pill tone="success">{u.seller.parentId ? "Sub seller" : "Coin seller"}</Pill>}
                  {u.seller.status === "PENDING" && <Pill>Seller application pending</Pill>}
                  {u.status !== "ACTIVE" && <Pill tone="danger">{u.status}</Pill>}
                  <span>· {fmt(u.coins ?? 0)} coins in main wallet</span>
                  {seller && <span>· {fmt(u.seller.balance ?? 0)} in seller wallet</span>}
                </span>
              }
            >
              <div className="grid gap-4 lg:grid-cols-3">
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

                <form action={decideSeller} className="space-y-2">
                  <Hidden name="userId" value={u.userId} />
                  <Hidden name="back" value={back} />
                  <Hidden name="approve" value={String(!seller)} />
                  <p className="text-xs font-semibold text-muted">Coin seller tag</p>
                  <button className={seller ? danger : ghost}>{seller ? "Revoke seller" : u.seller.status === "PENDING" ? "Approve application" : "Make coin seller"}</button>
                </form>

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
