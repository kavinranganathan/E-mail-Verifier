# Email Verifier

Fast email verification with an **inline signup widget** and developer-first DX.
v1 does the cheap checks well (syntax, MX, disposable, role, free-provider) and is
honest about what it can't yet confirm. See [PLAN-email-verifier.md](PLAN-email-verifier.md)
for the strategy and the reviewed decisions.

## Verdicts

| Verdict | Score | Meaning |
|---------|-------|---------|
| `deliverable` | 95 | Mailbox confirmed by the SMTP probe (v2). |
| `deliverable` | 80 | Format + domain verified, no risk flags. Mailbox not SMTP-checked yet (v1 cap). |
| `risky` | 25–55 | A genuine risk signal: disposable provider or role address. |
| `undeliverable` | 0–10 | Bad syntax, no MX, or mailbox not found. |
| `unknown` | — | Could not determine. |

`risky` is reserved for **actual risk signals**, never for an unconfirmed mailbox.
Honesty lives in the **score**: a clean v1 address is `deliverable` but capped at 80
until the v2 SMTP probe can confirm the inbox — so we neither alarm you about a good
address nor fake a confidence we haven't earned.

**The score never reaches 100 — by design.** 95 is the ceiling, for a mailbox confirmed
by the SMTP probe. Deliverability is never fully certain (catch-all domains accept then
bounce, greylisting, a mailbox can be full/disabled when you actually send), so claiming
100 would be dishonest. Do not "fix" this to 100.

## Quickstart (< 5 min)

```bash
npm install
npm test          # run the check-logic tests (no network)
npm run cli -- alice@example.com bob@gmial.com
```

Example CLI output:

```
DELIVERABLE   alice@example.com  (80/100) — Format and domain verified, no risk signals. Mailbox not SMTP-checked yet (v2).
UNDELIVERABLE bob@gmial.com  ... did you mean: bob@gmail.com?
```

## API

`POST /api/verify` with `{ "email": "alice@example.com" }`. Auth via `x-api-key`
header (keys from the `API_KEYS` env var, comma-separated; skipped when unset for
local dev). Full contract in [openapi.yaml](openapi.yaml).

```bash
curl -s -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev-key' \
  -d '{"email":"alice@example.com"}'
```

## Inline widget (the differentiator)

```html
<input id="email" type="email" />
<script src="/widget/email-verify-widget.js"></script>
<script>
  EmailVerifyWidget.attach(document.getElementById("email"), {
    baseUrl: "https://your-app.vercel.app",
    apiKey: "pk_live_...",
  });
</script>
```

Verifies as the user types, debounced, with a clickable "did you mean gmail.com?" nudge.

## Typed client

```ts
import { EmailVerifierClient } from "./src/client.js";
const client = new EmailVerifierClient({ baseUrl: "https://your-app.vercel.app", apiKey: "..." });
const result = await client.verify("alice@example.com");
```

## Project layout

```
api/verify.ts          Vercel function (Node, Fluid Compute)
src/verify.ts          Orchestrator: runs checks, rolls up to a verdict
src/checks/            syntax, mx, classify (disposable/role/free)
src/mailboxProbe.ts    SMTP probe interface — no-op in v1, warmed-IP worker in v2
src/typoSuggest.ts     "did you mean ...?" engine
src/client.ts          Typed API client
bin/verify.ts          CLI
widget/                Inline browser widget
test/                  node:test suite (deps injected, no network)
openapi.yaml           API contract
```

## Deferred to v2 (by design)

- SMTP mailbox probe + catch-all detection (needs warmed-IP worker; Vercel blocks port 25).
- Shared-store rate limiting / quotas (v1 limiter is per-instance).
- Batch endpoint, CSV upload UI, dashboard, billing.
- Disposable/role lists move from seed files to a scheduled-refresh dataset.
