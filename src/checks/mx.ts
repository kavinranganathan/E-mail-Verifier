import { resolveMx } from "node:dns/promises";

// MX resolver is injectable so the orchestrator and tests can swap it.
// PLAN: cache results TTL-aware in production (Vercel KV / in-memory LRU).
export type MxResolver = (domain: string) => Promise<boolean>;

export const liveMxResolver: MxResolver = async (domain) => {
  try {
    const records = await resolveMx(domain);
    return records.length > 0;
  } catch {
    // NXDOMAIN, ENODATA, ENOTFOUND -> no usable mail server.
    return false;
  }
};
