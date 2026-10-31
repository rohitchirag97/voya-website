import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { button, Card, Flash, ghost, Hidden, input, Pill } from "@/components/ui";
import { api, isStaff, requireMe } from "@/lib/api";
import { createItem, updateItem } from "../../../actions";

type Kind = "BADGE" | "AVATAR_FRAME" | "CARD_DECOR" | "CHAT_BUBBLE" | "ENTRY_EFFECT";
type Item = {
  kind: Kind;
  id: string;
  name: string;
  description: string;
  svg: string;
  svga: string | null;
  style: { gradient: string[]; border: string; text: string } | null;
  enabled: boolean;
  forPrize: boolean;
  forMall: boolean;
};

const KINDS: { kind: Kind; title: string; hint: string }[] = [
  { kind: "BADGE", title: "Badges", hint: "Shown on profiles. A square PNG/WebP (about 200 × 200), or an animated SVGA." },
  { kind: "AVATAR_FRAME", title: "Avatar frames", hint: "Worn around the profile picture. Square PNG/WebP (about 400 × 400) with a clear middle (the photo fills the centre 70%), or an animated SVGA." },
  { kind: "CARD_DECOR", title: "Profile card decorations", hint: "The picture behind the profile card. Wide PNG/WebP, about 1000 × 400." },
  { kind: "CHAT_BUBBLE", title: "Chat bubbles", hint: "Pick the bubble's colours. Optional: a small corner picture (PNG/WebP, about 88 × 52)." },
  { kind: "ENTRY_EFFECT", title: "Entry effects", hint: "An SVGA animation that plays when the owner enters a room." },
];
// The picture inside an uploaded item's SVG (older built-in items are drawn SVG and show as "drawn").
const picture = (svg: string) => svg.match(/href="([^"]+)"/)?.[1] ?? null;

// Every item made here: an event prize (events pick from these) and/or a Mall item (sold once the Mall opens; hidden
// until then). Only people who own one can wear it: won, given (Give to user), or bought. Owner and Admin only.
export default async function Items({ searchParams }: PageProps<"/admin/items">) {
  const me = await requireMe();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const { items } = await api<{ items: Item[] }>("GET", "/admin/items");

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">Items</h1>
        <p className="mt-1 text-sm text-muted">Badges, frames, profile cards, chat bubbles and entry effects. Tick Event prize to use one in events, Mall item to sell it once the Mall opens.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      {KINDS.map(({ kind, title, hint }) => {
        const list = items.filter((i) => i.kind === kind);
        return (
          <Card key={kind} title={title} hint={hint}>
            <details className="mb-4 rounded-xl border border-dashed border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-primary-strong">New {title.toLowerCase().replace(/s$/, "")}</summary>
              <div className="px-3 pb-3">
                <ItemForm kind={kind} />
              </div>
            </details>
            {!list.length ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((i) => (
                  <li key={i.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-3">
                      <Thumb item={i} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{i.name}</span>
                        {i.description && <span className="block truncate text-xs text-muted">{i.description}</span>}
                      </span>
                      <span className="flex flex-col items-end gap-1">
                        {i.forPrize && <Pill tone="gold">Event prize</Pill>}
                        {i.forMall && <Pill tone="primary">Mall</Pill>}
                        {!i.enabled && <Pill>hidden</Pill>}
                      </span>
                    </div>
                    {i.svga && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold">Play animation</summary>
                        <iframe title={`${i.name} animation`} src={`/games/fx/preview.html?play=${encodeURIComponent("/" + i.svga)}`} loading="lazy" className="mt-2 h-72 w-full rounded-xl border border-line" />
                      </details>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold">Edit</summary>
                      <div className="pt-2">
                        <ItemForm kind={kind} item={i} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </>
  );
}

function Thumb({ item }: { item: Item }) {
  const src = picture(item.svg);
  if (item.kind === "CHAT_BUBBLE" && item.style)
    return (
      <span className="flex h-12 w-16 items-center justify-center rounded-xl border-2 text-xs font-bold" style={{ background: `linear-gradient(135deg, ${item.style.gradient[0]}, ${item.style.gradient[1]})`, borderColor: item.style.border, color: item.style.text }}>
        Hi!
      </span>
    );
  if (src)
    // eslint-disable-next-line @next/next/no-img-element -- served by the API
    return <img src={src} alt="" className={`h-12 rounded-lg bg-surface-high ${item.kind === "CARD_DECOR" ? "w-28 object-cover" : "w-12 object-contain"}`} />;
  return <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-night text-[10px] font-bold text-white">{item.svga ? "SVGA" : "drawn"}</span>;
}

function ItemForm({ kind, item }: { kind: Kind; item?: Item }) {
  return (
    <form action={item ? updateItem : createItem} className="grid gap-3 sm:grid-cols-2">
      <Hidden name="kind" value={kind} />
      {item && <Hidden name="itemId" value={item.id} />}
      <Field label="Name">
        <input name="name" required maxLength={40} defaultValue={item?.name} className={input} />
      </Field>
      {kind === "BADGE" ? (
        <Field label="Description (shown when tapped)">
          <input name="description" maxLength={120} defaultValue={item?.description} className={input} />
        </Field>
      ) : (
        <span />
      )}
      {kind === "CHAT_BUBBLE" && (
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          {(
            [
              ["from", "Colour 1", item?.style?.gradient[0] ?? "#08C9D9"],
              ["to", "Colour 2", item?.style?.gradient[1] ?? "#077F8C"],
              ["border", "Border", item?.style?.border ?? "#FFFFFF"],
              ["text", "Text", item?.style?.text ?? "#FFFFFF"],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name} label={label}>
              <input name={name} type="color" defaultValue={value} className="h-10 w-16 cursor-pointer rounded-lg border border-line" />
            </Field>
          ))}
        </div>
      )}
      {kind !== "ENTRY_EFFECT" && (
        <Field label={item ? "Replace picture (PNG/WebP, max 2 MB)" : `Picture (PNG/WebP, max 2 MB)${kind === "CHAT_BUBBLE" ? ", optional" : ""}`}>
          <input name="image" type="file" accept="image/png,image/webp" className="text-sm" />
        </Field>
      )}
      {kind !== "CHAT_BUBBLE" && kind !== "CARD_DECOR" && (
        <Field label={item ? "Replace animation (SVGA, max 15 MB)" : `Animation (SVGA, max 15 MB)${kind === "ENTRY_EFFECT" ? "" : ", optional"}`}>
          <input name="svga" type="file" accept=".svga" required={!item && kind === "ENTRY_EFFECT"} className="text-sm" />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="forPrize" defaultChecked={item ? item.forPrize : true} className="h-4 w-4 accent-primary-strong" /> Event prize
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="forMall" defaultChecked={item?.forMall ?? false} className="h-4 w-4 accent-primary-strong" /> Mall item
        </label>
        {item && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={item.enabled} className="h-4 w-4 accent-primary-strong" /> Shown (unticked: hidden everywhere)
          </label>
        )}
        <button className={`${item ? ghost : button} ml-auto`}>{item ? "Save" : "Add"}</button>
      </div>
    </form>
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
