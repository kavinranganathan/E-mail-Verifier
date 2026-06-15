import { DISPOSABLE_DOMAINS } from "../data/disposable-domains.js";
import { FREE_PROVIDERS } from "../data/free-providers.js";

// Common role-based local parts. Role addresses are deliverable but rarely a
// real person, so they get flagged as "risky" by the rollup.
const ROLE_LOCAL_PARTS: ReadonlySet<string> = new Set([
  "info",
  "support",
  "sales",
  "admin",
  "administrator",
  "contact",
  "help",
  "billing",
  "office",
  "hello",
  "team",
  "no-reply",
  "noreply",
  "postmaster",
  "abuse",
  "webmaster",
  "marketing",
  "hr",
  "jobs",
  "careers",
]);

export function isDisposable(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

export function isFreeProvider(domain: string): boolean {
  return FREE_PROVIDERS.has(domain.toLowerCase());
}

export function isRoleBased(local: string): boolean {
  return ROLE_LOCAL_PARTS.has(local.toLowerCase());
}
