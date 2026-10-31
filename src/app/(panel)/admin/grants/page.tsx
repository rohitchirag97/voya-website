import { redirect } from "next/navigation";
import { RewardItemsField } from "@/components/EventBuilder";
import { button, Card, Flash, input, ist } from "@/components/ui";
import { api, requireMe } from "@/lib/api";
import { rewardText, type ItemOption, type RewardItem } from "@/lib/rewards";
import { giveToUser } from "../../../actions";

type Grant = { id: number; items: RewardItem[]; reason: string; failures: string[]; createdAt: string; userName: string | null; publicId: number; by: string | null };

// Give coins and items to one person without an event (compensation, thanks, a special reward). Owner only. Every
// grant needs a reason, is logged below, and the person gets a message in their inbox.
export default async function Grants({ searchParams }: PageProps<"/admin/grants">) {
  const me = await requireMe();
  if (me.staffRole !== "OWNER") redirect("/dashboard");
  const sp = await searchParams;
  const [{ items }, { grants }] = await Promise.all([api<{ items: (ItemOption & { enabled: boolean })[] }>("GET", "/admin/items"), api<{ grants: Grant[] }>("GET", "/admin/grants")]);
  const usable = items.filter((i) => i.enabled);
  const labels = {
    badges: Object.fromEntries(items.filter((i) => i.kind === "BADGE").map((i) => [i.id, i])),
    items: Object.fromEntries(items.filter((i) => i.kind !== "BADGE").map((i) => [i.id, i])),
  };

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Give to user</h1>
        <p className="mt-1 text-sm text-muted">Coins, frames, profile cards, bubbles, entry effects, badges, SVIP or a Special ID for one person, without an event. They get a message in their inbox.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="Give" hint="Find them by their 10-digit ID or their Special ID. Items are made in Items.">
        <form action={giveToUser} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              User ID
              <input name="user" required minLength={3} maxLength={20} placeholder="1234567890 or KING7" className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Reason (they see it)
              <input name="reason" required minLength={3} maxLength={300} placeholder="Sorry for the failed recharge" className={input} />
            </label>
          </div>
          <RewardItemsField items={usable} />
          <button className={button}>Give</button>
        </form>
      </Card>

      <Card title="Given recently" hint="The last 100 grants.">
        {!grants.length ? (
          <p className="text-sm text-muted">Nothing given yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {grants.map((g) => (
              <li key={g.id} className="py-3">
                <p>
                  <b>{g.userName ?? "Someone"}</b> <span className="text-muted">ID {g.publicId}</span>
                </p>
                <p>{rewardText(g.items, labels)}</p>
                <p className="text-muted">
                  &ldquo;{g.reason}&rdquo;, by {g.by ?? "staff"}, {ist(g.createdAt)}
                </p>
                {g.failures.length > 0 && <p className="text-danger">Not given: {g.failures.join(", ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
