import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { button, Card, danger, Flash, ghost, Hidden, input, Pill } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { createRole, deleteRole, updateRole } from "../../../actions";

type Role = { id: string; name: string; color: string; permissions: string[]; showTag: boolean; badgeId: string | null; frameId: string | null; fixed: boolean; members: number };
type Perm = { key: string; group: string; label: string };
type Item = { kind: string; id: string; name: string; svg: string; svga: string | null };

// Staff roles: each is a name and colour, a set of access switches (each opens a panel menu or an app power), and the
// look everyone in it gets (official tick in its colour, a badge, a frame). One role per person; give roles in Users.
// Seeing this page needs "Assign roles"; changing roles needs "Create and edit roles". The owner's role is fixed.
export default async function Roles({ searchParams }: PageProps<"/admin/roles">) {
  const me = await requireMe();
  if (!can(me, "roles.assign")) redirect("/dashboard");
  const sp = await searchParams;
  const { roles, permissions, items } = await api<{ roles: Role[]; permissions: Perm[]; items: Item[] }>("GET", "/admin/roles");
  const edit = can(me, "roles.manage");
  const name = (id: string | null) => items.find((i) => i.id === id)?.name;

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Roles</h1>
        <p className="mt-1 text-sm text-muted">
          Each role decides what its staff can open and do, and how they look in the app. Give someone a role in Users. You can only give access you have yourself.
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      {edit && (
        <Card title="New role" hint="Pick exactly the access this job needs.">
          <RoleForm permissions={permissions} items={items} mine={me.permissions} />
        </Card>
      )}

      <div className="space-y-3">
        {roles.map((r) => (
          <details key={r.id} className="rounded-2xl border border-line bg-surface">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
              <span className="h-4 w-4 rounded-full" style={{ background: r.color }} aria-hidden />
              <span className="font-semibold">{r.name}</span>
              <span className="text-sm text-muted">
                {r.fixed ? "Everything" : `${r.permissions.length} of ${permissions.length} switches`}
                {r.members ? `, ${r.members} ${r.members === 1 ? "person" : "people"}` : ", nobody yet"}
              </span>
              <span className="ml-auto flex flex-wrap gap-1">
                {r.showTag && <Pill tone="primary">Tick</Pill>}
                {r.badgeId && <Pill tone="gold">Badge: {name(r.badgeId) ?? "?"}</Pill>}
                {r.frameId && <Pill tone="gold">Frame: {name(r.frameId) ?? "?"}</Pill>}
              </span>
            </summary>
            <div className="border-t border-line px-4 py-4">
              {r.fixed ? (
                <p className="text-sm text-muted">The owner&apos;s role has every switch and can&apos;t be changed. Hand ownership over in Users.</p>
              ) : edit && r.id !== me.staffRole ? (
                <>
                  <RoleForm role={r} permissions={permissions} items={items} mine={me.permissions} />
                  <form action={deleteRole} className="mt-3 flex justify-end">
                    <Hidden name="id" value={r.id} />
                    <button className={danger}>Delete role{r.members ? ` (${r.members} back to regular users)` : ""}</button>
                  </form>
                </>
              ) : (
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {permissions.filter((p) => r.permissions.includes(p.key)).map((p) => (
                    <li key={p.key}>
                      {p.group}: {p.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

function RoleForm({ role, permissions, items, mine }: { role?: Role; permissions: Perm[]; items: Item[]; mine: string[] }) {
  const groups = [...new Set(permissions.map((p) => p.group))];
  return (
    <form action={role ? updateRole : createRole} className="space-y-4">
      {role && <Hidden name="id" value={role.id} />}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="Name">
          <input name="name" required maxLength={30} defaultValue={role?.name} placeholder="Event Manager" className={input} />
        </Field>
        <Field label="Colour (tick)">
          <input name="color" type="color" defaultValue={role?.color ?? "#1D9BF0"} className="h-10 w-20 cursor-pointer rounded-lg border border-line" />
        </Field>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold">Access</legend>
        {groups.map((g) => (
          <div key={g} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted">{g}</p>
            {permissions
              .filter((p) => p.group === g)
              .map((p) => {
                const allowed = mine.includes(p.key);
                return (
                  <label key={p.key} className={`flex items-center gap-2 text-sm ${allowed ? "" : "opacity-50"}`} title={allowed ? undefined : "You don't have this access yourself"}>
                    <input type="checkbox" name="perm" value={p.key} defaultChecked={role?.permissions.includes(p.key)} disabled={!allowed} className="h-4 w-4 accent-primary-strong" />
                    {p.label}
                  </label>
                );
              })}
          </div>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold">
          <input type="checkbox" name="showTag" defaultChecked={role?.showTag ?? true} className="h-4 w-4 accent-primary-strong" /> Official tick next to their name
        </label>
        <Field label="Staff badge (shown automatically)">
          <select name="badgeId" defaultValue={role?.badgeId ?? ""} className={input}>
            <option value="">None</option>
            {items.filter((i) => i.kind === "BADGE").map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Staff frame (put on; they can switch)">
          <select name="frameId" defaultValue={role?.frameId ?? ""} className={input}>
            <option value="">None</option>
            {items.filter((i) => i.kind === "AVATAR_FRAME").map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted">Badges and frames are made in Items. Taking the role away takes its tick, badge and frame too.</p>
      <button className={role ? ghost : button}>{role ? "Save role" : "Create role"}</button>
    </form>
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
