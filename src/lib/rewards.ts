// Event prize and filter shapes (server: db/schema.ts EventConfig), shared by the event editor and its builder.

export type ItemOption = { kind: "BADGE" | "AVATAR_FRAME" | "CARD_DECOR" | "CHAT_BUBBLE" | "ENTRY_EFFECT"; id: string; name: string; svg: string; svga: string | null };
export type RewardItem =
  | { type: "COINS"; amount: number }
  | { type: "BADGE"; id: string; days: number | null }
  | { type: "ITEM"; id: string; days: number | null }
  | { type: "SPECIAL_ID"; days: number | null }
  | { type: "SVIP"; tier: number; days: number };
export type Filter =
  | { type: "EVENT_GIFTS" }
  | { type: "GIFT_CATEGORIES"; ids: number[] }
  | { type: "HOSTS_ONLY" }
  | { type: "JOINED_AFTER"; date: string }
  | { type: "MIN_LEVEL"; level: number };

export type Prize = { from: number; to: number; min?: number; items: RewardItem[] };
export type Part = {
  id: string;
  title: string;
  metric: string;
  game: string;
  filters: Filter[];
  size?: number;
  rewards?: Prize[];
  target?: number;
  daily?: boolean;
  reward?: { items: RewardItem[] };
};

// A prize's items as text: "50,000 coins + Gold ring frame (30 days) + Special ID".
export function rewardText(items: RewardItem[], labels: { badges: Record<string, { name: string }>; items: Record<string, { name: string; kind: string }> }) {
  const d = (n: number | null) => (n ? ` (${n} days)` : "");
  const KIND: Record<string, string> = { AVATAR_FRAME: "frame", CARD_DECOR: "profile card", CHAT_BUBBLE: "chat bubble", ENTRY_EFFECT: "entry effect" };
  return (
    items
      .map((r) =>
        r.type === "COINS"
          ? `${r.amount.toLocaleString("en-IN")} coins`
          : r.type === "BADGE"
            ? `${labels.badges[r.id]?.name ?? "a"} badge${d(r.days)}`
            : r.type === "ITEM"
              ? `${labels.items[r.id]?.name ?? "an"} ${KIND[labels.items[r.id]?.kind ?? ""] ?? "item"}${d(r.days)}`
              : r.type === "SPECIAL_ID"
                ? `Special ID${d(r.days)}`
                : `SVIP${r.tier} for ${r.days} days`,
      )
      .join(" + ") || "nothing"
  );
}
