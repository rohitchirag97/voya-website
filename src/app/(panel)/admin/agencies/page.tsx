import { redirect } from "next/navigation";
import { button, Card, danger, Flash, ghost, Hidden, input, Pill } from "@/components/ui";
import { api, isStaff, requireMe } from "@/lib/api";
import { createAgency, setAgencyImage, updateAgency } from "../../../actions";

type Status = "ACTIVE" | "SUSPENDED" | "CLOSED";
type Agency = {
  agencyId: string;
  code: number;
  name: string;
  imageUrl: string | null;
  status: Status;
  createdAt: string;
  hosts: number;
  owner: { userId: string; displayName: string | null; publicId: number };
};

const TONE = { ACTIVE: "success", SUSPENDED: "gold", CLOSED: "muted" } as const;

// Staff create agencies for owners, and rename, suspend, reactivate or close them. Hosts join from the app.
export default async function Agencies({ searchParams }: PageProps<"/admin/agencies">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const { agencies } = await api<{ agencies: Agency[] }>("GET", "/admin/agencies");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Agencies</h1>
        <p className="mt-1 text-sm text-muted">
          Create an agency for its owner. Hosts join in the app with the Agency ID; the owner approves them. Suspending hides the Agency Owner badge and pauses invites; closing lets every host go.
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="New agency" hint="The owner gets the Agency Owner badge. They can't be a host anywhere at the same time.">
        <form action={createAgency} className="flex flex-wrap gap-2">
          <input name="owner" required placeholder="Owner: profile ID, special ID or name" aria-label="Owner" className={`${input} min-w-64 flex-1`} />
          <input name="name" required minLength={2} maxLength={30} placeholder="Agency name" aria-label="Agency name" className={`${input} min-w-48 flex-1`} />
          <button className={button}>Create agency</button>
        </form>
      </Card>

      {!agencies.length && <p className="text-sm text-muted">No agencies yet.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {agencies.map((a) => (
          <Card
            key={a.agencyId}
            title={a.name}
            hint={
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono">Agency ID {a.code}</span>
                <Pill tone={TONE[a.status]}>{a.status.toLowerCase()}</Pill>
              </span>
            }
          >
            <div className="flex items-center gap-3">
              {a.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- served by the API, not part of the site build
                <img src={a.imageUrl} alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-high text-xl">🏢</span>
              )}
              <p className="text-sm">
                Owner <b>{a.owner.displayName ?? "(no name yet)"}</b> <span className="font-mono text-muted">· {a.owner.publicId}</span>
                <br />
                <b>{a.hosts}</b> {a.hosts === 1 ? "host" : "hosts"}
              </p>
            </div>

            {a.status !== "CLOSED" && (
              <div className="mt-4 space-y-3">
                <form action={updateAgency} className="flex gap-2">
                  <Hidden name="agencyId" value={a.agencyId} />
                  <input name="name" required minLength={2} maxLength={30} defaultValue={a.name} aria-label={`New name for ${a.name}`} className={`${input} w-full`} />
                  <button className={ghost}>Rename</button>
                </form>
                <form action={setAgencyImage} className="flex items-center gap-2">
                  <Hidden name="agencyId" value={a.agencyId} />
                  <input name="file" type="file" required accept="image/jpeg,image/png" aria-label={`Image for ${a.name}`} className="w-full text-sm" />
                  <button className={ghost}>Upload image</button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <StatusButton agencyId={a.agencyId} status={a.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} label={a.status === "ACTIVE" ? "Suspend" : "Reactivate"} />
                  <StatusButton agencyId={a.agencyId} status="CLOSED" label="Close agency" />
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function StatusButton({ agencyId, status, label }: { agencyId: string; status: Status; label: string }) {
  return (
    <form action={updateAgency}>
      <Hidden name="agencyId" value={agencyId} />
      <Hidden name="status" value={status} />
      <button className={status === "ACTIVE" ? button : danger}>{label}</button>
    </form>
  );
}
