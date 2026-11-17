"use client";
import { useState } from "react";
import { Button, inputCls } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; msg?: string }>({ status: "idle" });

  return (
    <div className="space-y-4">
      {googleEnabled && (
        <Button
          variant="secondary"
          className="w-full py-2.5"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login" })}
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          Continue with Google
        </Button>
      )}
      {googleEnabled && (
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
      )}
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setState({ status: "sending" });
          const { error } = await authClient.signIn.magicLink({ email, callbackURL: next, newUserCallbackURL: "/onboarding", errorCallbackURL: "/login" });
          setState(error ? { status: "error", msg: error.message ?? "Could not send the link" } : { status: "sent" });
        }}
      >
        <label className="block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" required autoComplete="email" className={inputCls} placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" className="w-full" disabled={state.status === "sending"}>
          {state.status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
      {state.status === "sent" && <p className="rounded-md bg-good/10 p-2 text-center text-sm text-good">Check your inbox for the sign-in link (valid 10 minutes).</p>}
      {state.status === "error" && <p className="rounded-md bg-bad/10 p-2 text-center text-sm text-bad">{state.msg}</p>}
    </div>
  );
}
