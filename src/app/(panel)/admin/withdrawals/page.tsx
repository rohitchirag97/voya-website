import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, danger, first, Flash, ghost, Hidden, input } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { decideWithdrawal } from "../../../actions";

type Status = "PENDING" | "PAID" | "REJECTED";
type Withdrawal = {
  id: string;
  amountPaise: number;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  status: Status;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: { userId: string; displayName: string | null; publicId: number };
};

const TABS: { status: Status; label: string }[] = [
  { status: "PENDING", label: "To pay" },
  { status: "PAID", label: "Paid" },
  { status: "REJECTED", label: "Rejected" },
];
const rs = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

// Send the money by bank transfer, then mark it paid with the reference. Rejecting returns the amount to their balance.
export default async function Withdrawals({ searchParams }: PageProps<"/admin/withdrawals">) {
  const me = await requireMe();
  if (!can(me, "withdrawals.decide")) redirect("/dashboard");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.status === first(sp.status))?.status ?? "PENDING") as Status;
  const { withdrawals } = await api<{ withdrawals: Withdrawal[] }>("GET", `/admin/withdrawals?status=${status}`);
  const back = `/admin/withdrawals?status=${status}`;

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Withdrawals</h1>
        <p className="mt-1 text-sm text-muted">Pay by bank transfer to the details shown, then mark it paid with the transfer reference. Tax (TDS) is handled when you pay, outside the app.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <nav className="flex flex-wrap gap-2" aria-label="Withdrawal status">
        {TABS.map((t) => (
          <Link key={t.status} href={`/admin/withdrawals?status=${t.status}`} aria-current={t.status === status ? "page" : undefined} className={(t.status === status ? button : ghost) + " flex items-center"}>
            {t.label}
          </Link>
        ))}
      </nav>
      {!withdrawals.length && <p className="text-sm text-muted">Nothing here.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {withdrawals.map((w) => (
          <Card key={w.id} title={rs(w.amountPaise)} hint={`${w.user.displayName ?? "(no name)"} · ID ${w.user.publicId} · requested ${when(w.createdAt)}`}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Account holder</dt>
              <dd className="font-semibold">{w.accountName}</dd>
              <dt className="text-muted">Account number</dt>
              <dd className="font-mono select-all">{w.accountNumber}</dd>
              <dt className="text-muted">IFSC</dt>
              <dd className="font-mono select-all">{w.ifsc}</dd>
              {w.note && (
                <>
                  <dt className="text-muted">Note</dt>
                  <dd>{w.note}</dd>
                </>
              )}
              {w.decidedAt && (
                <>
                  <dt className="text-muted">Decided</dt>
                  <dd>{when(w.decidedAt)}</dd>
                </>
              )}
            </dl>
            {w.status === "PENDING" && (
              <div className="mt-4 space-y-2">
                <form action={decideWithdrawal} className="flex gap-2">
                  <Hidden name="id" value={w.id} />
                  <Hidden name="back" value={back} />
                  <Hidden name="paid" value="true" />
                  <input name="note" maxLength={200} placeholder="Transfer reference (UTR)" aria-label="Transfer reference" className={`${input} w-full`} />
                  <button className={button}>Mark paid</button>
                </form>
                <form action={decideWithdrawal} className="flex gap-2">
                  <Hidden name="id" value={w.id} />
                  <Hidden name="back" value={back} />
                  <Hidden name="paid" value="false" />
                  <input name="note" maxLength={200} placeholder="Reason (they'll see it)" aria-label="Reason for rejecting" className={`${input} w-full`} />
                  <button className={danger}>Reject</button>
                </form>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
