import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ArtPreview } from "@/components/ArtPreview";
import { button, Card, Flash, ghost, Hidden, input, Pill } from "@/components/ui";
import { api, can, requireMe } from "@/lib/api";
import { createSvipItem, removeSvipFx, updateSvipItem, uploadSvipFx } from "../../../actions";

type Asset = { kind: "entry" | "seat" | "name" | "badge"; tier: number; svga: string };
type Item = { id: string; kind: "AVATAR_FRAME" | "CHAT_BUBBLE" | "CARD_DECOR"; name: string; svg: string; svga: string | null; style: { gradient: string[]; border: string; text: string } | null; minSvip: number; enabled: boolean };

const TIERS = [1, 2, 3, 4, 5, 6];
const FX: { kind: Asset["kind"]; title: string }[] = [
  { kind: "entry", title: "Entry banner" },
  { kind: "seat", title: "Seat medal" },
  { kind: "name", title: "Name shimmer" },
  { kind: "badge", title: "Profile title badge" },
];
const ITEM_KINDS: { kind: Item["kind"]; title: string; hint: string }[] = [
  { kind: "AVATAR_FRAME", title: "SVIP frames", hint: "Members of the tier and above can wear it. Animated SVGA (photo in the middle 80%) or a square PNG/WebP." },
  { kind: "CHAT_BUBBLE", title: "SVIP chat bubbles", hint: "The bubble's colours, and an optional small corner picture." },
  { kind: "CARD_DECOR", title: "SVIP profile cards", hint: "The picture behind the profile card. Wide PNG/WebP, about 1000 × 400." },
];

// Every SVIP design in one place: what each tier plays (entry banner, seat medal, name shimmer, profile title badge) and
// its frames, chat bubbles and profile cards. The app loads these from the server, so new designs need no app update.
export default async function Svip({ searchParams }: PageProps<"/admin/svip">) {
  const me = await requireMe();
  if (!can(me, "svip.manage")) redirect("/dashboard");
  const sp = await searchParams;
  const { assets, items } = await api<{ assets: Asset[]; items: Item[] }>("GET", "/admin/svip");
  const at = (kind: Asset["kind"], tier: number) => assets.find((a) => a.kind === kind && a.tier === tier);

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold">SVIP designs</h1>
        <p className="mt-1 text-sm text-muted">Hover any design to play it. Replace one with a new SVGA and phones get it next time they open the app, with no app update.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <Card title="Tier animations" hint="Empty: that tier doesn't have this animation. SVGA files up to 15 MB.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-3 font-semibold">Tier</th>
                {FX.map((f) => (
                  <th key={f.kind} className="py-2 pr-3 font-semibold">
                    {f.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIERS.map((tier) => (
                <tr key={tier} className="border-t border-line align-top">
                  <td className="py-3 pr-3 font-bold">SVIP{tier}</td>
                  {FX.map((f) => {
                    const a = at(f.kind, tier);
                    return (
                      <td key={f.kind} className="py-3 pr-3">
                        <div className="space-y-2">
                          {a ? <ArtPreview svga={a.svga} label={`SVIP${tier} ${f.title.toLowerCase()}`} /> : <span className="block h-12 w-12 rounded-lg border border-dashed border-line" aria-label="None" />}
                          <form action={uploadSvipFx} className="flex flex-col gap-1">
                            <Hidden name="kind" value={f.kind} />
                            <Hidden name="tier" value={String(tier)} />
                            <input name="svga" type="file" accept=".svga" required className="w-40 text-xs" aria-label={`New SVGA for SVIP${tier} ${f.title}`} />
                            <button className={`${ghost} h-8 w-fit px-3 text-xs`}>{a ? "Replace" : "Add"}</button>
                          </form>
                          {a && (
                            <form action={removeSvipFx}>
                              <Hidden name="kind" value={f.kind} />
                              <Hidden name="tier" value={String(tier)} />
                              <button className="text-xs font-semibold text-muted hover:text-danger">Remove</button>
                            </form>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {ITEM_KINDS.map(({ kind, title, hint }) => {
        const list = items.filter((i) => i.kind === kind);
        return (
          <Card key={kind} title={title} hint={hint}>
            <details className="mb-4 rounded-xl border border-dashed border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-primary-strong">Add one</summary>
              <div className="px-3 pb-3">
                <SvipItemForm kind={kind} />
              </div>
            </details>
            {!list.length ? (
              <p className="text-sm text-muted">None yet.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((i) => (
                  <li key={i.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center gap-3">
                      <ArtPreview svga={i.svga} svg={i.svg} bubble={kind === "CHAT_BUBBLE" ? i.style : null} wide={kind === "CARD_DECOR"} label={i.name} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{i.name}</span>
                      <Pill tone="gold">SVIP{i.minSvip}+</Pill>
                      {!i.enabled && <Pill>hidden</Pill>}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold">Change design</summary>
                      <div className="pt-2">
                        <SvipItemForm kind={kind} item={i} />
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

function SvipItemForm({ kind, item }: { kind: Item["kind"]; item?: Item }) {
  return (
    <form action={item ? updateSvipItem : createSvipItem} className="grid gap-3 sm:grid-cols-2">
      <Hidden name="kind" value={kind} />
      {item && <Hidden name="itemId" value={item.id} />}
      <Field label="Name">
        <input name="name" required maxLength={40} defaultValue={item?.name} className={input} />
      </Field>
      {item ? (
        <span />
      ) : (
        <Field label="From tier">
          <select name="tier" defaultValue="1" className={input}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                SVIP{t} and above
              </option>
            ))}
          </select>
        </Field>
      )}
      {kind === "CHAT_BUBBLE" && (
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          {(
            [
              ["from", "Colour 1", item?.style?.gradient[0] ?? "#FFC94D"],
              ["to", "Colour 2", item?.style?.gradient[1] ?? "#B45309"],
              ["border", "Border", item?.style?.border ?? "#FFE29A"],
              ["text", "Text", item?.style?.text ?? "#FFFFFF"],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name} label={label}>
              <input name={name} type="color" defaultValue={value} className="h-10 w-16 cursor-pointer rounded-lg border border-line" />
            </Field>
          ))}
        </div>
      )}
      <Field label={`${item ? "Replace picture" : "Picture"} (PNG/WebP, max 2 MB)${kind === "AVATAR_FRAME" || kind === "CHAT_BUBBLE" ? ", optional" : ""}`}>
        <input name="image" type="file" accept="image/png,image/webp" required={!item && kind === "CARD_DECOR"} className="text-sm" />
      </Field>
      {kind === "AVATAR_FRAME" && (
        <Field label={`${item ? "Replace animation" : "Animation"} (SVGA, max 15 MB)`}>
          <input name="svga" type="file" accept=".svga" className="text-sm" />
        </Field>
      )}
      <div className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:col-span-2">
        {item && (
          <label className="flex items-center gap-2">
            <input type="checkbox" name="enabled" defaultChecked={item.enabled} className="h-4 w-4 accent-primary-strong" /> Shown
          </label>
        )}
        <button className={`${item ? ghost : button} ml-auto`}>{item ? "Save" : "Add"}</button>
      </div>
      {item && (
        <p className="text-xs text-muted sm:col-span-2">
          Leave a file empty to keep the current picture or animation.
        </p>
      )}
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
