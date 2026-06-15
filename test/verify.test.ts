import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyEmail } from "../src/verify.js";
import type { MailboxProbe } from "../src/mailboxProbe.js";

// Deterministic deps: MX always resolves, mailbox unknown (v1 default), unless overridden.
const mxYes = async () => true;
const mxNo = async () => false;
const probeExists: MailboxProbe = { async probe() { return "exists"; } };
const probeNotFound: MailboxProbe = { async probe() { return "not_found"; } };

test("invalid syntax -> undeliverable", async () => {
  const r = await verifyEmail("not-an-email", { resolveMx: mxYes });
  assert.equal(r.verdict, "undeliverable");
  assert.equal(r.signals.syntaxValid, false);
});

test("no MX records -> undeliverable", async () => {
  const r = await verifyEmail("user@no-mail-domain.com", { resolveMx: mxNo });
  assert.equal(r.verdict, "undeliverable");
  assert.equal(r.signals.domainHasMx, false);
});

test("disposable domain -> risky", async () => {
  const r = await verifyEmail("user@mailinator.com", { resolveMx: mxYes });
  assert.equal(r.verdict, "risky");
  assert.equal(r.signals.disposable, true);
});

test("role-based address -> risky", async () => {
  const r = await verifyEmail("info@example.com", { resolveMx: mxYes });
  assert.equal(r.verdict, "risky");
  assert.equal(r.signals.roleBased, true);
});

test("valid address, mailbox unknown (v1) -> deliverable but capped, not overclaimed", async () => {
  const r = await verifyEmail("alice@example.com", { resolveMx: mxYes });
  assert.equal(r.verdict, "deliverable");
  assert.equal(r.signals.mailbox, "unknown");
  assert.ok(r.score < 95, "score capped below a confirmed mailbox");
  assert.match(r.reason, /not SMTP-checked/i);
});

test("valid address, mailbox exists (v2 probe) -> deliverable", async () => {
  const r = await verifyEmail("alice@example.com", { resolveMx: mxYes, mailboxProbe: probeExists });
  assert.equal(r.verdict, "deliverable");
  assert.equal(r.signals.mailbox, "exists");
});

test("mailbox not found -> undeliverable", async () => {
  const r = await verifyEmail("ghost@example.com", { resolveMx: mxYes, mailboxProbe: probeNotFound });
  assert.equal(r.verdict, "undeliverable");
});

test("typo domain -> suggestion offered", async () => {
  const r = await verifyEmail("bob@gmial.com", { resolveMx: mxYes });
  assert.equal(r.suggestion, "bob@gmail.com");
});

test("free provider flagged, still deliverable with probe", async () => {
  const r = await verifyEmail("jane@gmail.com", { resolveMx: mxYes, mailboxProbe: probeExists });
  assert.equal(r.signals.freeProvider, true);
  assert.equal(r.verdict, "deliverable");
});

test("normalizes case and whitespace", async () => {
  const r = await verifyEmail("  Alice@Example.COM  ", { resolveMx: mxYes });
  assert.equal(r.normalized, "alice@example.com");
});
