import type { Metadata } from "next";
import Link from "next/link";
import { getPolicy, num, rupees } from "@/lib/salary";
import { Calculator } from "./Calculator";

export const metadata: Metadata = {
  title: "Host salary levels – VoyaLive",
  description: "VoyaLive's monthly host salary levels: diamond and mic-hour targets, level bonus, agency bonus, and a salary calculator.",
};

// Rendered on each visit from the API's salary policy, so it always matches what the app pays (and the build never
// depends on the API being up).
export const dynamic = "force-dynamic";

// Public page for hosts and agency owners.
export default async function Salary() {
  const p = await getPolicy();
  const agencyPct = Math.round(p.agencyShare * 100);
  const perGift = p.diamondSharePercent; // diamonds per 100 coins
  const firstNoMic = p.levels.find((l) => !l.hours)?.level;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">
          ← VoyaLive
        </Link>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Hosts &amp; agencies · Monthly policy</p>
        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">
          <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">VoyaLive</span> host salary levels
        </h1>
        <p className="max-w-2xl text-muted">
          Hosts earn diamonds from every gift they receive. At the end of each month their diamonds and mic hours decide their level, and each level pays a fixed salary. Agency
          owners earn {agencyPct}% of every host&apos;s salary.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">How hosts earn</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Step big="100 coins" small={`gifted to a host (worth ${rupees(100 * p.rupeesPerCoin)} to the sender)`} />
          <Step big={`${perGift} diamonds`} small="credited to the host instantly" />
          <Step big={rupees(perGift * p.rupeesPerDiamond)} small={`salary value (1 diamond = ${rupees(p.rupeesPerDiamond)})`} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">Salary levels</h2>
        <p className="max-w-2xl text-muted">
          A host reaches a level when both targets are met in the same month, and is paid that level&apos;s fixed salary. Diamonds earned above the level&apos;s target are not paid
          until the next level is reached.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-190 border-collapse text-right tabular-nums">
            <thead>
              <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 text-left">Level</th>
                <th scope="col" className="px-4 py-3">Diamonds / month</th>
                <th scope="col" className="px-4 py-3">Mic hours</th>
                <th scope="col" className="px-4 py-3">Level bonus</th>
                <th scope="col" className="px-4 py-3">Host salary</th>
                <th scope="col" className="px-4 py-3">Agency bonus ({agencyPct}%)</th>
                <th scope="col" className="px-4 py-3">Paid as</th>
              </tr>
            </thead>
            <tbody>
              {p.levels.map((l) => {
                const coins = l.level <= p.coinLevels;
                return (
                  <tr key={l.level} className={`whitespace-nowrap ${l.level === p.coinLevels + 1 ? "border-t-2 border-primary" : "border-t border-line first:border-t-0"}`}>
                    <td className="px-4 py-2.5 text-left text-base font-extrabold">{l.level}</td>
                    <td className="px-4 py-2.5">{num(l.diamonds)}</td>
                    <td className="px-4 py-2.5">{l.hours ? `${l.hours} h` : "Not needed"}</td>
                    <td className="px-4 py-2.5">{l.bonusPct ? `${l.bonusPct}% · ${num(l.bonusDiamonds)} ◆` : "–"}</td>
                    <td className="px-4 py-2.5 font-bold">{rupees(l.salary)}</td>
                    <td className="px-4 py-2.5">{rupees(l.salary * p.agencyShare)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${coins ? "bg-gold/15 text-gold" : "bg-success/15 text-success"}`}>
                        {coins ? `${num(l.salary / p.rupeesPerCoin)} coins` : "Cash"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          Levels 1 to {p.coinLevels} are paid in coins at {rupees(p.rupeesPerCoin)} per coin. From level {p.coinLevels + 1}, salary is paid as cash you can withdraw to your bank
          account.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">Salary calculator</h2>
        <Calculator policy={p} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">Rules</h2>
        <ul className="flex max-w-2xl list-disc flex-col gap-2 pl-5 marker:text-primary">
          <li>The salary month runs from the 1st to the last day of the month, India time.</li>
          <li>Each level pays a fixed salary: the level&apos;s diamond target plus its level bonus, × {rupees(p.rupeesPerDiamond)}.</li>
          <li>Diamonds earned above the reached level&apos;s target do not add to the salary.</li>
          <li>The level is the highest one where both the diamond and the mic-hour targets are met.</li>
          <li>
            Mic hours count while the host is on a seat in a live audio room or hosting a live stream, muted or not. A stretch shorter than {p.mic.minSessionMinutes} minutes
            doesn&apos;t count, and at most {p.mic.maxMinutesPerDay / 60} hours count each day.
          </li>
          {firstNoMic ? <li>Levels {firstNoMic} and above need no mic hours: gifts alone reach them.</li> : null}
          <li>Only diamonds and mic time from after the host joined the agency count.</li>
          <li>
            Levels 1 to {p.coinLevels} are credited as coins. From level {p.coinLevels + 1}, salary is paid as cash you can withdraw to your bank account.
          </li>
          <li>
            Hosts can convert their diamonds to coins at any time ({Math.round(p.rupeesPerCoin / p.rupeesPerDiamond)} diamonds = 1 coin). What they convert is taken off that
            month&apos;s salary at {rupees(p.rupeesPerDiamond)} a diamond.
          </li>
          <li>When the month is paid, the host&apos;s remaining diamonds from that month are settled by the salary: anything above the level reached, or all of them below level 1, lapses.</li>
          <li>The agency owner&apos;s bonus is {agencyPct}% of each host&apos;s full level salary. It is paid by VoyaLive, not taken from the host, and always paid in cash.</li>
          <li>Cash can be withdrawn to a bank account from {rupees(p.minWithdrawalRupees)}.</li>
          <li>Tax is deducted at source where Indian law requires it.</li>
        </ul>
      </section>
    </div>
  );
}

const Step = ({ big, small }: { big: string; small: string }) => (
  <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
    <b className="text-2xl font-extrabold tabular-nums">{big}</b>
    <span className="text-sm text-muted">{small}</span>
  </div>
);
