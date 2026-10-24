import Link from "next/link";
import { button } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="max-w-md text-center">
        <p className="text-5xl font-extrabold text-primary">404</p>
        <h1 className="mt-3 text-xl font-bold">This page doesn’t exist</h1>
        <p className="mt-2 text-sm text-muted">The link may be old or mistyped.</p>
        <Link href="/" className={`${button} mt-6 inline-flex items-center`}>
          Back to VoyaLive
        </Link>
      </section>
    </main>
  );
}
