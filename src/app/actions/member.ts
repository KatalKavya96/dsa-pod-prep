"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertUser } from "@/server/auth/session";
import { markRegistered, selfReport } from "@/server/modules/assignments/service";
import { handleInput, removeHandle, upsertHandle, verifyHandle } from "@/server/modules/handles/service";
import { markCelebrated } from "@/server/modules/milestones/service";
import { markAllRead } from "@/server/modules/notifications/inbox";
import { toggleResourceDone } from "@/server/modules/resources/service";
import { completeOnboarding, onboardingInput } from "@/server/modules/users/service";
import { z } from "zod";
import { run, str, type ActionResult } from "./result";

// Lightweight per-instance throttle for expensive member actions (platform calls).
const hits = new Map<string, number[]>();
function throttle(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
  if (arr.length >= max) throw new Error("Too many attempts. Please wait a minute.");
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 50_000) hits.clear();
}

export async function onboardAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const res = await run(async () => {
    const u = await assertUser();
    await completeOnboarding(u.id, onboardingInput.parse({ username: str(fd, "username"), name: str(fd, "name"), batch: str(fd, "batch") }));
  });
  if (res?.ok) redirect("/settings/handles?welcome=1");
  return res;
}

export async function addHandleAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await assertUser();
    throttle(`h:${u.id}`, 10, 60_000);
    await upsertHandle(u.id, handleInput.parse({ platform: str(fd, "platform"), handle: str(fd, "handle") }));
    revalidatePath("/settings/handles");
    return "Handle added. Now verify it using the steps shown.";
  });
}

const platform = z.enum(["leetcode", "codeforces", "codechef"]);

export async function verifyHandleAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await assertUser();
    throttle(`v:${u.id}`, 6, 60_000);
    const r = await verifyHandle(u.id, platform.parse(str(fd, "platform")));
    if (!r.ok) throw new Error(r.reason);
    revalidatePath("/settings/handles");
    return "Verified! Your stats will appear after the next sync (within an hour).";
  });
}

export async function removeHandleAction(fd: FormData) {
  const u = await assertUser();
  await removeHandle(u.id, platform.parse(str(fd, "platform")));
  revalidatePath("/settings/handles");
}

export async function selfReportAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const u = await assertUser();
    await selfReport(u.id, z.string().min(1).parse(str(fd, "assignmentId")));
    refresh();
    return "Marked as done";
  });
}

export async function registeredAction(fd: FormData) {
  const u = await assertUser();
  await markRegistered(u.id, z.string().min(1).parse(str(fd, "assignmentId")), fd.get("registered") === "1");
  refresh();
}

export async function toggleResourceAction(resourceId: string, done: boolean) {
  const u = await assertUser();
  await toggleResourceDone(u.id, z.string().min(1).max(64).parse(resourceId), done);
}

export async function acknowledgeMilestone(milestoneId: string) {
  const u = await assertUser();
  await markCelebrated(u.id, z.string().min(1).max(64).parse(milestoneId));
}

export async function markNotificationsReadAction() {
  const u = await assertUser();
  await markAllRead(u.id);
  refresh();
}
