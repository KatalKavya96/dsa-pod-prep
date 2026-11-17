/**
 * Outbound HTTP for platform APIs: timeout, retry with exponential backoff on
 * 429/5xx, and a minimum spacing per host so we never hammer a platform
 * (getting our server IP banned would break tracking for everyone).
 */
import { PlatformError } from "./types";

const MIN_GAP_MS: Record<string, number> = {
  "codeforces.com": 2100, // documented limit: 1 call / 2s
  "leetcode.com": 400,
  "www.codechef.com": 800,
};
const nextSlot = new Map<string, number>();

async function throttle(host: string) {
  const gap = MIN_GAP_MS[host] ?? 250;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + gap);
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

export interface FetchOpts extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  /** Disable throttling (tests). */
  noThrottle?: boolean;
}

const UA = "Mozilla/5.0 (compatible; DSAPodTracker/1.0)";

export async function fetchWithPolicy(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 3, noThrottle, ...init } = opts;
  const host = new URL(url).host;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (!noThrottle) await throttle(host);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, Accept: "application/json, text/html", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new PlatformError(`${host} responded ${res.status}`, res.status === 429 ? "rate_limited" : "unavailable");
      } else {
        return res;
      }
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 250));
  }
  if (lastErr instanceof PlatformError) throw lastErr;
  throw new PlatformError(`${host} unreachable: ${String(lastErr)}`, "unavailable");
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetchWithPolicy(url, opts);
  if (res.status === 404) throw new PlatformError(`Not found: ${url}`, "not_found");
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new PlatformError(`Non-JSON response from ${new URL(url).host}`, "bad_response");
  }
}
