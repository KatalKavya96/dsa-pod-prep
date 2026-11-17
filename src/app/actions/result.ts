import { z } from "zod";
import { AuthError } from "@/server/auth/session";

export type ActionResult = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> } | null;

/** Converts thrown errors into a safe, user-facing result. Never leaks internals. */
export async function run(fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await fn();
    return { ok: true, message: message ?? "Saved" };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.code === "FORBIDDEN" ? "You don't have access to do that." : "Please sign in again." };
    if (e instanceof z.ZodError) {
      const flat = z.flattenError(e);
      return { ok: false, message: flat.formErrors[0] ?? "Please fix the highlighted fields.", fieldErrors: flat.fieldErrors as Record<string, string[]> };
    }
    if (e instanceof Error && e.message.length < 200 && !/sql|relation|column|constraint|ECONN/i.test(e.message)) {
      return { ok: false, message: e.message };
    }
    console.error("[action]", e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const lines = (v: string | undefined) => (v ?? "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
