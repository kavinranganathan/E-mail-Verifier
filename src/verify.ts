import type { Signals, Verdict, VerifyResult } from "./types.js";
import { normalizeEmail, parseEmail } from "./checks/syntax.js";
import { isDisposable, isFreeProvider, isRoleBased } from "./checks/classify.js";
import { liveMxResolver, type MxResolver } from "./checks/mx.js";
import { noopMailboxProbe, type MailboxProbe } from "./mailboxProbe.js";
import { suggestCorrection } from "./typoSuggest.js";

export interface VerifyDeps {
  resolveMx?: MxResolver;
  mailboxProbe?: MailboxProbe;
}

function rollup(signals: Signals): { verdict: Verdict; score: number; reason: string } {
  // Hard fails first.
  if (!signals.syntaxValid) {
    return { verdict: "undeliverable", score: 0, reason: "Invalid email syntax." };
  }
  if (!signals.domainHasMx) {
    return { verdict: "undeliverable", score: 5, reason: "Domain has no mail server (no MX records)." };
  }
  if (signals.mailbox === "not_found") {
    return { verdict: "undeliverable", score: 10, reason: "Mailbox does not exist." };
  }
  // "risky" is reserved for genuine risk signals — not for an unconfirmed mailbox.
  if (signals.disposable) {
    return { verdict: "risky", score: 25, reason: "Disposable / temporary email provider." };
  }
  if (signals.roleBased) {
    return { verdict: "risky", score: 55, reason: "Role-based address (not a specific person)." };
  }
  // Clean address with a confirmed mailbox (v2 SMTP probe).
  if (signals.mailbox === "exists") {
    return { verdict: "deliverable", score: 95, reason: "Mailbox confirmed and domain accepts mail." };
  }
  // Clean address, no risk flags, but the SMTP probe is deferred (v1). We say
  // deliverable (format + domain are verified) but cap the score and name the
  // caveat — honesty lives in the number and the reason, not in a scary label.
  return {
    verdict: "deliverable",
    score: 80,
    reason: "Format and domain verified, no risk signals. Mailbox not SMTP-checked yet (v2).",
  };
}

export async function verifyEmail(input: string, deps: VerifyDeps = {}): Promise<VerifyResult> {
  const resolveMx = deps.resolveMx ?? liveMxResolver;
  const mailboxProbe = deps.mailboxProbe ?? noopMailboxProbe;

  const normalized = normalizeEmail(input);
  const parsed = parseEmail(normalized);

  if (!parsed) {
    const signals: Signals = {
      syntaxValid: false,
      domainHasMx: false,
      disposable: false,
      roleBased: false,
      freeProvider: false,
      mailbox: "unknown",
    };
    const { verdict, score, reason } = rollup(signals);
    return { email: input, normalized, verdict, score, signals, reason };
  }

  const { local, domain } = parsed;
  const domainHasMx = await resolveMx(domain);

  const signals: Signals = {
    syntaxValid: true,
    domainHasMx,
    disposable: isDisposable(domain),
    roleBased: isRoleBased(local),
    freeProvider: isFreeProvider(domain),
    mailbox: domainHasMx ? await mailboxProbe.probe(local, domain) : "unknown",
  };

  const { verdict, score, reason } = rollup(signals);
  const suggestion = suggestCorrection(local, domain);

  return {
    email: input,
    normalized,
    verdict,
    score,
    signals,
    ...(suggestion ? { suggestion } : {}),
    reason,
  };
}
