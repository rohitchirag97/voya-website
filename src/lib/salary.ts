// The host salary policy, from the API (server/src/lib/salaryLevels.ts is the only copy of the numbers).

export type Level = { level: number; diamonds: number; hours: number; bonusPct: number; bonusDiamonds: number; salary: number };
export type Policy = {
  levels: Level[];
  mic: { minSessionMinutes: number; maxMinutesPerDay: number };
  coinLevels: number; // levels 1..coinLevels are paid in coins; above that, cash
  agencyShare: number; // the owner's share of each host's salary
  rupeesPerDiamond: number;
  diamondSharePercent: number; // diamonds a host earns per 100 coins gifted
  rupeesPerCoin: number;
  minWithdrawalRupees: number;
};

// Fetched on every visit (the page is rendered per request), so a change on the server shows at once.
export async function getPolicy(): Promise<Policy> {
  const res = await fetch(`${process.env.API_URL}/v1/salary-policy`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Salary policy unavailable (${res.status})`);
  return res.json();
}

// The highest level whose diamond and mic-hour targets are both met, or undefined below level 1.
export const levelFor = (p: Policy, diamonds: number, hours: number) => p.levels.findLast((l) => diamonds >= l.diamonds && hours >= l.hours);

export const num = (n: number) => Math.round(n).toLocaleString("en-IN");
export const rupees = (n: number) => "₹" + (Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
