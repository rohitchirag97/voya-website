import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Card, first, fmt, ghost, input } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";

type Group = "day" | "week" | "month" | "year";
type Game = "jungle" | "galaxy" | "rocket";
type Row = { period: string; game: Game; bet: number; paid: number };

const GAMES: Record<Game, string> = { jungle: "Greedy Jungle", galaxy: "Greedy Galaxy", rocket: "Rocket" };
const GROUPS: Record<Group, string> = { day: "Day", week: "Week", month: "Month", year: "Year" };

// Dates are India days, as YYYY-MM-DD.
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const daysAgo = (n: number) => new Date(Date.parse(today()) - n * 86_400_000).toISOString().slice(0, 10);
const PRESETS = [
  { key: "daily", label: "Daily", group: "day", from: () => daysAgo(29) },
  { key: "weekly", label: "Weekly", group: "week", from: () => daysAgo(7 * 12) },
  { key: "monthly", label: "Monthly", group: "month", from: () => `${Number(today().slice(0, 4)) - 1}${today().slice(4, 8)}01` },
  { key: "yearly", label: "Yearly", group: "year", from: () => "2020-01-01" },
] as const;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const pct = (profit: number, bet: number) => (bet ? `${((profit / bet) * 100).toFixed(2)}%` : "–");
const tone = (n: number) => (n > 0 ? "text-success" : n < 0 ? "text-danger" : "");

function sum(rows: Row[]) {
  const bet = rows.reduce((s, r) => s + r.bet, 0);
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  return { bet, paid, profit: bet - paid };
}

function periodLabel(p: string, g: Group) {
  const d = new Date(`${p}T00:00:00Z`);
  if (g === "year") return p.slice(0, 4);
  if (g === "month") return d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return g === "week" ? `Week of ${day}` : day;
}

// Coins players bet in the games, what the games paid back, and what the app kept. Profit below zero is shown in red.
export default async function GameProfit({ searchParams }: PageProps<"/admin/game-profit">) {
  const me = await requireMe();
  if (!can(me, "games.profit")) redirect("/dashboard");
  const sp = await searchParams;
  const preset = PRESETS.find((p) => p.key === first(sp.view)) ?? (first(sp.from) ? null : PRESETS[0]);
  const group = (preset?.group ?? (first(sp.group) in GROUPS ? first(sp.group) : "day")) as Group;
  const to = preset || !isDate(first(sp.to)) ? today() : first(sp.to);
  const from = preset ? preset.from() : isDate(first(sp.from)) ? first(sp.from) : daysAgo(29);
  const error = from > to ? "Start date must be on or before end date" : null;
  const { rows } = error ? { rows: [] as Row[] } : await api<{ rows: Row[] }>("GET", `/admin/game-profit?from=${from}&to=${to}&group=${group}`);

  const total = sum(rows);
  const periods = [...new Set(rows.map((r) => r.period))];

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Game profit</h1>
        <p className="mt-1 text-sm text-muted">
          Coins bet in the games, coins paid back to winners, and what the app kept. Profit ÷ bet is the house edge: at the current odds Greedy should
          sit near 2% over many rounds; single days swing with big wins.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Period">
        {PRESETS.map((p) => (
          <Link key={p.key} href={`/admin/game-profit?view=${p.key}`} aria-current={p === preset ? "page" : undefined} className={(p === preset ? button : ghost) + " flex items-center"}>
            {p.label}
          </Link>
        ))}
      </nav>

      <Card title="Custom range" hint="India dates, both days included.">
        <form className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            From
            <input type="date" name="from" required defaultValue={from} max={today()} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            To
            <input type="date" name="to" required defaultValue={to} max={today()} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Group by
            <select name="group" defaultValue={group} className={input}>
              {Object.entries(GROUPS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <button className={button}>Show</button>
        </form>
      </Card>

      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total bet", value: total.bet, cls: "" },
          { label: "Total paid out", value: total.paid, cls: "" },
          { label: total.profit < 0 ? "App loss" : "App profit", value: total.profit, cls: tone(total.profit) },
        ].map((s) => (
          <section key={s.label} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`mt-1 text-2xl font-extrabold tabular-nums ${s.cls}`}>{fmt(s.value)}</p>
          </section>
        ))}
      </div>
      <p className="text-sm text-muted">
        {from} to {to} · house edge <b className={tone(total.profit)}>{pct(total.profit, total.bet)}</b>
      </p>

      <Card title="By game">
        <ProfitTable rows={(Object.keys(GAMES) as Game[]).map((g) => ({ label: GAMES[g], ...sum(rows.filter((r) => r.game === g)) }))} />
      </Card>

      <Card title={`By ${GROUPS[group].toLowerCase()}`} hint="Newest first. Only periods with bets are listed.">
        {!periods.length ? (
          <p className="text-sm text-muted">No bets in this range.</p>
        ) : (
          <ProfitTable rows={periods.map((p) => ({ label: periodLabel(p, group), ...sum(rows.filter((r) => r.period === p)) }))} />
        )}
      </Card>
    </>
  );
}

function ProfitTable({ rows }: { rows: { label: string; bet: number; paid: number; profit: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-muted">
          <tr>
            <th className="py-2 pr-4 font-semibold"></th>
            <th className="py-2 pr-4 text-right font-semibold">Bet</th>
            <th className="py-2 pr-4 text-right font-semibold">Paid out</th>
            <th className="py-2 pr-4 text-right font-semibold">Profit</th>
            <th className="py-2 text-right font-semibold">Edge</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="py-2 pr-4 font-semibold whitespace-nowrap">{r.label}</td>
              <td className="py-2 pr-4 text-right">{fmt(r.bet)}</td>
              <td className="py-2 pr-4 text-right">{fmt(r.paid)}</td>
              <td className={`py-2 pr-4 text-right font-semibold ${tone(r.profit)}`}>{fmt(r.profit)}</td>
              <td className={`py-2 text-right ${tone(r.profit)}`}>{pct(r.profit, r.bet)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
