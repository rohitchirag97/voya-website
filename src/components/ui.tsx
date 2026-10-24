import type { ReactNode } from "react";

// Small server-rendered building blocks for the panel. No client JS.

export const fmt = (n: number) => n.toLocaleString("en-IN");

export const input =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted";
export const button =
  "h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:brightness-110 active:brightness-95 disabled:opacity-50 cursor-pointer whitespace-nowrap";
export const ghost = "h-10 rounded-lg border border-line bg-surface px-4 text-sm font-semibold hover:bg-surface-high cursor-pointer whitespace-nowrap";
export const danger = "h-10 rounded-lg border border-danger/30 px-4 text-sm font-semibold text-danger hover:bg-danger/5 cursor-pointer whitespace-nowrap";

// The result of the last form action, carried in the URL (?ok= / ?error=).
export function Flash({ ok, error }: { ok?: string | string[]; error?: string | string[] }) {
  if (error) return <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{String(error)}</p>;
  if (ok) return <p role="status" className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">{String(ok)}</p>;
  return null;
}

export function Card({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-base font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// A fresh key per rendered form: submitting the same form twice moves coins once (the API rejects a repeated key).
export const IdemKey = () => <input type="hidden" name="key" value={crypto.randomUUID()} />;

export const Hidden = ({ name, value }: { name: string; value: string }) => <input type="hidden" name={name} value={value} />;

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "gold" | "success" | "danger" }) {
  const tones = {
    muted: "bg-surface-high text-muted",
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/10 text-gold",
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
