#!/usr/bin/env node
import { verifyEmail } from "../src/verify.js";

// CLI: verify one or more addresses locally (uses live DNS, no API needed).
//   verify alice@example.com bob@gmial.com
//   verify --json alice@example.com

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const emails = args.filter((a) => !a.startsWith("--"));

  if (emails.length === 0) {
    console.error("usage: verify [--json] <email> [email...]");
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(emails.map((e) => verifyEmail(e)));

  if (asJson) {
    console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
    return;
  }

  for (const r of results) {
    const tag = r.verdict.toUpperCase().padEnd(13);
    let line = `${tag} ${r.normalized}  (${r.score}/100) — ${r.reason}`;
    if (r.suggestion) line += `\n              did you mean: ${r.suggestion}?`;
    console.log(line);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
