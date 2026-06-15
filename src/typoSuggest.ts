import { FREE_PROVIDERS } from "./data/free-providers.js";

// Powers the widget's "did you mean gmail.com?" nudge. Suggests a correction
// when the domain is a near-miss (edit distance 1-2) of a common provider.

const COMMON_DOMAINS: readonly string[] = [...FREE_PROVIDERS];

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/** Returns a suggested full email if the domain looks like a typo, else undefined. */
export function suggestCorrection(local: string, domain: string): string | undefined {
  const d = domain.toLowerCase();
  if (COMMON_DOMAINS.includes(d)) return undefined; // already correct
  let best: { domain: string; dist: number } | undefined;
  for (const candidate of COMMON_DOMAINS) {
    const dist = levenshtein(d, candidate);
    if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) {
      best = { domain: candidate, dist };
    }
  }
  return best ? `${local}@${best.domain}` : undefined;
}
