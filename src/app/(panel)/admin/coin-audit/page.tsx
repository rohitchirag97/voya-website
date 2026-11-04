import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, first, fmt, ghost, input, ist, Pill } from "@/components/ui";
import { api, ApiError, can, requireMe } from "@/lib/api";

type Row = { txnId: string; id: number; at: string; userId: string; publicId: number; displayName: string | null; type: string; amount: number; balanceAfter: number | null; reference: string };
type Total = { type: string; count: number; coinsIn: number; coinsOut: number };
type Book = { mismatched: number; balances: number; ledger: number };
type Ledger = { rows: Row[]; nextBefore: number | null; totals: Total[]; check: { wallets: Book; sellers: Book } };

const BOOKS = { wallet: "User wallets", seller: "Coin-seller wallets" } as const;
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const tone = (n: number) => (n > 0 ? "text-success" : n < 0 ? "text-danger" : "");

// Every coin that moved: earned, bought, spent, bet, won, refunded, granted. Each row has a transaction ID, its time,
// whose wallet, the amount and the balance after it. The database refuses any coin change without a row here, and rows
// can't be edited or deleted, so this is the full record.
export default async function CoinAudit({ searchParams }: PageProps<"/admin/coin-audit">) {
  const me = await requireMe();
  if (!can(me, "coins.audit")) redirect("/dashboard");
  const sp = await searchParams;
  const f = {
    book: first(sp.book) === "seller" ? "seller" : "wallet",
    user: first(sp.user).trim(),
    type: first(sp.type).trim(),
    from: isDate(first(sp.from)) ? first(sp.from) : "",
    to: isDate(first(sp.to)) ? first(sp.to) : "",
  } as const;
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
  const before = Number(first(sp.before)) || 0;
  let data: Ledger | null = null;
  let error = f.from && f.to && f.from > f.to ? "Start date must be on or before end date" : null;
  if (!error)
    data = await api<Ledger>("GET", `/admin/coin-ledger?${qs}${before ? `&before=${before}` : ""}`).catch((e) => {
      error = e instanceof ApiError ? e.message : "Couldn't load the ledger";
      return null;
    });
  const pageLink = (extra: Record<string, string | number>) => `/admin/coin-audit?${new URLSearchParams({ ...Object.fromEntries(qs), ...Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Coin audit</h1>
        <p className="mt-1 text-sm text-muted">
          Every coin movement, with its transaction ID, time, wallet, amount and balance after. The database refuses any balance change without a row here, and rows can&apos;t be edited or deleted: a mistake is fixed with a correcting row.
        </p>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(["wallets", "sellers"] as const).map((k) => {
            const b = data!.check[k];
            const ok = b.mismatched === 0 && b.balances === b.ledger;
            return (
              <section key={k} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted">{k === "wallets" ? BOOKS.wallet : BOOKS.seller}</p>
                  <Pill tone={ok ? "success" : "danger"}>{ok ? "Books balance" : `${b.mismatched} wallet(s) don't match`}</Pill>
                </div>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(b.balances)} coins</p>
                <p className="text-sm text-muted tabular-nums">Ledger adds up to {fmt(b.ledger)}</p>
              </section>
            );
          })}
        </div>
      )}

      <Card title="Filter" hint="User: profile ID, Special ID or exact name. Dates are India days, both included.">
        <form key={qs.toString()} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Wallets
            <select name="book" defaultValue={f.book} className={input}>
              {Object.entries(BOOKS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            User
            <input name="user" defaultValue={f.user} placeholder="Any" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Type
            <input name="type" defaultValue={f.type} placeholder="Any, e.g. GIFT_DEBIT" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            From
            <input type="date" name="from" defaultValue={f.from} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            To
            <input type="date" name="to" defaultValue={f.to} className={input} />
          </label>
          <button className={button}>Show</button>
          <a href={`/admin/coin-audit/csv?${qs}`} className={ghost + " flex items-center"} download>
            Download CSV
          </a>
        </form>
      </Card>

      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}

      {data && (
        <>
          <Card title="By type" hint="For the filters above (all pages).">
            {!data.totals.length ? (
              <p className="text-sm text-muted">No movements.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Type</th>
                      <th className="py-2 pr-4 text-right font-semibold">Rows</th>
                      <th className="py-2 pr-4 text-right font-semibold">Coins in</th>
                      <th className="py-2 pr-4 text-right font-semibold">Coins out</th>
                      <th className="py-2 text-right font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {data.totals.map((t) => (
                      <tr key={t.type}>
                        <td className="py-2 pr-4 font-semibold">
                          <Link href={pageLink({ type: t.type })} className="hover:underline">{t.type}</Link>
                        </td>
                        <td className="py-2 pr-4 text-right">{fmt(t.count)}</td>
                        <td className="py-2 pr-4 text-right text-success">{fmt(t.coinsIn)}</td>
                        <td className="py-2 pr-4 text-right text-danger">{fmt(t.coinsOut)}</td>
                        <td className={`py-2 text-right font-semibold ${tone(t.coinsIn - t.coinsOut)}`}>{fmt(t.coinsIn - t.coinsOut)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Transactions" hint="Newest first, 100 per page.">
            {!data.rows.length ? (
              <p className="text-sm text-muted">No movements.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Transaction</th>
                      <th className="py-2 pr-4 font-semibold">Time (IST)</th>
                      <th className="py-2 pr-4 font-semibold">User</th>
                      <th className="py-2 pr-4 font-semibold">Type</th>
                      <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                      <th className="py-2 pr-4 text-right font-semibold">Balance after</th>
                      <th className="py-2 font-semibold">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular-nums">
                    {data.rows.map((r) => (
                      <tr key={r.txnId}>
                        <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{r.txnId}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{ist(r.at)}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          <Link href={pageLink({ user: r.userId })} className="font-semibold hover:underline">{r.displayName ?? "No name"}</Link>
                          <span className="ml-1 text-muted">{r.publicId}</span>
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap">{r.type}</td>
                        <td className={`py-2 pr-4 text-right font-semibold ${tone(r.amount)}`}>{r.amount > 0 ? "+" : ""}{fmt(r.amount)}</td>
                        <td className="py-2 pr-4 text-right">{r.balanceAfter === null ? "–" : fmt(r.balanceAfter)}</td>
                        <td className="py-2 font-mono text-xs text-muted break-all">{r.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {before ? <Link href={pageLink({})} className={ghost + " flex items-center"}>Newest</Link> : null}
              {data.nextBefore ? <Link href={pageLink({ before: data.nextBefore })} className={ghost + " flex items-center"}>Older</Link> : null}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

