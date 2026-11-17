import { updateMilestoneAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls, PageHeader } from "@/components/ui";
import { ensureDefaultMilestones, listMilestones } from "@/server/modules/milestones/service";

export const metadata = { title: "Admin · Milestones" };

export default async function AdminMilestones() {
  let ms = await listMilestones();
  if (!ms.length) {
    await ensureDefaultMilestones();
    ms = await listMilestones();
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Milestones"
        subtitle="The 5 levels every member works toward. Change the criteria, titles, badges and animations to match your requirement docs. Earned milestones are never taken away."
      />
      <Card className="text-sm">
        <b>Criteria format</b> (JSON list, all must hold):{" "}
        <code className="font-mono text-xs">
          {`[{"type":"solved","min":150},{"type":"streak","min":7},{"type":"contests","min":10},{"type":"resources_done","min":20},{"type":"attendance_pct","min":75,"minEligible":10}]`}
        </code>
      </Card>
      {ms.map((m) => (
        <Card key={m.id} style={{ borderLeft: `4px solid ${m.color}` }}>
          <h2 className="mb-3 font-semibold">{m.icon} Level {m.level}</h2>
          <ActionForm action={updateMilestoneAction} submitLabel="Save milestone">
            <input type="hidden" name="id" value={m.id} />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Milestone name"><input name="title" defaultValue={m.title} required className={inputCls} /></Field>
              <Field label="Title earned (badge text)"><input name="badgeTitle" defaultValue={m.badgeTitle} required className={inputCls} /></Field>
              <Field label="Tagline"><input name="tagline" defaultValue={m.tagline ?? ""} className={inputCls} /></Field>
              <Field label="Icon (emoji)"><input name="icon" defaultValue={m.icon} required maxLength={8} className={inputCls} /></Field>
              <Field label="Colour"><input name="color" type="color" defaultValue={m.color} className="h-10 w-full rounded-lg border border-border bg-surface" /></Field>
              <Field label="Celebration animation">
                <select name="animation" defaultValue={m.animation} className={inputCls}>
                  <option value="glow">Glow</option><option value="flame">Flame</option><option value="rise">Rise</option><option value="confetti">Confetti</option><option value="crown">Crown drop</option>
                </select>
              </Field>
            </div>
            <Field label="Description (shown on the track)"><textarea name="description" rows={3} defaultValue={m.description ?? ""} className={inputCls} /></Field>
            <Field label="Criteria (JSON)"><textarea name="criteria" rows={3} defaultValue={JSON.stringify(m.criteria)} className={`${inputCls} font-mono text-xs`} /></Field>
          </ActionForm>
        </Card>
      ))}
    </div>
  );
}
