/**
 * Broadcast channels. One message to a Telegram channel / Discord server
 * reaches all 5,000 members for free (email free tiers can't do that).
 */
import { env } from "@/server/env";

export async function sendTelegram(text: string, chatId = env.TELEGRAM_CHANNEL_ID): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

export async function sendDiscord(content: string): Promise<boolean> {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
