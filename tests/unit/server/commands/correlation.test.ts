/**
 * Story 2.3 — PURE-LOGIC tests for the correlation/request-id primitive
 * (`@/server/commands/correlation`). The envelope resolves ONE correlation id per
 * command invocation (written to `audit_events.correlation_id` and available to
 * logs). A route handler may forward an inbound request id so the client request
 * and the server command share an id; otherwise a fresh UUID is generated. The
 * supplied id is NEVER trusted for an authority decision — it is purely a tracing
 * value (so any non-empty string is accepted as-is).
 *
 * Coverage gap closed by this file (test-automation expansion): `resolveCorrelationId`
 * had NO unit coverage despite being an authority-surface primitive every command
 * uses. Mirrors the established node:test + node:assert pure-unit style.
 *
 * COVERAGE (story AC1/AC3; Task 2.2): inbound id passthrough, empty-string/null/
 * undefined fallback to a fresh UUID, and per-call uniqueness of generated ids.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCorrelationId } from "@/server/commands/correlation";

/** RFC-4122 v4 UUID shape (what crypto.randomUUID() emits). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("Task 2.2: a non-empty inbound id is used AS-IS (the client request and command share one id)", () => {
  const inbound = "req-abc-123";
  assert.equal(resolveCorrelationId(inbound), inbound);
});

test("Task 2.2: a non-empty inbound id is passed through verbatim even when it is itself a UUID", () => {
  const inbound = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  assert.equal(resolveCorrelationId(inbound), inbound);
});

test("Task 2.2: an EMPTY-STRING inbound id falls back to a fresh generated UUID (empty is not a usable id)", () => {
  const id = resolveCorrelationId("");
  assert.match(id, UUID_RE);
});

test("Task 2.2: a null inbound id falls back to a fresh generated UUID", () => {
  const id = resolveCorrelationId(null);
  assert.match(id, UUID_RE);
});

test("Task 2.2: an undefined / omitted inbound id falls back to a fresh generated UUID", () => {
  assert.match(resolveCorrelationId(undefined), UUID_RE);
  assert.match(resolveCorrelationId(), UUID_RE);
});

test("Task 2.2: two generated ids (no inbound) are DISTINCT — one id per command invocation, not a shared constant", () => {
  const a = resolveCorrelationId();
  const b = resolveCorrelationId();
  assert.notEqual(a, b);
  assert.match(a, UUID_RE);
  assert.match(b, UUID_RE);
});
