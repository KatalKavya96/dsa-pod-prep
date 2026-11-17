import { env } from "@/server/env";

/** Sends transactional email via Resend's HTTP API. In dev without a key, logs instead. */
export async function sendEmail(args: { to: string; subject: string; html: string; devLog?: string }) {
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not configured");
    console.info(`[email:dev] ${args.devLog ?? args.subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: args.to, subject: args.subject, html: args.html }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
}
