import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { button, Flash, first, fmt, ghost, Hidden, input, Pill } from "@/components/ui";
import { ArtPreview } from "@/components/ArtPreview";
import { api, can, requireMe } from "@/lib/api";
import { createCategory, createGift, updateCategory, updateGift } from "../../../actions";

type Change = { changes: Record<string, [unknown, unknown]>; at: string; by: string | null; byId: number };
type Gift = {
  id: string;
  name: string;
  assetUrl: string;
  svg: string | null;
  effect: string | null;
  coinPrice: number;
  maxQuantity: number;
  sortOrder: number;
  enabled: boolean;
  categoryId: number;
  changes: Change[];
};
type Category = { id: number; name: string; sortOrder: number; enabled: boolean; gifts: number };

const FIELD: Record<string, string> = {
  name: "Name",
  categoryId: "Category",
  coinPrice: "Price",
  maxQuantity: "Max per send",
  sortOrder: "Position",
  enabled: "In the gift box",
  assetUrl: "Icon",
  effect: "Animation",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const select = `${input} pr-8`;

// Admins and the owner manage the gift box: categories (its tabs), and per gift its category, price, limits, art and
// whether it shows. One category at a time, one slim row per gift; a row opens to edit, preview and see its changes.
export default async function Gifts({ searchParams }: PageProps<"/admin/gifts">) {
  const me = await requireMe();
  if (!can(me, "gifts.manage")) redirect("/dashboard");
  const sp = await searchParams;
  const [{ gifts }, { categories }] = await Promise.all([
    api<{ gifts: Gift[] }>("GET", "/admin/gifts"),
    api<{ categories: Category[] }>("GET", "/admin/gift-categories"),
  ]);

  const q = first(sp.q).trim().toLowerCase();
  const tab = first(sp.cat) || String(categories[0]?.id ?? "all");
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const shown = q
    ? gifts.filter((g) => g.name.toLowerCase().includes(q) || g.id.includes(q))
    : tab === "all"
      ? gifts
      : tab === "hidden"
        ? gifts.filter((g) => !g.enabled)
        : gifts.filter((g) => String(g.categoryId) === tab);
  const back = `/admin/gifts?cat=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const value = (field: string, v: unknown) =>
    v == null
      ? "none"
      : field === "assetUrl" || field === "effect"
        ? "file"
        : field === "categoryId"
          ? (catName.get(Number(v)) ?? `#${v}`)
          : typeof v === "boolean"
            ? v ? "yes" : "no"
            : typeof v === "number"
              ? fmt(v)
              : String(v);
  const tabs = [
    ...categories.map((c) => ({ key: String(c.id), label: c.name, n: gifts.filter((g) => g.categoryId === c.id).length, off: !c.enabled })),
    { key: "all", label: "All", n: gifts.length, off: false },
    { key: "hidden", label: "Hidden gifts", n: gifts.filter((g) => !g.enabled).length, off: false },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Gifts</h1>
          <p className="mt-1 text-sm text-muted">Categories are the gift box tabs. New gifts start hidden: preview, then Show. The app picks up changes when the gift box opens.</p>
        </div>
        <form className="flex gap-2" role="search">
          <input type="hidden" name="cat" value={tab} />
          <input name="q" defaultValue={q} placeholder="Search gifts" aria-label="Search gifts" className={`${input} w-56`} />
          <button className={ghost}>Search</button>
        </form>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <nav className="flex flex-wrap gap-1 border-b border-line" aria-label="Gift categories">
        {tabs.map((t) => {
          const on = !q && t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/admin/gifts?cat=${t.key}`}
              aria-current={on ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${on ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.label} <span className="text-muted">({t.n})</span>
              {t.off && <span className="ml-1 text-xs text-muted">hidden</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap gap-2">
        <Panel label="Add a gift">
          <form action={createGift} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Hidden name="back" value={back} />
            <Field label="Name">
              <input name="name" required maxLength={24} className={input} />
            </Field>
            <Field label="Category">
              <CategorySelect categories={categories} value={Number(tab) || categories[0]?.id} />
            </Field>
            <Field label="Price (coins)">
              <input name="coinPrice" required inputMode="numeric" pattern="[0-9, ]+" className={input} />
            </Field>
            <Field label="Max per send">
              <input name="maxQuantity" inputMode="numeric" pattern="[0-9]+" defaultValue="99" className={input} />
            </Field>
            <Field label="Position (lower shows first)">
              <input name="sortOrder" inputMode="numeric" pattern="[0-9]+" defaultValue="100" className={input} />
            </Field>
            <Field label="Icon in the gift box: PNG or WebP (max 1 MB)">
              <input name="icon" type="file" required accept=".svga,image/png,image/webp,image/jpeg" className="text-sm" />
            </Field>
            <Field label="Effect when sent: SVGA, PNG or WebP (max 15 MB)">
              <input name="effect" type="file" accept=".svga,image/png,image/webp,image/jpeg" className="text-sm" />
            </Field>
            <div className="flex items-end">
              <button className={button}>Add gift</button>
            </div>
          </form>
        </Panel>

        <Panel label="Categories">
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                <form action={updateCategory} className="flex flex-wrap items-center gap-2">
                  <Hidden name="back" value={back} />
                  <Hidden name="id" value={String(c.id)} />
                  <input name="name" required maxLength={20} defaultValue={c.name} aria-label="Category name" className={`${input} w-40`} />
                  <input name="sortOrder" required inputMode="numeric" pattern="[0-9]+" defaultValue={c.sortOrder} aria-label={`Position of ${c.name}`} className={`${input} w-20`} />
                  <button className={ghost}>Save</button>
                </form>
                <form action={updateCategory}>
                  <Hidden name="back" value={back} />
                  <Hidden name="id" value={String(c.id)} />
                  <Hidden name="enabled" value={String(!c.enabled)} />
                  <button className={ghost}>{c.enabled ? "Hide" : "Show"}</button>
                </form>
                <span className="text-sm text-muted">
                  {c.gifts} {c.gifts === 1 ? "gift" : "gifts"}
                  {!c.enabled && ", hidden from the gift box"}
                </span>
              </li>
            ))}
          </ul>
          <form action={createCategory} className="mt-3 flex flex-wrap gap-2">
            <Hidden name="back" value={back} />
            <input name="name" required maxLength={20} placeholder="New category" aria-label="New category name" className={`${input} w-40`} />
            <input name="sortOrder" inputMode="numeric" pattern="[0-9]+" placeholder="Position" aria-label="Position" className={`${input} w-24`} />
            <button className={button}>Add category</button>
          </form>
          <p className="mt-2 text-xs text-muted">Tabs show in position order (lower first). Hiding a category hides its gifts from the gift box.</p>
        </Panel>
      </div>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="hidden grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_110px_90px_80px_120px] gap-3 border-b border-line px-4 py-2 text-xs font-semibold text-muted sm:grid">
          <span />
          <span>Gift</span>
          <span>Category</span>
          <span>Price</span>
          <span>Max/send</span>
          <span>Position</span>
          <span>Status</span>
        </div>
        {!shown.length && <p className="px-4 py-6 text-sm text-muted">{q ? "No gifts match that search." : "No gifts here yet."}</p>}
        {shown.map((g) => (
          <details key={g.id} className="group border-b border-line last:border-b-0">
            <summary className="grid cursor-pointer list-none grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 hover:bg-surface-high sm:grid-cols-[40px_minmax(0,2fr)_minmax(0,1fr)_110px_90px_80px_120px]">
              <Icon gift={g} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{g.name}</span>
                <span className="block truncate font-mono text-xs text-muted sm:hidden">
                  {fmt(g.coinPrice)} coins, {catName.get(g.categoryId)}
                </span>
              </span>
              <span className="hidden truncate text-sm sm:block">{catName.get(g.categoryId)}</span>
              <span className="hidden text-sm font-semibold sm:block">{fmt(g.coinPrice)}</span>
              <span className="hidden text-sm sm:block">{g.maxQuantity}</span>
              <span className="hidden text-sm sm:block">{g.sortOrder}</span>
              <span className="flex flex-wrap gap-1">
                <Pill tone={g.enabled ? "success" : "muted"}>{g.enabled ? "shown" : "hidden"}</Pill>
                {g.effect && <Pill tone="primary">anim</Pill>}
              </span>
            </summary>

            <div className="space-y-4 bg-bg px-4 py-4">
              <form action={updateGift} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Hidden name="back" value={back} />
                <Hidden name="giftId" value={g.id} />
                <Field label="Name">
                  <input name="name" required maxLength={24} defaultValue={g.name} className={input} />
                </Field>
                <Field label="Category">
                  <CategorySelect categories={categories} value={g.categoryId} />
                </Field>
                <Field label="Price (coins)">
                  <input name="coinPrice" required inputMode="numeric" pattern="[0-9, ]+" defaultValue={g.coinPrice} className={input} />
                </Field>
                <Field label="Max per send">
                  <input name="maxQuantity" required inputMode="numeric" pattern="[0-9]+" defaultValue={g.maxQuantity} className={input} />
                </Field>
                <Field label="Position">
                  <input name="sortOrder" required inputMode="numeric" pattern="[0-9]+" defaultValue={g.sortOrder} className={input} />
                </Field>
                <Field label="Replace icon (PNG/WebP)">
                  <input name="icon" type="file" accept=".svga,image/png,image/webp,image/jpeg" className="text-sm" />
                </Field>
                <Field label={`${g.effect ? "Replace" : "Add"} effect (SVGA, PNG or WebP)`}>
                  <input name="effect" type="file" accept=".svga,image/png,image/webp,image/jpeg" className="text-sm" />
                </Field>
                <div className="flex items-end">
                  <button className={ghost}>Save changes</button>
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-3">
                <form action={updateGift}>
                  <Hidden name="back" value={back} />
                  <Hidden name="giftId" value={g.id} />
                  <Hidden name="enabled" value={String(!g.enabled)} />
                  <button className={g.enabled ? ghost : button}>{g.enabled ? "Hide from gift box" : "Show in gift box"}</button>
                </form>
                <span className="font-mono text-xs text-muted">{g.id}</span>
              </div>

              {g.effect && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">Preview animation</summary>
                  <iframe
                    title={`${g.name} animation`}
                    src={`/games/fx/preview.html?play=${encodeURIComponent(g.effect)}`}
                    loading="lazy"
                    className="mt-2 h-96 w-full max-w-md rounded-xl border border-line"
                  />
                </details>
              )}

              {g.changes.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold">Change log ({g.changes.length})</summary>
                  <ul className="mt-2 space-y-2 text-sm">
                    {g.changes.map((c, i) => (
                      <li key={i}>
                        <span className="text-muted">
                          {when(c.at)}, {c.by ?? "(no name)"} ({c.byId})
                        </span>
                        <br />
                        {Object.entries(c.changes)
                          .map(([k, [from, to]]) => `${FIELD[k] ?? k}: ${from == null ? value(k, to) : `${value(k, from)} to ${value(k, to)}`}`)
                          .join(", ")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </details>
        ))}
      </section>
    </>
  );
}

// A collapsed section opened by its button-like label (no client JS).
function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="w-full rounded-2xl border border-line bg-surface open:p-4 [&:not([open])]:w-auto">
      <summary className={`${ghost} inline-flex list-none items-center border-0`}>{label}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function CategorySelect({ categories, value }: { categories: Category[]; value?: number }) {
  return (
    <select name="categoryId" defaultValue={value} className={select}>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.enabled ? "" : " (hidden)"}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

// Uploaded icons are served by the API (/games/...); built-in gifts may carry SVG art instead. Hover to see the animation.
function Icon({ gift }: { gift: Gift }) {
  const src = gift.assetUrl.startsWith("games/") ? `/${gift.assetUrl}` : gift.svg ? `data:image/svg+xml;utf8,${encodeURIComponent(gift.svg)}` : null;
  return <ArtPreview image={src} svga={gift.effect} label={gift.name} />;
}
