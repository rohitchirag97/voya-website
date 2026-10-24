"use client";

// Client component because Google Identity Services runs in the browser: it renders the button and hands back an ID token,
// which the googleSignIn server action exchanges for a session.
import Script from "next/script";
import { useRef, useState } from "react";
import { googleSignIn } from "../actions";

type Gis = {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, o: object): void;
    };
  };
};

export function GoogleButton({ clientId }: { clientId: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  const init = () => {
    const google = (window as unknown as { google: Gis }).google;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => setError((await googleSignIn(credential)) ?? ""),
    });
    google.accounts.id.renderButton(el.current!, { theme: "outline", size: "large", width: 320, text: "continue_with" });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Script src="https://accounts.google.com/gsi/client" onReady={init} />
      <div ref={el} className="min-h-11" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
