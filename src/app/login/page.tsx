import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { button, first, Flash, ghost, Hidden, input } from "@/components/ui";
import { getMe } from "@/lib/api";
import { requestOtp, verifyOtp } from "../actions";
import { GoogleButton } from "./google-button";

// Sign in with the same account as the app: Google, or a phone code. Step 2 (the code) is driven by ?phone=.
export default async function Login({ searchParams }: PageProps<"/login">) {
  if (await getMe()) redirect("/dashboard");
  const sp = await searchParams;
  const phone = first(sp.phone);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto flex w-fit items-center">
          <Image src="/logo.png" alt="VoyaLive" width={170} height={56} priority />
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-xl font-bold">Seller &amp; staff sign in</h1>
          <p className="mt-1 text-sm text-muted">Use the same account you use in the VoyaLive app.</p>

          <div className="mt-5 space-y-4">
            <Flash error={sp.error} />
            {clientId && !phone && (
              <>
                <GoogleButton clientId={clientId} />
                <p className="flex items-center gap-3 text-xs text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">or</p>
              </>
            )}

            {!phone ? (
              <form action={requestOtp} className="space-y-3">
                <label className="block text-sm font-semibold">
                  Phone number
                  <input name="phone" type="tel" required autoComplete="tel" placeholder="+91 98765 43210" className={`${input} mt-1.5 w-full`} />
                </label>
                <button className={`${button} w-full`}>Send code</button>
              </form>
            ) : (
              <form action={verifyOtp} className="space-y-3">
                <Hidden name="phone" value={phone} />
                <p className="text-sm">
                  Code sent to <b>{phone}</b>
                </p>
                {sp.dev && <p className="rounded-lg bg-surface-high px-3 py-2 text-sm">Test server code: <b className="font-mono">{first(sp.dev)}</b></p>}
                <label className="block text-sm font-semibold">
                  6-digit code
                  <input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoFocus autoComplete="one-time-code" className={`${input} mt-1.5 w-full font-mono tracking-[0.4em]`} />
                </label>
                <button className={`${button} w-full`}>Sign in</button>
                <Link href="/login" className={`${ghost} flex w-full items-center justify-center`}>Use a different number</Link>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
