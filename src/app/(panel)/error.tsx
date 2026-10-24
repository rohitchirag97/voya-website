"use client";

// Client component because Next.js error boundaries must be; it catches anything a panel page throws.
import Link from "next/link";
import { button, ghost } from "@/components/ui";

export default function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
      <p className="text-4xl" aria-hidden>
        😵‍💫
      </p>
      <h1 className="mt-3 text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">This page didn’t load properly. Nothing was changed. Try again, and if it keeps happening, send us the code below.</p>
      <div className="mt-6 flex justify-center gap-2">
        <button onClick={() => retry()} className={button}>
          Try again
        </button>
        <Link href="/dashboard" className={`${ghost} flex items-center`}>
          Go to dashboard
        </Link>
      </div>
      {digest && <p className="mt-6 font-mono text-xs text-muted">Error code {digest}</p>}
    </section>
  );
}
