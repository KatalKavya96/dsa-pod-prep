import { createResourceAction, createTopicAction, deleteResourceAction, deleteTopicAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, CardTitle, ExtLink, Field, inputCls, PageHeader } from "@/components/ui";
import { listTopicsWithResources } from "@/server/modules/resources/service";

export const metadata = { title: "Admin · Resources" };

export default async function AdminResources() {
  const topics = await listTopicsWithResources();
  return (
    <div className="space-y-6">
      <PageHeader title="Resources" subtitle="Organise problems and material by topic. Add a short note on why each item matters." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>New topic</CardTitle>
          <ActionForm action={createTopicAction} submitLabel="Add topic" resetOnSuccess>
            <Field label="Name"><input name="name" required minLength={2} maxLength={80} className={inputCls} placeholder="Binary Search" /></Field>
            <Field label="Description (optional)"><input name="description" maxLength={1000} className={inputCls} /></Field>
            <Field label="Order" hint="Lower numbers show first."><input name="position" type="number" min={0} defaultValue={topics.length} className={inputCls} /></Field>
          </ActionForm>
        </Card>
        <Card>
          <CardTitle>Add resource</CardTitle>
          {topics.length === 0 ? (
            <p className="text-sm text-muted">Create a topic first.</p>
          ) : (
            <ActionForm action={createResourceAction} submitLabel="Add resource" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Topic">
                  <select name="topicId" className={inputCls}>{topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </Field>
                <Field label="Type">
                  <select name="kind" className={inputCls}><option value="problem">Problem</option><option value="article">Article</option><option value="video">Video</option><option value="sheet">Sheet / list</option></select>
                </Field>
              </div>
              <Field label="Title"><input name="title" required className={inputCls} /></Field>
              <Field label="Link"><input name="url" type="url" required className={inputCls} placeholder="https://" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Platform">
                  <select name="platform" className={inputCls} defaultValue=""><option value="">–</option><option value="leetcode">LeetCode</option><option value="codeforces">Codeforces</option><option value="codechef">CodeChef</option><option value="atcoder">AtCoder</option><option value="other">Other</option></select>
                </Field>
                <Field label="Difficulty">
                  <select name="difficulty" className={inputCls} defaultValue=""><option value="">–</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
                </Field>
              </div>
              <Field label="Why this one? (optional)"><textarea name="note" rows={2} maxLength={1000} className={inputCls} /></Field>
            </ActionForm>
          )}
        </Card>
      </div>
      {topics.map((t) => (
        <Card key={t.id}>
          <CardTitle action={
            <form action={deleteTopicAction}><input type="hidden" name="id" value={t.id} /><button className="text-sm text-bad hover:underline">Delete topic</button></form>
          }>{t.name} · {t.resources.length}</CardTitle>
          <ul className="divide-y divide-border">
            {t.resources.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0"><ExtLink href={r.url}>{r.title}</ExtLink> {r.difficulty && <Badge>{r.difficulty}</Badge>}</div>
                <form action={deleteResourceAction}><input type="hidden" name="id" value={r.id} /><button className="text-bad hover:underline">Remove</button></form>
              </li>
            ))}
            {!t.resources.length && <li className="py-2 text-sm text-muted">No resources yet.</li>}
          </ul>
        </Card>
      ))}
    </div>
  );
}
