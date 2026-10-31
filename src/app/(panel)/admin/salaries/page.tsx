import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, first, Flash, fmt, ghost, Hidden, Pill } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { paySalaries } from "../../../actions";

type Person = { userId: string; displayName: string | null; publicId: number };
type AgencyRef = { agencyId: string; name: string; code: number };
type Sheet = {
  month: string;
  over: boolean;
  run: { startedAt: string; finishedAt: string | null } | null;
  hosts: { user: Person; agency: AgencyRef; level: number; diamonds: number; micMinutes: number; converted: number; grossPaise: number; payPaise: number; paidIn: "COINS" | "CASH" | "NONE"; paid: boolean }[];
  owners: { user: Person; agency: AgencyRef; payPaise: number; paid: boolean }[];
};

const rs = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const hrs = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;
// The month before the current India month, as YYYY-MM.
function lastMonth() {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}
const shift = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + by, 1)).toISOString().slice(0, 7);
};

// Review a finished month's host salaries and owner bonuses, then pay them once.
export default async function Salaries({ searchParams }: PageProps<"/admin/salaries">) {
  const me = await requireMe();
  if (!can(me, "salaries.pay")) redirect("/dashboard");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(first(sp.month)) ? first(sp.month) : lastMonth();
  const s = await api<Sheet>("GET", `/admin/salaries/${month}`);
  const toPay = s.hosts.filter((h) => !h.paid);
  const cash = s.hosts.filter((h) => h.paidIn === "CASH").reduce((t, h) => t + h.payPaise, 0) + s.owners.reduce((t, o) => t + o.payPaise, 0);
  const coins = s.hosts.filter((h) => h.paidIn === "COINS").reduce((t, h) => t + h.payPaise / 10, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Salaries · {month}</h1>
          <p className="mt-1 text-sm text-muted">
            Each host gets their level&apos;s salary minus what they converted early (₹0.05 a diamond); levels 1–2 as coins, higher as cash. Owners get 10% of their hosts&apos; full salaries as cash. The rest of each pool lapses.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Month">
          <Link href={`/admin/salaries?month=${shift(month, -1)}`} className={`${ghost} flex items-center`}>← {shift(month, -1)}</Link>
          <Link href={`/admin/salaries?month=${shift(month, 1)}`} className={`${ghost} flex items-center`}>{shift(month, 1)} →</Link>
        </nav>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card
        title={s.run?.finishedAt ? "Paid" : !s.over ? "Month not over yet" : toPay.length ? "Ready to pay" : "Nothing to pay"}
        hint={s.run?.finishedAt ? `Paid ${new Date(s.run.finishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` : "Check the sheet below first. Paying can't be undone."}
      >
        <p className="text-sm">
          {s.hosts.length} host pools · <b>{rs(cash)}</b> cash to balances · <b>{fmt(coins)}</b> coins to wallets
        </p>
        {s.over && !s.run?.finishedAt && (
          <form action={paySalaries} className="mt-4">
            <Hidden name="month" value={month} />
            <button className={button}>Pay {month} salaries</button>
          </form>
        )}
      </Card>

      <Card title="Hosts" hint="Biggest month first.">
        {s.hosts.length ? (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-3xl text-sm tabular-nums">
              <thead className="text-left text-xs text-muted">
                <tr>
                  {["Host", "Agency", "Level", "Diamonds", "Mic", "Salary", "Converted", "Pays", ""].map((h) => (
                    <th key={h} className="px-5 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.hosts.map((h) => (
                  <tr key={h.user.userId + h.agency.agencyId}>
                    <td className="px-5 py-2.5"><b>{h.user.displayName}</b> <span className="font-mono text-muted">{h.user.publicId}</span></td>
                    <td className="px-5 py-2.5">{h.agency.name}</td>
                    <td className="px-5 py-2.5">{h.level || "–"}</td>
                    <td className="px-5 py-2.5">{fmt(h.diamonds)}</td>
                    <td className="px-5 py-2.5">{hrs(h.micMinutes)}</td>
                    <td className="px-5 py-2.5">{rs(h.grossPaise)}</td>
                    <td className="px-5 py-2.5">{h.converted ? `−${rs(h.converted * 5)}` : "–"}</td>
                    <td className="px-5 py-2.5 font-semibold">{h.paidIn === "NONE" ? "–" : h.paidIn === "COINS" ? `${fmt(h.payPaise / 10)} coins` : rs(h.payPaise)}</td>
                    <td className="px-5 py-2.5">{h.paid && <Pill tone="success">paid</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No host earned diamonds this month.</p>
        )}
      </Card>

      <Card title="Agency owners" hint="10% of their hosts' full level salaries.">
        {s.owners.length ? (
          <ul className="divide-y divide-line text-sm">
            {s.owners.map((o) => (
              <li key={o.agency.agencyId} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex-1"><b>{o.user.displayName}</b> · {o.agency.name} <span className="font-mono text-muted">#{o.agency.code}</span></span>
                <b className="tabular-nums">{rs(o.payPaise)}</b>
                {o.paid && <Pill tone="success">paid</Pill>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No owner bonuses this month.</p>
        )}
      </Card>
    </>
  );
}
