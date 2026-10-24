import { button, Card, danger, Flash, fmt, Hidden, IdemKey, input } from "@/components/ui";
import { api, ApiError, requireMe } from "@/lib/api";
import { addSubSeller, removeSubSeller, sellCoins, topUpSubSeller } from "../../actions";

type Person = { userId: string; displayName: string | null; publicId: number } | null;
type Wallet = {
  balance: number;
  isSub: boolean;
  parent: Person | null;
  subSellers: { userId: string; displayName: string | null; publicId: number; balance: number; since: string }[];
  history: { id: number; kind: string; amount: number; createdAt: string; counterparty: Person }[];
};

const who = (p: Person) => p?.displayName ?? (p ? String(p.publicId) : "someone");

function describe(h: Wallet["history"][number]) {
  const out = h.amount < 0;
  switch (h.kind) {
    case "MINT":
      return "Added by VoyaLive";
    case "SALE":
      return `Sold to ${who(h.counterparty)}`;
    case "SUB_TOPUP":
      return out ? `Sent to sub seller ${who(h.counterparty)}` : `Received from ${who(h.counterparty)}`;
    case "SUB_RETURN":
      return out ? `Returned to ${who(h.counterparty)} on removal` : `Returned by removed sub seller ${who(h.counterparty)}`;
    default:
      return h.kind;
  }
}

export default async function SellerWallet({ searchParams }: PageProps<"/seller">) {
  const me = await requireMe();
  const sp = await searchParams;
  let w: Wallet;
  try {
    w = await api<Wallet>("GET", "/coin-sellers/wallet");
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== "NOT_A_SELLER") throw e;
    return (
      <Card title="You're not a coin seller">
        <p className="text-sm text-muted">Only approved coin sellers and sub sellers have a seller wallet. Apply in the app: Settings → Authorised Coin Sellers.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">My seller wallet</h1>
          <p className="mt-1 text-sm text-muted">{w.isSub ? `Sub seller under ${who(w.parent)}.` : "Coin seller. You can appoint sub sellers below."}</p>
        </div>
        <div className="rounded-2xl bg-linear-to-br from-primary to-accent px-6 py-4 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Seller wallet</p>
          <p className="text-3xl font-extrabold">{fmt(w.balance)}</p>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sell coins to a user" hint="The coins land in their main wallet right away. Check the name in the confirmation.">
          <form action={sellCoins} className="space-y-3">
            <IdemKey />
            <input name="to" required placeholder="Their profile ID, special ID, or name" aria-label="Recipient" className={`${input} w-full`} />
            <div className="flex gap-2">
              <input name="amount" type="number" min={1} max={w.balance || 1} required placeholder="Coins" aria-label="Coins" className={`${input} w-full`} />
              <button className={button}>Send</button>
            </div>
          </form>
        </Card>

        <Card title="Move to my main wallet" hint="For your own spending in the app: gifts, games and more.">
          <form action={sellCoins} className="flex gap-2">
            <IdemKey />
            <Hidden name="to" value={String(me.publicId)} />
            <input name="amount" type="number" min={1} max={w.balance || 1} required placeholder="Coins" aria-label="Coins to move" className={`${input} w-full`} />
            <button className={button}>Move</button>
          </form>
        </Card>
      </div>

      {!w.isSub && (
        <Card title="Sub sellers" hint="Sub sellers sell from their own seller wallet, which you fill from yours. Removing one sends their remaining coins back to you.">
          <form action={addSubSeller} className="flex max-w-lg gap-2">
            <input name="user" required placeholder="Profile ID, special ID, or name" aria-label="New sub seller" className={`${input} w-full`} />
            <button className={button}>Add sub seller</button>
          </form>
          {w.subSellers.length > 0 ? (
            <ul className="mt-5 divide-y divide-line">
              {w.subSellers.map((s) => (
                <li key={s.userId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-40 flex-1">
                    <p className="font-semibold">{s.displayName ?? "(no name yet)"}</p>
                    <p className="text-xs text-muted">
                      <span className="font-mono">ID {s.publicId}</span> · {fmt(s.balance)} coins
                    </p>
                  </div>
                  <form action={topUpSubSeller} className="flex gap-2">
                    <IdemKey />
                    <Hidden name="userId" value={s.userId} />
                    <input name="amount" type="number" min={1} required placeholder="Coins" aria-label={`Coins for ${s.displayName}`} className={`${input} w-28`} />
                    <button className={button}>Send</button>
                  </form>
                  <form action={removeSubSeller}>
                    <Hidden name="userId" value={s.userId} />
                    <button className={danger}>Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">No sub sellers yet.</p>
          )}
        </Card>
      )}

      <Card title="Recent activity" hint="Your last 50 seller wallet movements.">
        {w.history.length ? (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-lg text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2 font-semibold">When</th>
                  <th className="px-5 py-2 font-semibold">What</th>
                  <th className="px-5 py-2 text-right font-semibold">Coins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {w.history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">{new Date(h.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</td>
                    <td className="px-5 py-2.5">{describe(h)}</td>
                    <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${h.amount < 0 ? "text-danger" : "text-success"}`}>
                      {h.amount > 0 ? "+" : ""}
                      {fmt(h.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">Nothing yet.</p>
        )}
      </Card>
    </>
  );
}
