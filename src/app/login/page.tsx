import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { googleEnabled } from "@/server/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSessionUser()) redirect("/dashboard");
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  const error = typeof sp.error === "string" ? sp.error : undefined;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-10 place-items-center rounded-xl bg-accent text-accent-fg">{"</>"}</div>
          <h1 className="text-xl font-semibold">Sign in to DSA POD</h1>
          <p className="mt-1 text-sm text-muted">New members are registered automatically on first sign-in.</p>
        </div>
        {error && <p className="mb-4 rounded-md bg-bad/10 p-2 text-center text-sm text-bad">Sign-in failed: {error.replace(/_/g, " ")}</p>}
        <LoginForm next={next} googleEnabled={googleEnabled} />
      </div>
    </main>
  );
}
