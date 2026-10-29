"use client";

import { useState } from "react";
import { levelFor, num, rupees, type Policy } from "@/lib/salary";

const field = "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-lg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary";

// Agency owners type a host's month and see the level, pay and what's left for the next level.
export function Calculator({ policy: p }: { policy: Policy }) {
  const [diamonds, setDiamonds] = useState("120000");
  const [hours, setHours] = useState("28");
  const d = Math.max(0, Number(diamonds) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const lv = levelFor(p, d, h);
  const next = p.levels.find((l) => l.level === (lv?.level ?? 0) + 1);
  const salary = lv?.salary ?? 0;
  const extra = lv ? d - lv.diamonds : 0;
  const needHours = next ? Math.max(0, next.hours - h) : 0;

  return (
    <form onSubmit={(e) => e.preventDefault()} className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col gap-3">
        <label htmlFor="diamonds" className="flex flex-col gap-1.5 text-sm font-semibold text-muted">
          Diamonds earned this month
          <input id="diamonds" type="number" inputMode="numeric" min={0} value={diamonds} onChange={(e) => setDiamonds(e.target.value)} className={field} />
        </label>
        <label htmlFor="hours" className="flex flex-col gap-1.5 text-sm font-semibold text-muted">
          Mic hours this month
          <input id="hours" type="number" inputMode="decimal" min={0} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className={field} />
        </label>
      </div>
      <div aria-live="polite" className="grid grid-cols-2 content-start gap-2.5">
        <Stat label="Level reached" value={lv ? `Level ${lv.level}` : "Below level 1"} />
        <Stat label="Level bonus" value={lv ? (lv.bonusPct ? `${num(lv.bonusDiamonds)} ◆` : "None") : "–"} />
        <Stat label="Host salary" value={rupees(salary)} />
        <Stat label="Agency bonus" value={rupees(salary * p.agencyShare)} />
        <div className="col-span-2">
          <Stat label="Paid as" value={!lv ? "No salary this month" : lv.level <= p.coinLevels ? `${num(salary / p.rupeesPerCoin)} coins` : "Cash to your bank account"} />
        </div>
        <p className="col-span-2 text-sm text-muted">
          {extra > 0 && `${num(extra)} diamonds above the level ${lv!.level} target are not paid. `}
          {next
            ? `Next: level ${next.level} needs ${num(Math.max(0, next.diamonds - d))} more diamonds${needHours ? ` and ${needHours} more mic hours` : ""}.`
            : "Top level reached."}
        </p>
      </div>
    </form>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-bg p-3">
    <span className="text-xs font-semibold text-muted">{label}</span>
    <b className="text-lg font-extrabold tabular-nums wrap-anywhere">{value}</b>
  </div>
);
