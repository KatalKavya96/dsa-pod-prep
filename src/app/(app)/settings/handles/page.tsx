import { addHandleAction, removeHandleAction, verifyHandleAction } from "@/app/actions/member";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, ExtLink, Field, inputCls, LinkButton, PageHeader, PLATFORM_META } from "@/components/ui";
import { requireUser } from "@/server/auth/session";
import { listHandles, VERIFY_STEPS } from "@/server/modules/handles/service";
import { adapters, JUDGE_PLATFORMS } from "@/server/platforms";

export const metadata = { title: "Linked handles" };

export default async function HandlesPage({ searchParams }: PageProps<"/settings/handles">) {
  const u = await requireUser();
  const welcome = (await searchParams).welcome === "1";
  const handles = await listHandles(u.id);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={welcome ? "Step 2 of 2: link your handles" : "Linked handles"}
        subtitle="Only verified handles are tracked. Verification proves the account is yours, so nobody can borrow someone else's stats."
        action={welcome ? <LinkButton href="/dashboard" variant="secondary">Skip for now →</LinkButton> : undefined}
      />
      {JUDGE_PLATFORMS.map((p) => {
        const h = handles.find((x) => x.platform === p);
        return (
          <Card key={p}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: PLATFORM_META[p].color }}>{PLATFORM_META[p].label}</h2>
              {h ? h.verifiedAt ? <Badge tone="good">Verified</Badge> : <Badge tone="warn">Pending verification</Badge> : <Badge>Not linked</Badge>}
            </div>
            {h && (
              <div className="mb-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <ExtLink href={adapters[p].profileUrl(h.handle)}>{h.handle}</ExtLink>
                  <form action={removeHandleAction}>
                    <input type="hidden" name="platform" value={p} />
                    <button className="text-sm text-bad hover:underline">Remove</button>
                  </form>
                </div>
                {h.verifiedAt ? (
                  <p className="text-xs text-muted">
                    {h.lastSyncedAt ? `Last synced ${h.lastSyncedAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : "Waiting for first sync"}
                    {h.syncError ? ` · last sync failed (${h.syncError.slice(0, 60)})` : ""}
                  </p>
                ) : (
                  <div className="rounded-lg bg-surface-2 p-3 text-sm">
                    <p className="mb-2">{VERIFY_STEPS[p](h.verificationCode)}</p>
                    {p !== "codeforces" && <code className="rounded bg-surface px-2 py-1 font-mono text-sm select-all">{h.verificationCode}</code>}
                    <ActionForm action={verifyHandleAction} submitLabel="Verify" className="mt-3">
                      <input type="hidden" name="platform" value={p} />
                    </ActionForm>
                  </div>
                )}
              </div>
            )}
            <ActionForm action={addHandleAction} submitLabel={h ? "Change handle" : "Add handle"} submitVariant={h ? "secondary" : "primary"} resetOnSuccess>
              <input type="hidden" name="platform" value={p} />
              <Field label={h ? "New handle" : "Handle"}>
                <input name="handle" required minLength={2} maxLength={40} pattern="[A-Za-z0-9_.\-]+" className={inputCls} placeholder={`Your ${PLATFORM_META[p].label} username`} />
              </Field>
            </ActionForm>
          </Card>
        );
      })}
      {welcome && <LinkButton href="/dashboard">Go to my dashboard →</LinkButton>}
    </div>
  );
}
