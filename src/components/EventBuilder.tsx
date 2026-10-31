"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import type { Filter, ItemOption, Part, Prize, RewardItem } from "@/lib/rewards";
import { button, ghost, input } from "./ui";

// The event editor's leaderboard / task builder: what counts (a measure, plus filter blocks dragged in), and prizes
// built from reward items dragged onto each prize card. Every drag has a button too (phones, keyboards). The whole
// part goes to the server action as one JSON field ("part").

const METRICS = [
  { v: "GIFTS_SENT", l: "Gifts sent (coins)" },
  { v: "GIFTS_RECEIVED", l: "Gifts received (coins)" },
  { v: "ROOM_GIFTS", l: "Room gift total (coins, for show)" },
  { v: "RECHARGE", l: "Recharge (coins received)" },
  { v: "GAME_WINS", l: "Game winnings (coins won)" },
  { v: "CP_POINTS", l: "CP points (pairs, both win)" },
];
const GAMES = [
  { v: "ALL", l: "All games" },
  { v: "GREEDY_JUNGLE", l: "Greedy Jungle" },
  { v: "GREEDY_GALAXY", l: "Greedy Galaxy" },
  { v: "ROCKET", l: "Rocket" },
];

// The tray of reward items: what each chip adds when dropped.
type Chip = { key: string; label: string; tone: string; make: (items: ItemOption[]) => RewardItem | null };
const firstOf = (items: ItemOption[], kind: ItemOption["kind"]) => items.find((i) => i.kind === kind)?.id;
const REWARD_CHIPS: Chip[] = [
  { key: "COINS", label: "Coins", tone: "bg-amber-100 text-amber-800 border-amber-300", make: () => ({ type: "COINS", amount: 1000 }) },
  { key: "BADGE", label: "Badge", tone: "bg-violet-100 text-violet-800 border-violet-300", make: (i) => (firstOf(i, "BADGE") ? { type: "BADGE", id: firstOf(i, "BADGE")!, days: 30 } : null) },
  { key: "AVATAR_FRAME", label: "Frame", tone: "bg-cyan-100 text-cyan-800 border-cyan-300", make: (i) => (firstOf(i, "AVATAR_FRAME") ? { type: "ITEM", id: firstOf(i, "AVATAR_FRAME")!, days: 30 } : null) },
  { key: "CARD_DECOR", label: "Profile card", tone: "bg-indigo-100 text-indigo-800 border-indigo-300", make: (i) => (firstOf(i, "CARD_DECOR") ? { type: "ITEM", id: firstOf(i, "CARD_DECOR")!, days: 30 } : null) },
  { key: "CHAT_BUBBLE", label: "Chat bubble", tone: "bg-sky-100 text-sky-800 border-sky-300", make: (i) => (firstOf(i, "CHAT_BUBBLE") ? { type: "ITEM", id: firstOf(i, "CHAT_BUBBLE")!, days: 30 } : null) },
  { key: "ENTRY_EFFECT", label: "Entry effect", tone: "bg-rose-100 text-rose-800 border-rose-300", make: (i) => (firstOf(i, "ENTRY_EFFECT") ? { type: "ITEM", id: firstOf(i, "ENTRY_EFFECT")!, days: 30 } : null) },
  { key: "SPECIAL_ID", label: "Special ID", tone: "bg-emerald-100 text-emerald-800 border-emerald-300", make: () => ({ type: "SPECIAL_ID", days: null }) },
  { key: "SVIP", label: "SVIP days", tone: "bg-yellow-100 text-yellow-900 border-yellow-300", make: () => ({ type: "SVIP", tier: 1, days: 7 }) },
];
const FILTER_CHIPS: { key: Filter["type"]; label: string; make: (cats: { id: number }[]) => Filter }[] = [
  { key: "EVENT_GIFTS", label: "Only this event's gifts", make: () => ({ type: "EVENT_GIFTS" }) },
  { key: "GIFT_CATEGORIES", label: "Only gift categories", make: (c) => ({ type: "GIFT_CATEGORIES", ids: c[0] ? [c[0].id] : [] }) },
  { key: "HOSTS_ONLY", label: "Agency hosts only", make: () => ({ type: "HOSTS_ONLY" }) },
  { key: "JOINED_AFTER", label: "Joined after a date", make: () => ({ type: "JOINED_AFTER", date: new Date().toISOString().slice(0, 10) }) },
  { key: "MIN_LEVEL", label: "Minimum level", make: () => ({ type: "MIN_LEVEL", level: 5 }) },
];
const GIFT_ONLY: Filter["type"][] = ["EVENT_GIFTS", "GIFT_CATEGORIES"];
const isGifts = (m: string) => m === "GIFTS_SENT" || m === "GIFTS_RECEIVED" || m === "ROOM_GIFTS";
const filterFits = (m: string, f: Filter["type"]) => (m === "CP_POINTS" ? false : m === "ROOM_GIFTS" ? GIFT_ONLY.includes(f) : isGifts(m) || !GIFT_ONLY.includes(f));

const chipKey = (r: RewardItem, items: ItemOption[]) => (r.type === "ITEM" ? (items.find((i) => i.id === r.id)?.kind ?? "AVATAR_FRAME") : r.type);
const num = (v: string) => Number(v.replace(/[^0-9]/g, "")) || 0;
const daysOf = (v: string) => (v.trim() ? Math.max(1, num(v)) : null);
// The picture inside an item's SVG (uploaded items), for a thumbnail.
const thumb = (i?: ItemOption) => i?.svg.match(/href="([^"]+)"/)?.[1] ?? null;

function drag(e: DragEvent, kind: "reward" | "filter", key: string) {
  e.dataTransfer.setData("text/plain", `${kind}:${key}`);
  e.dataTransfer.effectAllowed = "copy";
}
const dropped = (e: DragEvent, kind: "reward" | "filter") => {
  const [k, key] = e.dataTransfer.getData("text/plain").split(":");
  return k === kind ? key : null;
};

export function EventPartBuilder({
  kind,
  eventId,
  index,
  initial,
  items,
  categories,
  action,
  onRemove,
}: {
  kind: "board" | "task";
  eventId: string;
  index: string;
  initial?: Part;
  items: ItemOption[];
  categories: { id: number; name: string }[];
  action: (f: FormData) => Promise<void>;
  onRemove?: ReactNode;
}) {
  const [p, setP] = useState<Part>(
    initial ?? {
      id: "",
      title: kind === "board" ? "Top Gifters" : "",
      metric: "GIFTS_SENT",
      game: "ALL",
      filters: [],
      ...(kind === "board" ? { size: 10, rewards: [{ from: 1, to: 1, min: 1000, items: [] }] } : { target: 1000, daily: false, reward: { items: [] } }),
    },
  );
  const [over, setOver] = useState<string | null>(null);
  const set = (patch: Partial<Part>) => setP((x) => ({ ...x, ...patch }));
  const metrics = METRICS.filter((m) => kind === "board" || (m.v !== "ROOM_GIFTS" && m.v !== "CP_POINTS"));

  // Prizes: a board's rank cards, or a task's single reward (held as card 0).
  const prizes: Prize[] = kind === "board" ? (p.rewards ?? []) : [{ from: 1, to: 1, items: p.reward?.items ?? [] }];
  const setPrizes = (next: Prize[]) => (kind === "board" ? set({ rewards: next }) : set({ reward: { items: next[0]?.items ?? [] } }));
  const setPrize = (i: number, patch: Partial<Prize>) => setPrizes(prizes.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addReward = (i: number, key: string) => {
    const r = REWARD_CHIPS.find((c) => c.key === key)?.make(items);
    if (r) setPrize(i, { items: [...prizes[i]!.items, r] });
  };
  const addFilter = (key: string) => {
    const f = FILTER_CHIPS.find((c) => c.key === key);
    if (f && filterFits(p.metric, f.key) && !p.filters.some((x) => x.type === f.key)) set({ filters: [...p.filters, f.make(categories)] });
  };
  const usableFilters = FILTER_CHIPS.filter((f) => filterFits(p.metric, f.key) && !p.filters.some((x) => x.type === f.key));
  const missingKinds = REWARD_CHIPS.filter((c) => !c.make(items)).map((c) => c.label);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="index" value={index} />
      <input type="hidden" name="part" value={JSON.stringify({ ...p, filters: p.filters.filter((f) => filterFits(p.metric, f.type)) })} />

      {/* 1. What counts */}
      <section className="space-y-3">
        <h4 className="text-sm font-bold">1. What counts</h4>
        <div className={`grid gap-3 ${kind === "board" ? "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px]" : "sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px]"}`}>
          <Label text="Title">
            <input required maxLength={kind === "board" ? 40 : 60} value={p.title} onChange={(e) => set({ title: e.target.value })} placeholder={kind === "task" ? "Send 1,000 coins of gifts" : ""} className={input} />
          </Label>
          <Label text="Counts">
            <select value={p.metric} onChange={(e) => set({ metric: e.target.value })} className={input}>
              {metrics.map((m) => (
                <option key={m.v} value={m.v}>
                  {m.l}
                </option>
              ))}
            </select>
          </Label>
          {kind === "board" ? (
            <Label text="Ranks shown">
              <input inputMode="numeric" value={p.size ?? 10} onChange={(e) => set({ size: Math.min(100, Math.max(1, num(e.target.value))) })} className={input} />
            </Label>
          ) : (
            <Label text="Target">
              <input inputMode="numeric" value={p.target ?? ""} onChange={(e) => set({ target: num(e.target.value) })} className={input} />
            </Label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {p.metric === "GAME_WINS" && (
            <Label text="Game" inline>
              <select value={p.game} onChange={(e) => set({ game: e.target.value })} className={input}>
                {GAMES.map((g) => (
                  <option key={g.v} value={g.v}>
                    {g.l}
                  </option>
                ))}
              </select>
            </Label>
          )}
          {kind === "task" && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={!!p.daily} onChange={(e) => set({ daily: e.target.checked })} className="h-4 w-4 accent-primary-strong" /> Daily (resets each day)
            </label>
          )}
        </div>

        {p.metric !== "CP_POINTS" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setOver("filters");
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const key = dropped(e, "filter");
              if (key) addFilter(key);
            }}
            className={`rounded-xl border-2 border-dashed p-3 ${over === "filters" ? "border-primary bg-primary/5" : "border-line"}`}
          >
            <p className="text-xs font-semibold text-muted">Filters (optional): drag a block here, or tap one to add it</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {usableFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  draggable
                  onDragStart={(e) => drag(e, "filter", f.key)}
                  onClick={() => addFilter(f.key)}
                  className="cursor-grab rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold hover:border-primary active:cursor-grabbing"
                >
                  + {f.label}
                </button>
              ))}
            </div>
            {p.filters.filter((f) => filterFits(p.metric, f.type)).length > 0 && (
              <ul className="mt-3 space-y-2">
                {p.filters
                  .filter((f) => filterFits(p.metric, f.type))
                  .map((f) => (
                    <li key={f.type} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-high px-3 py-2 text-sm">
                      <FilterEditor f={f} categories={categories} onChange={(nf) => set({ filters: p.filters.map((x) => (x.type === f.type ? nf : x)) })} />
                      <button type="button" aria-label="Remove filter" onClick={() => set({ filters: p.filters.filter((x) => x.type !== f.type) })} className="ml-auto rounded px-2 text-muted hover:text-danger">
                        ✕
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* 2. Prizes */}
      {(kind === "task" || p.metric !== "ROOM_GIFTS") && (
        <section className="space-y-3">
          <h4 className="text-sm font-bold">2. {kind === "board" ? "Prizes by rank" : "Reward"}</h4>
          <div className="sticky top-14 z-10 rounded-xl border border-line bg-surface p-3 shadow-sm lg:top-2">
            <p className="text-xs font-semibold text-muted">Reward items: drag onto a prize{kind === "board" ? " card" : ""}, or use + Add on the card</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {REWARD_CHIPS.map((c) => {
                const ok = !!c.make(items);
                return (
                  <span
                    key={c.key}
                    draggable={ok}
                    onDragStart={(e) => drag(e, "reward", c.key)}
                    title={ok ? `Drag ${c.label} onto a prize` : `Create a ${c.label.toLowerCase()} in Items first`}
                    className={`rounded-full border px-3 py-1 text-xs font-bold ${ok ? `${c.tone} cursor-grab active:cursor-grabbing` : "border-line bg-surface-high text-muted opacity-60"}`}
                  >
                    {c.label}
                  </span>
                );
              })}
            </div>
            {missingKinds.length > 0 && <p className="mt-2 text-xs text-muted">Greyed out: none made yet. Add them in Items.</p>}
          </div>

          {prizes.map((prize, i) => (
            <div
              key={i}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(`prize${i}`);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const key = dropped(e, "reward");
                if (key) addReward(i, key);
              }}
              className={`rounded-xl border-2 p-3 transition-colors ${over === `prize${i}` ? "border-primary bg-primary/5" : "border-line bg-surface"}`}
            >
              {kind === "board" && (
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
                  Rank
                  <input aria-label="From rank" inputMode="numeric" value={prize.from} onChange={(e) => setPrize(i, { from: Math.max(1, num(e.target.value)), to: Math.max(prize.to, num(e.target.value)) })} className={`${input} w-16`} />
                  to
                  <input aria-label="To rank" inputMode="numeric" value={prize.to} onChange={(e) => setPrize(i, { to: Math.max(prize.from, num(e.target.value)) })} className={`${input} w-16`} />
                  <span className="ml-2">needs at least</span>
                  <input aria-label="Minimum score to win" inputMode="numeric" value={prize.min ?? ""} onChange={(e) => setPrize(i, { min: num(e.target.value) })} placeholder="min" className={`${input} w-28`} />
                  <button type="button" onClick={() => setPrizes(prizes.filter((_, j) => j !== i))} className="ml-auto text-xs font-semibold text-muted hover:text-danger">
                    Remove prize
                  </button>
                </div>
              )}
              {prize.items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-muted">Drop reward items here</p>
              ) : (
                <ul className="space-y-2">
                  {prize.items.map((r, j) => (
                    <li key={j} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-high px-3 py-2 text-sm">
                      <RewardEditor r={r} items={items} onChange={(nr) => setPrize(i, { items: prize.items.map((x, k) => (k === j ? nr : x)) })} />
                      <button type="button" aria-label="Remove reward" onClick={() => setPrize(i, { items: prize.items.filter((_, k) => k !== j) })} className="ml-auto rounded px-2 text-muted hover:text-danger">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2">
                <select
                  aria-label="Add a reward item"
                  value=""
                  onChange={(e) => e.target.value && addReward(i, e.target.value)}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-primary-strong"
                >
                  <option value="">+ Add reward</option>
                  {REWARD_CHIPS.filter((c) => c.make(items)).map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {kind === "board" && (
            <button
              type="button"
              onClick={() => {
                const last = prizes.at(-1);
                setPrizes([...prizes, { from: (last?.to ?? 0) + 1, to: (last?.to ?? 0) + 1, min: last?.min, items: [] }]);
              }}
              className={ghost}
            >
              + Add a prize for more ranks
            </button>
          )}
          {kind === "board" && <p className="text-xs text-muted">Each prize needs a minimum score: a rank below it wins nothing. It&apos;s shown on the event&apos;s Rules page.</p>}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <button className={button}>Save {kind === "board" ? "leaderboard" : "task"}</button>
        {onRemove}
      </div>
    </form>
  );
}

function Label({ text, children, inline }: { text: string; children: ReactNode; inline?: boolean }) {
  return (
    <label className={`flex gap-1 text-sm font-semibold ${inline ? "items-center gap-2" : "flex-col"}`}>
      {text}
      {children}
    </label>
  );
}

function RewardEditor({ r, items, onChange }: { r: RewardItem; items: ItemOption[]; onChange: (r: RewardItem) => void }) {
  const chip = REWARD_CHIPS.find((c) => c.key === chipKey(r, items))!;
  const tag = <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${chip.tone}`}>{chip.label}</span>;
  const days = (d: number | null, allowForever = true) => (
    <>
      for
      <input aria-label="Days" inputMode="numeric" value={d ?? ""} placeholder={allowForever ? "forever" : "days"} onChange={(e) => onChange({ ...r, days: allowForever ? daysOf(e.target.value) : Math.max(1, num(e.target.value)) } as RewardItem)} className={`${input} h-8 w-24`} />
      {d === null && allowForever ? "" : "days"}
    </>
  );
  if (r.type === "COINS")
    return (
      <>
        {tag}
        <input aria-label="Coins" inputMode="numeric" value={r.amount} onChange={(e) => onChange({ ...r, amount: num(e.target.value) })} className={`${input} h-8 w-32`} /> coins
      </>
    );
  if (r.type === "SPECIAL_ID")
    return (
      <>
        {tag} winner picks their own ID, {days(r.days)}
      </>
    );
  if (r.type === "SVIP")
    return (
      <>
        {tag}
        <select aria-label="SVIP tier" value={r.tier} onChange={(e) => onChange({ ...r, tier: Number(e.target.value) })} className={`${input} h-8`}>
          {[1, 2, 3, 4, 5, 6].map((t) => (
            <option key={t} value={t}>
              SVIP{t}
            </option>
          ))}
        </select>
        {days(r.days, false)}
      </>
    );
  const kind = r.type === "BADGE" ? "BADGE" : chipKey(r, items);
  const pick = items.find((i) => i.id === r.id);
  const src = thumb(pick);
  return (
    <>
      {tag}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the API
        <img src={src} alt="" className="h-8 w-8 rounded object-contain" />
      ) : pick?.svga ? (
        <span className="rounded bg-night px-1.5 py-0.5 text-[10px] font-bold text-white">SVGA</span>
      ) : null}
      <select aria-label="Which item" value={r.id} onChange={(e) => onChange({ ...r, id: e.target.value })} className={`${input} h-8 max-w-48`}>
        {items
          .filter((i) => i.kind === kind)
          .map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
      </select>
      {days(r.days)}
    </>
  );
}

function FilterEditor({ f, categories, onChange }: { f: Filter; categories: { id: number; name: string }[]; onChange: (f: Filter) => void }) {
  if (f.type === "EVENT_GIFTS") return <span className="font-semibold">Only this event&apos;s gifts (its gift category)</span>;
  if (f.type === "HOSTS_ONLY") return <span className="font-semibold">Only agency hosts</span>;
  if (f.type === "JOINED_AFTER")
    return (
      <>
        <span className="font-semibold">Only users who joined on or after</span>
        <input type="date" value={f.date} onChange={(e) => onChange({ ...f, date: e.target.value })} className={`${input} h-8`} />
      </>
    );
  if (f.type === "MIN_LEVEL")
    return (
      <>
        <span className="font-semibold">Only level</span>
        <input inputMode="numeric" value={f.level} onChange={(e) => onChange({ ...f, level: Math.max(1, num(e.target.value)) })} className={`${input} h-8 w-20`} />
        <span className="font-semibold">and above</span>
      </>
    );
  return (
    <>
      <span className="font-semibold">Only gifts in</span>
      {categories.map((c) => (
        <label key={c.id} className="flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-xs">
          <input
            type="checkbox"
            checked={f.ids.includes(c.id)}
            onChange={(e) => onChange({ ...f, ids: e.target.checked ? [...f.ids, c.id] : f.ids.filter((x) => x !== c.id) })}
            className="h-3.5 w-3.5 accent-primary-strong"
          />
          {c.name}
        </label>
      ))}
    </>
  );
}

// Reward items for one person (Give to user): the same tray and item cards, as a hidden "items" field.
export function RewardItemsField({ items }: { items: ItemOption[] }) {
  const [list, setList] = useState<RewardItem[]>([]);
  const [over, setOver] = useState(false);
  const add = (key: string) => {
    const r = REWARD_CHIPS.find((c) => c.key === key)?.make(items);
    if (r) setList((l) => [...l, r]);
  };
  return (
    <div className="space-y-3">
      <input type="hidden" name="items" value={JSON.stringify(list)} />
      <div className="rounded-xl border border-line bg-surface p-3">
        <p className="text-xs font-semibold text-muted">Drag what to give into the box below, or tap it</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REWARD_CHIPS.map((c) => {
            const ok = !!c.make(items);
            return (
              <button
                key={c.key}
                type="button"
                disabled={!ok}
                draggable={ok}
                onDragStart={(e) => drag(e, "reward", c.key)}
                onClick={() => add(c.key)}
                title={ok ? undefined : `Create a ${c.label.toLowerCase()} in Items first`}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${ok ? `${c.tone} cursor-grab active:cursor-grabbing` : "border-line bg-surface-high text-muted opacity-60"}`}
              >
                + {c.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const key = dropped(e, "reward");
          if (key) add(key);
        }}
        className={`rounded-xl border-2 p-3 ${over ? "border-primary bg-primary/5" : "border-line bg-surface"}`}
      >
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted">Drop items here</p>
        ) : (
          <ul className="space-y-2">
            {list.map((r, j) => (
              <li key={j} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-high px-3 py-2 text-sm">
                <RewardEditor r={r} items={items} onChange={(nr) => setList((l) => l.map((x, k) => (k === j ? nr : x)))} />
                <button type="button" aria-label="Remove" onClick={() => setList((l) => l.filter((_, k) => k !== j))} className="ml-auto rounded px-2 text-muted hover:text-danger">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
