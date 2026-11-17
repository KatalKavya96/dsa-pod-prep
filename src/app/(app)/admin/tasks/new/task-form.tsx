"use client";
import { useState } from "react";
import { createAssignmentAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Card, Field, inputCls } from "@/components/ui";

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function TaskForm({ contests, batches }: { contests: { id: string; label: string; startsAt: string; durationSeconds: number }[]; batches: string[] }) {
  const [kind, setKind] = useState<"practice" | "contest" | "activity">("practice");
  const [audience, setAudience] = useState<"all" | "batch" | "selected">("all");
  const [start, setStart] = useState(() => toLocalInput(new Date()));
  const [due, setDue] = useState(() => toLocalInput(new Date(Date.now() + 2 * 86400_000)));

  return (
    <Card>
      <ActionForm action={createAssignmentAction} submitLabel="Create task">
        <Field label="Type">
          <div className="flex gap-2">
            {(["practice", "contest", "activity"] as const).map((k) => (
              <label key={k} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-sm capitalize ${kind === k ? "border-accent bg-accent/10 text-accent" : "border-border"}`}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                {k}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Title"><input name="title" required minLength={3} maxLength={200} className={inputCls} placeholder={kind === "practice" ? "Binary Search: Day 1" : kind === "contest" ? "Weekly Contest together" : "Mock interview session"} /></Field>
        <Field label="Description (optional)"><textarea name="description" rows={3} maxLength={5000} className={inputCls} /></Field>

        {kind === "contest" && (
          <Field label="Contest" hint="Not in the list? Post it first under Admin → Contests.">
            <select
              name="contestId"
              required
              className={inputCls}
              onChange={(e) => {
                const c = contests.find((x) => x.id === e.target.value);
                if (c) {
                  const s = new Date(c.startsAt);
                  setStart(toLocalInput(s));
                  setDue(toLocalInput(new Date(s.getTime() + c.durationSeconds * 1000 + 3600_000)));
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Select a contest…</option>
              {contests.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        )}

        {kind === "practice" && (
          <Field label="Problem links (one per line)" hint="LeetCode, Codeforces and CodeChef problem URLs. Solves are detected automatically from verified handles.">
            <textarea name="problemUrls" rows={6} required className={`${inputCls} font-mono text-xs`} placeholder={"https://leetcode.com/problems/two-sum/\nhttps://codeforces.com/problemset/problem/4/A"} />
          </Field>
        )}

        {kind === "activity" && (
          <Field label="Link (optional)"><input name="link" type="url" className={inputCls} placeholder="Meet / form / doc link" /></Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starts"><input name="startsAt" type="datetime-local" required className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Due"><input name="dueAt" type="datetime-local" required className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>

        <Field label="Who is this for?">
          <select name="audience" className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
            <option value="all">All members</option>
            <option value="batch">One batch</option>
            <option value="selected">Selected members</option>
          </select>
        </Field>
        {audience === "batch" && (
          <Field label="Batch">
            <input name="audienceBatch" required list="batches" className={inputCls} />
            <datalist id="batches">{batches.map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
        )}
        {audience === "selected" && (
          <Field label="Member emails (one per line)"><textarea name="selectedEmails" rows={4} required className={`${inputCls} font-mono text-xs`} /></Field>
        )}

        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="countsTowardAttendance" defaultChecked /> Counts toward attendance</label>
          {kind === "activity" && <label className="flex items-center gap-2"><input type="checkbox" name="allowSelfReport" defaultChecked /> Members can mark it done themselves</label>}
        </div>
      </ActionForm>
    </Card>
  );
}
