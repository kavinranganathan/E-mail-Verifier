// RFC-5322-pragmatic syntax check.
// NOTE (PLAN/DRY): for production, swap this for a vetted validator lib. This
// implementation covers the common 99% and keeps v1 dependency-free.

export interface ParsedAddress {
  local: string;
  domain: string;
}

// Pragmatic pattern: a local part (dot-separated atoms, common specials allowed)
// + "@" + a domain with at least one dot and valid labels.
const LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseEmail(email: string): ParsedAddress | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || domain.length > 255) return null;
  if (!LOCAL.test(local)) return null;
  const labels = domain.split(".");
  if (labels.length < 2) return null;
  if (!labels.every((l) => LABEL.test(l))) return null;
  // TLD should not be all-numeric.
  const tld = labels[labels.length - 1]!;
  if (/^\d+$/.test(tld)) return null;
  return { local, domain };
}

export function isValidSyntax(email: string): boolean {
  return parseEmail(email) !== null;
}
