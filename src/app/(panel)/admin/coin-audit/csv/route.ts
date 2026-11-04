import { cookies } from "next/headers";
import { ACCESS } from "@/lib/session";

// Coin audit CSV: the same filters as the page, fetched from the API with the signed-in user's token (the API checks
// the coins.audit switch) and passed through as a download.
const FILTERS = ["book", "user", "type", "from", "to"];

export async function GET(req: Request) {
  const from = new URL(req.url).searchParams;
  const qs = new URLSearchParams(FILTERS.filter((k) => from.get(k)).map((k) => [k, from.get(k)!]));
  qs.set("format", "csv");
  const token = (await cookies()).get(ACCESS)?.value;
  const res = await fetch(`${process.env.API_URL}/v1/admin/coin-ledger?${qs}`, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  if (!res.ok) return new Response((await res.json().catch(() => null))?.error?.message ?? "Couldn't export the ledger", { status: res.status });
  return new Response(res.body, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="coin-ledger.csv"' },
  });
}
