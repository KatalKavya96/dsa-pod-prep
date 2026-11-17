import { onboardAction } from "@/app/actions/member";
import { ActionForm } from "@/components/action-form";
import { Field, inputCls } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { getUserById, listBatches } from "@/server/modules/users/service";
import { redirect } from "next/navigation";

export const metadata = { title: "Welcome" };

export default async function Onboarding() {
  const u = await requireUser({ onboarded: false });
  const row = await getUserById(u.id);
  if (row?.username) redirect("/dashboard");
  const batches = await listBatches();
  const suggested = (u.email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-2 text-sm font-medium text-accent">Step 1 of 2</div>
      <h1 className="text-2xl font-semibold">Welcome to the DSA POD 👋</h1>
      <p className="mt-1 text-sm text-muted">Set up your profile. Next, you&apos;ll link your LeetCode / Codeforces / CodeChef handles so your progress is tracked.</p>
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <ActionForm action={onboardAction} submitLabel="Continue">
          <Field label="Full name">
            <input name="name" required minLength={2} maxLength={80} defaultValue={u.name} className={inputCls} />
          </Field>
          <Field label="Username" hint="Lowercase letters, digits, _ (3–24). Your profile will be /u/username.">
            <input name="username" required pattern="[a-z0-9_]{3,24}" defaultValue={suggested} className={inputCls} />
          </Field>
          <Field label="Batch" hint="Your year / cohort, e.g. 2027. Tasks are often targeted by batch.">
            <input name="batch" required maxLength={50} list="batches" className={inputCls} />
            <datalist id="batches">{batches.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
        </ActionForm>
      </div>
    </main>
  );
}
