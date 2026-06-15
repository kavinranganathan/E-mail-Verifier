// Core types for the email verifier. The verdict enum is the public contract —
// keep it stable (semver) once shipped.

export type Verdict = "deliverable" | "risky" | "undeliverable" | "unknown";

export type MailboxStatus = "exists" | "not_found" | "unknown";

export interface Signals {
  /** RFC-5322-ish syntax check passed. */
  syntaxValid: boolean;
  /** The domain has at least one MX record (can receive mail). */
  domainHasMx: boolean;
  /** Address belongs to a known disposable/temporary provider. */
  disposable: boolean;
  /** Local part is a role address (info@, sales@, admin@, ...). */
  roleBased: boolean;
  /** Free consumer mailbox (gmail, yahoo, ...). Informational, not bad. */
  freeProvider: boolean;
  /** Result of the SMTP mailbox probe. v1 ships "unknown" (probe deferred). */
  mailbox: MailboxStatus;
}

export interface VerifyResult {
  email: string;
  /** Normalized (trimmed + lowercased) address that was checked. */
  normalized: string;
  verdict: Verdict;
  /** 0-100 confidence rollup. */
  score: number;
  signals: Signals;
  /** Typo correction, e.g. "user@gmial.com" -> "user@gmail.com". */
  suggestion?: string;
  /** Human-readable explanation of the verdict. */
  reason: string;
}
