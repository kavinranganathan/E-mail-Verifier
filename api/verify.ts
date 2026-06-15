import { verifyEmail } from "../src/verify.js";

// Vercel Function (Node, Fluid Compute) using the Web-standard handler signature.
//
// Auth: send `x-api-key`. Keys are read from the API_KEYS env var (comma-separated).
// If API_KEYS is unset (local dev), auth is skipped.
//
// Error envelope is consistent across all failures: { error: { code, message } }.

interface RateState {
  count: number;
  resetAt: number;
}

// NOTE: in-memory limiter is per-instance only. Fine for v1 / abuse-speed-bumping.
// PLAN: move to a shared store (Vercel KV / Upstash) for real quotas.
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

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function err(code: string, message: string, status: number, headers?: Record<string, string>): Response {
  return json({ error: { code, message } }, status, headers);
}

function configuredKeys(): string[] {
  return (process.env.API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return err("method_not_allowed", "Use POST.", 405, { allow: "POST" });
  }

  const keys = configuredKeys();
  const provided = req.headers.get("x-api-key") ?? "";
  if (keys.length > 0 && !keys.includes(provided)) {
    return err("unauthorized", "Missing or invalid API key (header: x-api-key).", 401);
  }

  const rl = rateLimit(provided || "anon");
  if (!rl.ok) {
    return err("rate_limited", "Too many requests.", 429, { "retry-after": String(rl.retryAfter) });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return err("invalid_body", "Request body must be valid JSON.", 422);
  }

  const email = (payload as { email?: unknown })?.email;
  if (typeof email !== "string" || email.length === 0) {
    return err("invalid_input", "Field 'email' is required and must be a string.", 422);
  }

  const result = await verifyEmail(email);
  return json(result, 200);
}
