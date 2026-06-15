import type { MailboxStatus } from "./types.js";

// PLAN R1 / D6: the SMTP mailbox probe is the most accurate check but cannot run
// on Vercel serverless (outbound port 25 blocked, shared-IP blocklisting). v1
// ships a no-op probe that always returns "unknown" — an honest answer, not a
// fake "deliverable". v2 swaps in a warmed-IP worker behind this same interface.

export interface MailboxProbe {
  probe(local: string, domain: string): Promise<MailboxStatus>;
}

export const noopMailboxProbe: MailboxProbe = {
  async probe(): Promise<MailboxStatus> {
    return "unknown";
  },
};
