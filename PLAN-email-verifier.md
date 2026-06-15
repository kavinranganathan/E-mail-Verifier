# Plan — Email Verifier

Status: DRAFT (pre-review). Author: Kavin + Claude. Date: 2026-06-15.
Mode: Startup, pre-product.

## Stated assumptions (correct any that are wrong)

1. **User**: developers and growth/RevOps teams who send cold outreach or run signup
   forms and are losing money/deliverability to bad email addresses.
2. **Form factor**: a hosted **HTTP API** (verify one address + batch), plus a thin
   TypeScript client library and a CLI. API-first because that's how this category
   gets embedded into signup flows and outreach tools.
3. **Wedge**: one endpoint — `POST /verify` — that returns a clear verdict
   (`deliverable | risky | undeliverable | unknown`) with the sub-signals, fast.
4. **Business**: usage-based pricing (per-verification), free tier for the first N/month.
5. **Platform**: TypeScript on Vercel (Fluid Compute functions). Flagged risk below.

## What "verify an email" means (the checks)

| Check | What it catches | Cost/latency |
|-------|-----------------|--------------|
| Syntax (RFC 5322) | typos, malformed | instant, local |
| Domain + MX records | dead domains, no mail server | DNS lookup (~20-50ms) |
| Disposable detection | mailinator, temp-mail, etc. | local list lookup |
| Role-based detection | info@, sales@, admin@ | local pattern |
| Free provider flag | gmail/yahoo (not bad, just info) | local list |
| Catch-all detection | domains that accept everything | SMTP probe |
| SMTP mailbox probe | does the actual mailbox exist | **SMTP, port 25 outbound** |
| Gravatar/MX heuristics | extra confidence signal | HTTP |

Verdict = a scored rollup of the above, not a single boolean.

## MVP scope (v1)

- `POST /verify` single-address, full check chain, returns verdict + sub-signals.
- `POST /verify/batch` async batch with a job id + polling/webhook.
- Syntax + MX + disposable + role + free-provider checks (all cheap, no SMTP).
- API key auth, per-key rate limiting, usage metering.
- TS client lib + `verify` CLI.
- Docs page with live "try it" box.

## Explicitly deferred (v2+)

- SMTP mailbox probe + catch-all detection (see risk).
- Dashboard UI, billing integration, team accounts.
- Bulk file upload (CSV) UI.
- Webhooks beyond batch completion.

## Known risks (for eng/design review to chew on)

- **R1 (critical): SMTP probing on Vercel serverless won't work.** Outbound port 25
  is blocked on most serverless/cloud egress, and probing from shared IPs gets you
  blocklisted fast. The single most accurate check (does the mailbox exist) is the
  one the chosen platform can't do well. Options: (a) ship v1 without SMTP probe and
  market on the cheap checks; (b) run SMTP probing on a separate worker with
  dedicated, warmed, reverse-DNS'd IPs; (c) proxy to a third-party probe API.
- **R2: accuracy honesty.** Without SMTP, accuracy is materially lower than ZeroBounce
  et al. Verdicts must not overclaim. `unknown` is a valid, honest answer.
- **R3: abuse.** A verify API is an enumeration/harvesting tool. Need auth, rate
  limits, and an acceptable-use stance from day one.
- **R4: disposable/role lists rot.** Need a refresh pipeline, not a static file.

## Open questions for the user

- Is the buyer a developer embedding it, or a marketer cleaning a list? Changes the
  first surface (API vs CSV upload).
- Is SMTP-level accuracy a must-have for v1, or is "cheap checks done well" enough
  to get the first paying user?

---

## GSTACK REVIEW REPORT

Pipeline: autoplan (CEO → design → eng → devex). Auto-decisions applied via the 6
principles. Taste + User-Challenge calls deferred to the approval gate below.

### CEO / strategy lens  (completeness + boil-lakes dominate)

- **USER CHALLENGE — the wedge is commoditized.** The drafted wedge is syntax + MX +
  disposable + role checks. Every competitor and a dozen free npm libs do exactly
  that. The actual paid value in this category is the SMTP mailbox probe — the one
  thing the chosen platform can't do. As written, v1 is "a worse, slower free
  library behind a paywall." This is not a taste call; it's the central risk.
- Differentiation must come from somewhere real: developer DX (best client + inline
  signup-form widget), latency (sub-100ms verdicts at signup time), price, privacy
  (self-hostable / no-data-retention), or a vertical (e.g. verify-at-signup SDK).
- Verdict: **do not ship the plan as-is.** Pick a differentiator before building.

### Design lens  (explicit + completeness)

- Verdict enum `deliverable | risky | undeliverable | unknown` is correct and matches
  industry norms. Keep it. ✅ auto-approved.
- Sub-signals must be returned alongside the rollup so callers can set their own
  threshold. ✅ auto-approved (completeness).
- Need explicit, documented states for: rate-limit hit (429 + retry-after), invalid
  key (401), malformed input (422), and timeout/unknown (200 with `unknown`). ✅ added.

### Eng lens  (explicit + pragmatic)

- **R1 confirmed as architecture-level.** SMTP probe on Vercel serverless = blocked
  port 25 + shared-IP blocklisting. Auto-decision: **abstract the probe behind a
  `MailboxProbe` interface; v1 ships a no-op/heuristic impl; a dedicated warmed-IP
  worker is a v2 swap.** Don't build SMTP on serverless. ✅ auto-approved (pragmatic).
- DRY: do not hand-roll RFC 5322 or the disposable list. Use a vetted validator lib +
  a maintained, refreshable disposable-domains dataset. ✅ auto-approved.
- Cache DNS/MX lookups (TTL-aware). Make batch jobs idempotent + resumable. ✅ auto.
- R4: disposable/role lists need a scheduled refresh, not a committed static file. ✅ auto.

### DevEx lens  (API/CLI/SDK readiness)

- Ship an OpenAPI spec + typed TS client generated from it; CLI wraps the client. ✅ auto.
- Time-to-first-verify must be <5 min: get key → one curl → one verdict. ✅ auto.
- Stable verdict enum + semver on the client. Consistent error envelope. ✅ auto.

### Auto-decided (mechanical, no action needed)
Use existing libs; cache DNS; abstract SMTP behind an interface; defer SMTP to v2;
`unknown` is a first-class verdict; return sub-signals; OpenAPI-first client.

### Deferred to approval gate (taste + the user challenge)
See the four decisions presented to the user.

---

## LOCKED DECISIONS (approval gate, 2026-06-15)

- **D5 Differentiator → Inline signup widget + DX.** The product wins on a drop-in
  widget/SDK that verifies at signup time plus the cleanest API+client in the
  category. Check depth is table stakes; experience is the moat. This re-points the
  wedge away from the commoditized check list.
- **D6 SMTP probe → defer to v2.** v1 ships cheap checks only; `MailboxProbe` is an
  interface with a heuristic impl. Verdicts return honest `unknown` where SMTP would
  be needed. No accuracy overclaim.
- **D7 Platform → stay on Vercel.** API + cheap checks on Vercel Fluid Compute. If
  accuracy/SMTP ever matters, it runs on a separate warmed-IP worker, not Vercel.
- **D8 First surface → API + typed client + CLI.** Developer-first. CSV-upload UI is
  a later surface, not v1.

### Revised v1 scope (reconciled with decisions)
1. `POST /verify` + `POST /verify/batch` (syntax, MX, disposable, role, free-provider).
2. **Inline verify widget / browser SDK** — the differentiator. Verifies as the user
   types their email in a signup form; debounced; returns verdict + suggestion
   ("did you mean gmail.com?").
3. Typed TS client generated from OpenAPI + `verify` CLI.
4. API-key auth, per-key rate limiting + usage metering, documented error envelope
   (401/422/429/200-unknown).
5. Docs site with live "try it" box and <5-min quickstart.
6. `MailboxProbe` interface in place (no-op v1) so v2 SMTP is a swap, not a rewrite.

### Stack (locked)
TypeScript, Vercel Fluid Compute functions, vetted RFC-5322 validator lib, maintained
+ scheduled-refresh disposable-domains dataset, DNS/MX cache, OpenAPI-generated client.

Status: **APPROVED — ready to build.**

