/**
 * Handle linking + ownership verification. Unverified handles are never
 * synced, so nobody can inflate their stats with someone else's account.
 */
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { adapters, PlatformError, type JudgePlatform } from "@/server/platforms";

const { platformHandle } = schema;

export const handleInput = z.object({
  platform: z.enum(["leetcode", "codeforces", "codechef"]),
  handle: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_.\-]+$/, "Only letters, digits, _ . - allowed"),
});

export function newVerificationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return "dsapod-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listHandles(userId: string) {
  return db.select().from(platformHandle).where(eq(platformHandle.userId, userId));
}

/** Add or replace the member's handle for a platform (resets verification). */
export async function upsertHandle(userId: string, input: z.infer<typeof handleInput>) {
  const taken = await db.query.platformHandle.findFirst({
    where: and(
      eq(platformHandle.platform, input.platform),
      sql`lower(${platformHandle.handle}) = ${input.handle.toLowerCase()}`,
      sql`${platformHandle.verifiedAt} is not null`,
      sql`${platformHandle.userId} <> ${userId}`,
    ),
  });
  if (taken) throw new Error("This handle is already verified by another member.");
  const code = newVerificationCode();
  await db
    .insert(platformHandle)
    .values({ userId, platform: input.platform, handle: input.handle, verificationCode: code })
    .onConflictDoUpdate({
      target: [platformHandle.userId, platformHandle.platform],
      set: {
        handle: input.handle,
        verificationCode: code,
        verifiedAt: null,
        lastSyncedAt: null,
        syncError: null,
        consecutiveFailures: 0,
        createdAt: new Date(),
      },
    });
}

export async function removeHandle(userId: string, platform: JudgePlatform) {
  await db.delete(platformHandle).where(and(eq(platformHandle.userId, userId), eq(platformHandle.platform, platform)));
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyHandle(userId: string, platform: JudgePlatform): Promise<VerifyResult> {
  const h = await db.query.platformHandle.findFirst({
    where: and(eq(platformHandle.userId, userId), eq(platformHandle.platform, platform)),
  });
  if (!h) return { ok: false, reason: "Add the handle first." };
  if (h.verifiedAt) return { ok: true };
  try {
    const ok = await adapters[platform].verifyOwnership(h.handle, h.verificationCode, h.createdAt);
    if (!ok) return { ok: false, reason: "We couldn't find the proof yet. Check the steps and try again in a minute." };
  } catch (e) {
    if (e instanceof PlatformError && e.kind === "not_found") return { ok: false, reason: "That handle doesn't exist on " + platform };
    return { ok: false, reason: `${platform} is not responding right now. Try again shortly.` };
  }
  try {
    await db.update(platformHandle).set({ verifiedAt: new Date() }).where(eq(platformHandle.id, h.id));
  } catch {
    return { ok: false, reason: "This handle was just verified by another member." };
  }
  return { ok: true };
}

export const VERIFY_STEPS: Record<JudgePlatform, (code: string) => string> = {
  leetcode: (code) => `Open leetcode.com → Profile → Edit Profile, paste ${code} into "Summary", save, then click Verify. You can remove it afterwards.`,
  codeforces: () =>
    `On Codeforces, submit any code that does NOT compile to problem 4A (codeforces.com/problemset/problem/4/A) — a Compilation Error — after adding the handle here, then click Verify.`,
  codechef: (code) => `Open codechef.com → Edit Profile, put ${code} in your Name or About field, save, then click Verify. You can remove it afterwards.`,
};
