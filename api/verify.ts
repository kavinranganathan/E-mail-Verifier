import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyEmail } from "../src/verify.js";

// Vercel Function — Node runtime (required: we use node:dns for MX lookups, which
// the Edge runtime does not provide). Classic (req, res) signature.
//
// Auth: send `x-api-key`. Keys come from the API_KEYS env var (comma-separated).
// If API_KEYS is unset (local dev), auth is skipped.
//
// CORS: open by default so the inline widget can call this from a customer's site.

interface RateState {
  count: number;
  resetAt: number;
}

// NOTE: in-memory limiter is per-instance only — an abuse speed-bump, not a quota.
// PLAN: move to a shared store (Vercel KV / Upstash) before billing on it.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const buckets = new Map<string, RateState>();

function rateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const state = buckets.get(key);
  if (!state || now >= state.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (state.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((state.resetAt - now) / 1000) };
  }
  state.count += 1;
  return { ok: true, retryAfter: 0 };
}

function configuredKeys(): string[] {
  return (process.env.API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function fail(res: VercelResponse, code: string, message: string, status: number): void {
  res.status(status).json({ error: { code, message } });
}

function readEmail(body: unknown): string | undefined {
  let parsed: unknown = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  const email = (parsed as { email?: unknown } | null)?.email;
  return typeof email === "string" && email.length > 0 ? email : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // CORS — let the widget call from any origin.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-api-key");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return fail(res, "method_not_allowed", "Use POST.", 405);
  }

  const keys = configuredKeys();
  const provided = (req.headers["x-api-key"] as string | undefined) ?? "";
  if (keys.length > 0 && !keys.includes(provided)) {
    return fail(res, "unauthorized", "Missing or invalid API key (header: x-api-key).", 401);
  }

  const rl = rateLimit(provided || "anon");
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.retryAfter));
    return fail(res, "rate_limited", "Too many requests.", 429);
  }

  const email = readEmail(req.body);
  if (!email) {
    return fail(res, "invalid_input", "Field 'email' is required and must be a non-empty string.", 422);
  }

  const result = await verifyEmail(email);
  res.status(200).json(result);
}
