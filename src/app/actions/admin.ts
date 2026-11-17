"use server";
/** Admin-only mutations. Every action calls assertAdmin() first (role re-read from DB). */
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TAGS } from "@/server/cache";
import { assertAdmin } from "@/server/auth/session";
import { nudgeMembers } from "@/server/modules/alerts/service";
import { archiveAssignment, assignmentInput, bulkMark, bulkMarkInput, createAssignment, evaluateAssignment } from "@/server/modules/assignments/service";
import { contestInput, createCustomContest, deleteCustomContest, setContestHidden } from "@/server/modules/contests/service";
import { milestoneInput, updateMilestone } from "@/server/modules/milestones/service";
import { createResource, createTopic, deleteResource, deleteTopic, resourceInput, topicInput } from "@/server/modules/resources/service";
import { setRole, setStatus } from "@/server/modules/users/service";
import { bool, lines, run, str, type ActionResult } from "./result";

const id = z.string().min(1).max(64);
/** datetime-local inputs carry no timezone; the form sends the browser's offset in `tz`. */
function localDate(fd: FormData, k: string) {
  const v = str(fd, k);
  if (!v) return undefined;
  const offset = Number(str(fd, "tz") ?? 0); // minutes, from Date.getTimezoneOffset()
  return new Date(Date.parse(v + "Z") + offset * 60_000);
}

// ---------- contests ----------
export async function createContestAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    await createCustomContest(
      a.id,
      contestInput.parse({
        platform: str(fd, "platform"),
        title: str(fd, "title"),
        url: str(fd, "url"),
        registrationUrl: str(fd, "registrationUrl") ?? "",
        requiresRegistration: bool(fd, "requiresRegistration"),
        startsAt: localDate(fd, "startsAt"),
        durationMinutes: str(fd, "durationMinutes"),
        notes: str(fd, "notes"),
      }),
    );
    updateTag(TAGS.contests);
    revalidatePath("/admin/contests");
    return "Contest posted. Everyone can see it now.";
  });
}

export async function toggleContestHiddenAction(fd: FormData) {
  const a = await assertAdmin();
  await setContestHidden(a.id, id.parse(str(fd, "id")), fd.get("hidden") === "1");
  updateTag(TAGS.contests);
  revalidatePath("/admin/contests");
}

export async function deleteContestAction(fd: FormData) {
  const a = await assertAdmin();
  await deleteCustomContest(a.id, id.parse(str(fd, "id")));
  updateTag(TAGS.contests);
  revalidatePath("/admin/contests");
}

// ---------- assignments ----------
export async function createAssignmentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let createdId: string | undefined;
  const res = await run(async () => {
    const a = await assertAdmin();
    const input = assignmentInput.parse({
      kind: str(fd, "kind"),
      title: str(fd, "title"),
      description: str(fd, "description"),
      contestId: str(fd, "contestId"),
      link: str(fd, "link"),
      startsAt: localDate(fd, "startsAt"),
      dueAt: localDate(fd, "dueAt"),
      audience: str(fd, "audience"),
      audienceBatch: str(fd, "audienceBatch"),
      selectedEmails: lines(str(fd, "selectedEmails")),
      countsTowardAttendance: bool(fd, "countsTowardAttendance"),
      allowSelfReport: bool(fd, "allowSelfReport"),
      problemUrls: lines(str(fd, "problemUrls")),
    });
    const created = await createAssignment(a.id, input);
    createdId = created.id;
    await evaluateAssignment(created.id);
  });
  if (res?.ok && createdId) redirect(`/admin/tasks/${createdId}`);
  return res;
}

export async function archiveAssignmentAction(fd: FormData) {
  const a = await assertAdmin();
  await archiveAssignment(a.id, id.parse(str(fd, "id")));
  redirect("/admin/tasks");
}

export async function reevaluateAction(fd: FormData) {
  await assertAdmin();
  const aid = id.parse(str(fd, "id"));
  await evaluateAssignment(aid);
  revalidatePath(`/admin/tasks/${aid}`);
}

export async function bulkMarkAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    const r = await bulkMark(
      a.id,
      bulkMarkInput.parse({ assignmentId: str(fd, "assignmentId"), status: str(fd, "status"), identifiers: lines(str(fd, "identifiers")) }),
    );
    revalidatePath(`/admin/tasks/${str(fd, "assignmentId")}`);
    return `Marked ${r.matched} member(s).` + (r.unknown.length ? ` Not found: ${r.unknown.slice(0, 10).join(", ")}${r.unknown.length > 10 ? "…" : ""}` : "");
  });
}

// ---------- resources ----------
export async function createTopicAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    await createTopic(a.id, topicInput.parse({ name: str(fd, "name"), description: str(fd, "description"), position: str(fd, "position") ?? 0 }));
    updateTag(TAGS.resources);
    revalidatePath("/admin/resources");
    return "Topic created";
  });
}

export async function createResourceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    await createResource(
      a.id,
      resourceInput.parse({
        topicId: str(fd, "topicId"),
        kind: str(fd, "kind"),
        title: str(fd, "title"),
        url: str(fd, "url"),
        platform: str(fd, "platform"),
        difficulty: str(fd, "difficulty"),
        note: str(fd, "note"),
      }),
    );
    updateTag(TAGS.resources);
    revalidatePath("/admin/resources");
    return "Resource added";
  });
}

export async function deleteTopicAction(fd: FormData) {
  const a = await assertAdmin();
  await deleteTopic(a.id, id.parse(str(fd, "id")));
  updateTag(TAGS.resources);
  revalidatePath("/admin/resources");
}

export async function deleteResourceAction(fd: FormData) {
  const a = await assertAdmin();
  await deleteResource(a.id, id.parse(str(fd, "id")));
  updateTag(TAGS.resources);
  revalidatePath("/admin/resources");
}

// ---------- members ----------
export async function setRoleAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    await setRole(a.id, id.parse(str(fd, "userId")), z.enum(["admin", "member"]).parse(str(fd, "role")));
    revalidatePath("/admin/members");
    return "Role updated";
  });
}

export async function setStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    await setStatus(a.id, id.parse(str(fd, "userId")), z.enum(["active", "suspended"]).parse(str(fd, "status")));
    revalidatePath("/admin/members");
    return "Status updated";
  });
}

export async function nudgeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    const ids = fd.getAll("userId").map((v) => id.parse(v));
    const msg = z.string().trim().min(3).max(500).parse(str(fd, "message"));
    const n = await nudgeMembers(a.id, ids, msg);
    return `Nudged ${n} member(s)`;
  });
}

// ---------- milestones ----------
export async function updateMilestoneAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const a = await assertAdmin();
    let criteria: unknown;
    try {
      criteria = JSON.parse(str(fd, "criteria") ?? "[]");
    } catch {
      throw new Error("Criteria must be valid JSON");
    }
    await updateMilestone(
      a.id,
      milestoneInput.parse({
        id: str(fd, "id"),
        title: str(fd, "title"),
        badgeTitle: str(fd, "badgeTitle"),
        tagline: str(fd, "tagline"),
        description: str(fd, "description"),
        icon: str(fd, "icon"),
        color: str(fd, "color"),
        animation: str(fd, "animation"),
        criteria,
      }),
    );
    updateTag(TAGS.milestones);
    revalidatePath("/admin/milestones");
    return "Milestone saved";
  });
}
