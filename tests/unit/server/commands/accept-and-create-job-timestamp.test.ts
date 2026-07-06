/**
 * Story 7.2 — 7.2-UNIT-01 (P2, R-715, H1): the TIMESTAMP-INJECTION adapter for the
 * `acceptQuoteAndCreateJob` command → `accept_quote_and_create_job` RPC boundary is
 * DETERMINISTIC — the RPC receives an EXPLICIT accepted moment (`p_accepted_at` = the
 * `input.accepted_at` the user supplied) AND an EXPLICIT command instant (from the injected
 * `ctx.clock.now()`), and NEVER derives either from a wall clock. This is the fast, DB-free half of
 * the determinism proof the DB-backed INT suite (`accept-quote-and-create-job.int.test.ts`)
 * exercises end-to-end; it mirrors Epic 6's mark-sent injected-timestamp unit (`command-clock.test.
 * ts` / `mark-quote-version-sent-validation.test.ts`).
 *
 * ── THE RULE (H1 determinism; the acceptance/job transaction must be reproducible) ────────────────
 *   - `p_accepted_at` = the caller's EXPLICIT `input.accepted_at` (the accepted moment — a business
 *     fact, not "now"). Two calls with the same input yield the same `p_accepted_at`.
 *   - The command instant (any `occurred_at` the command anchors, and the audit row's timing) comes
 *     from the SINGLE injected `ctx.clock.now()` — never `new Date()` / `Date.now()` inside the
 *     command or a `now()` for the accepted instant inside the RPC.
 *   - A fixed clock ⇒ a fixed set of RPC args (byte-stable). A wall-clock leak would make the args
 *     drift between two otherwise-identical invocations and this test would catch it.
 *
 * PURE, in-memory, NO DB, NO PII, NO real clock — runs under `node --test` (the fast gate). Öre
 * values kept < 10 digits (the orgnr-scan boundary, R-717).
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * RED PHASE (ATDD, Story 7.2). The command's RPC-arg adapter does NOT yet exist. DEV must expose the
 * mapping as a PURE, testable seam (mirror how mark-sent's timestamp is unit-pinned) — e.g. a
 * `buildAcceptAndCreateJobRpcArgs(input, clock)` helper in `accept-and-create-job.ts` (or the
 * command's `execute` refactored so the arg object is inspectable). Until then this test is `skip`-ed
 * per case; the GREEN pass imports the real adapter and clears the `{ skip: true }` markers.
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *
 * [Source: test-design-epic-7.md#7.2-UNIT-01, R-715 + Testability note (determinism H1); story 7.2
 *  Task 2.6 + Dev Notes "Determinism (H1, R-715)"; src/server/commands/quotes/mark-sent.ts
 *  (p_sent_at = ctx.clock.now().toISOString() — the injected-clock precedent to mirror);
 *  tests/unit/server/commands/command-clock.test.ts (the injected-clock unit precedent)]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildAcceptAndCreateJobRpcArgs } from "@/server/commands/quotes/accept-and-create-job";
import type { CommandClock } from "@/server/commands/clock";

const FIXED_ISO = "2026-07-10T09:00:00.000Z";
const ACCEPTED_ISO = "2026-07-10T08:30:00.000Z"; // the EXPLICIT accepted moment (≠ the command clock)
const fixedClock: CommandClock = { now: () => new Date(FIXED_ISO) };

const baseInput = {
  quote_version_id: "00000000-0000-4000-8000-000000000abc",
  accepted_price_ore: 125_000,
  accepted_at: ACCEPTED_ISO,
  title: "Jobb från accepterad offert",
} as const;

describe("acceptQuoteAndCreateJob — timestamp-injection adapter (7.2-UNIT-01, H1)", () => {
  test("p_accepted_at is the EXPLICIT input.accepted_at, NOT the command clock", () => {
    const args = buildAcceptAndCreateJobRpcArgs(baseInput, fixedClock);
    assert.equal(args.p_accepted_at, ACCEPTED_ISO);
    assert.notEqual(args.p_accepted_at, FIXED_ISO); // the accepted moment is a business fact, not "now"
  });

  test("the command instant comes from the injected clock (deterministic — no wall clock)", () => {
    const args = buildAcceptAndCreateJobRpcArgs(baseInput, fixedClock);
    // The command instant (p_command_at) = the injected clock, never a wall-clock read.
    assert.equal(args.p_command_at, FIXED_ISO);
  });

  test("a fixed clock yields byte-stable RPC args across two identical calls (reproducible transaction)", () => {
    const a1 = buildAcceptAndCreateJobRpcArgs(baseInput, fixedClock);
    const a2 = buildAcceptAndCreateJobRpcArgs(baseInput, fixedClock);
    assert.deepEqual(a1, a2);
  });

  test("the resolved tenant is NEVER sourced from the input (p_tenant_id is threaded from ctx, not input)", () => {
    // The input carries NO tenant_id / accepted-user field — the adapter must not read one from it.
    assert.equal("tenant_id" in baseInput, false);
    const args = buildAcceptAndCreateJobRpcArgs(baseInput, fixedClock);
    // p_tenant_id is added by execute from ctx.tenantContext, NOT by the adapter.
    assert.equal("p_tenant_id" in args, false);
  });
});
