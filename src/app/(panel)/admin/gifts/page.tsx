import { redirect } from "next/navigation";
import { button, Card, Flash, fmt, ghost, Hidden, input, Pill } from "@/components/ui";
import { api, isStaff, requireMe } from "@/lib/api";
import { createGift, updateGift } from "../../../actions";

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
  changes: Change[];
};

const FIELD: Record<string, string> = {
  name: "Name",
  coinPrice: "Price",
  maxQuantity: "Max per send",
  sortOrder: "Position",
  enabled: "In the gift box",
  assetUrl: "Icon",
  effect: "Animation",
};
const shown = (field: string, v: unknown) =>
  v == null ? "none" : field === "assetUrl" || field === "effect" ? "file" : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "number" ? fmt(v) : String(v);
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

// Admins and the owner add gifts, set prices and limits, replace art, preview animations and hide or show gifts.
// The app's gift box reads this catalog each time it opens, so changes need no app update.
export default async function Gifts({ searchParams }: PageProps<"/admin/gifts">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const { gifts } = await api<{ gifts: Gift[] }>("GET", "/admin/gifts");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Gifts</h1>
        <p className="mt-1 text-sm text-muted">
          New gifts start hidden. Preview the animation, then press Show to put it in the gift box. Changes reach the app the next time someone opens the gift box.
        </p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="Add a gift" hint="Icon: PNG or WebP, square, up to 1 MB. Animation (optional): an SVGA 2.x file up to 15 MB; sound inside it plays too.">
        <form action={createGift} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name">
            <input name="name" required maxLength={24} className={input} />
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
          <Field label="Icon">
            <input name="icon" type="file" required accept="image/png,image/webp" className="text-sm" />
          </Field>
          <Field label="Animation">
            <input name="effect" type="file" accept=".svga" className="text-sm" />
          </Field>
          <div className="flex items-end sm:col-span-2">
            <button className={button}>Add gift</button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {gifts.map((g) => (
          <Card
            key={g.id}
            title={g.name}
            hint={
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone="gold">{fmt(g.coinPrice)} coins</Pill>
                <Pill tone={g.enabled ? "success" : "muted"}>{g.enabled ? "in the gift box" : "hidden"}</Pill>
                {g.effect && <Pill tone="primary">animation</Pill>}
                <span className="font-mono text-xs">{g.id}</span>
              </span>
            }
          >
            <div className="flex gap-4">
              <Icon gift={g} />
              <form action={updateGift} className="grid flex-1 gap-2 sm:grid-cols-2">
                <Hidden name="giftId" value={g.id} />
                <Field label="Name">
                  <input name="name" required maxLength={24} defaultValue={g.name} className={input} />
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
                <Field label="Replace icon">
                  <input name="icon" type="file" accept="image/png,image/webp" className="text-sm" />
                </Field>
                <Field label={g.effect ? "Replace animation" : "Add animation"}>
                  <input name="effect" type="file" accept=".svga" className="text-sm" />
                </Field>
                <div className="sm:col-span-2">
                  <button className={ghost}>Save changes</button>
                </div>
              </form>
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-2">
              <form action={updateGift}>
                <Hidden name="giftId" value={g.id} />
                <Hidden name="enabled" value={String(!g.enabled)} />
                <button className={g.enabled ? ghost : button}>{g.enabled ? "Hide" : "Show"}</button>
              </form>
            </div>

            {g.effect && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">Preview animation</summary>
                <iframe
                  title={`${g.name} animation`}
                  src={`/games/fx/preview.html?play=${encodeURIComponent(g.effect)}`}
                  loading="lazy"
                  className="mt-2 h-96 w-full rounded-xl border border-line"
                />
              </details>
            )}

            {g.changes.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold">Change log</summary>
                <ul className="mt-2 space-y-2 text-sm">
                  {g.changes.map((c, i) => (
                    <li key={i}>
                      <span className="text-muted">
                        {when(c.at)}, {c.by ?? "(no name)"} ({c.byId})
                      </span>
                      <br />
                      {Object.entries(c.changes)
                        .map(([k, [from, to]]) => (from == null ? `${FIELD[k] ?? k}: ${shown(k, to)}` : `${FIELD[k] ?? k}: ${shown(k, from)} to ${shown(k, to)}`))
                        .join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      {children}
    </label>
  );
}

// Uploaded icons are served by the API (/games/...); built-in gifts may carry SVG art instead.
function Icon({ gift }: { gift: Gift }) {
  const src = gift.assetUrl.startsWith("games/")
    ? `/${gift.assetUrl}`
    : gift.svg
      ? `data:image/svg+xml;utf8,${encodeURIComponent(gift.svg)}`
      : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- served by the API, not part of the site build
    <img src={src} alt="" width={72} height={72} className="h-18 w-18 shrink-0 rounded-xl bg-surface-high object-contain p-1" />
  ) : (
    <span className="flex h-18 w-18 shrink-0 items-center justify-center rounded-xl bg-surface-high text-2xl font-extrabold text-muted">{gift.name[0]}</span>
  );
}
