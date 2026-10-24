import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, danger, first, Flash, fmt, ghost, Hidden, IdemKey, input, Pill } from "@/components/ui";
import { api, isStaff, requireMe } from "@/lib/api";
import { decideSeller, mintCoins } from "../../../actions";

type Status = "PENDING" | "APPROVED" | "REJECTED";
type Seller = {
  userId: string;
  displayName: string | null;
  publicId: number;
  message: string;
  appliedAt: string;
  balance: number;
  parent: { userId: string; displayName: string | null } | null;
};

const TABS: { status: Status; label: string }[] = [
  { status: "APPROVED", label: "Active sellers" },
  { status: "PENDING", label: "Applications" },
  { status: "REJECTED", label: "Revoked & rejected" },
];

export default async function Sellers({ searchParams }: PageProps<"/admin/sellers">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.status === first(sp.status))?.status ?? "APPROVED") as Status;
  const { sellers } = await api<{ sellers: Seller[] }>("GET", `/admin/coin-sellers?status=${status}`);
  const back = `/admin/sellers?status=${status}`;
  const total = sellers.reduce((s, x) => s + x.balance, 0);

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Coin sellers</h1>
        <p className="mt-1 text-sm text-muted">Approve applications, top up seller wallets, and revoke sellers. To appoint someone who hasn’t applied, find them under Users &amp; roles.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <nav className="flex flex-wrap gap-2" aria-label="Seller status">
        {TABS.map((t) => (
          <Link key={t.status} href={`/admin/sellers?status=${t.status}`} aria-current={t.status === status ? "page" : undefined} className={t.status === status ? button + " flex items-center" : ghost + " flex items-center"}>
            {t.label}
          </Link>
        ))}
      </nav>

      {status !== "PENDING" && sellers.length > 0 && (
        <p className="text-sm text-muted">
          {sellers.length} sellers · {fmt(total)} coins in their wallets{status === "REJECTED" && " (frozen)"}
        </p>
      )}
      {!sellers.length && <p className="text-sm text-muted">Nobody here.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {sellers.map((s) => (
          <Card
            key={s.userId}
            title={s.displayName ?? "(no name yet)"}
            hint={
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono">ID {s.publicId}</span>
                {s.parent ? <Pill>Sub seller of {s.parent.displayName}</Pill> : status === "APPROVED" && <Pill tone="success">Coin seller</Pill>}
              </span>
            }
          >
            {status === "PENDING" ? (
              <>
                <p className="rounded-lg bg-surface-high p-3 text-sm">“{s.message}”</p>
                <p className="mt-2 text-xs text-muted">Applied {new Date(s.appliedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                <div className="mt-4 flex gap-2">
                  <DecisionButton userId={s.userId} back={back} approve label="Approve" />
                  <DecisionButton userId={s.userId} back={back} approve={false} label="Reject" />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm">
                  Seller wallet: <b className="text-lg">{fmt(s.balance)}</b> coins
                </p>
                {status === "APPROVED" && (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <form action={mintCoins} className="flex flex-1 gap-2">
                      <Hidden name="userId" value={s.userId} />
                      <Hidden name="back" value={back} />
                      <IdemKey />
                      <input name="amount" type="number" min={1} max={10_000_000} required placeholder="Coins to add" aria-label="Coins to add" className={`${input} w-full min-w-28`} />
                      <button className={button}>Add coins</button>
                    </form>
                    <DecisionButton userId={s.userId} back={back} approve={false} label="Revoke" />
                  </div>
                )}
                {status === "REJECTED" && (
                  <div className="mt-4">
                    <DecisionButton userId={s.userId} back={back} approve label="Reinstate as coin seller" />
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function DecisionButton({ userId, back, approve, label }: { userId: string; back: string; approve: boolean; label: string }) {
  return (
    <form action={decideSeller}>
      <Hidden name="userId" value={userId} />
      <Hidden name="back" value={back} />
      <Hidden name="approve" value={String(approve)} />
      <button className={approve ? button : danger}>{label}</button>
    </form>
  );
}
