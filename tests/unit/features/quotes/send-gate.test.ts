/**
 * Story 6.4 — 6.4-UNIT-01 (P0, AC1): the SEND-GATE adapter is pinned against the SAME
 * Story-5.4 `classifyReadiness` rule table — DO NOT FORK the blocker rule (R-608).
 *
 * "A draft that passes blocking readiness checks" means `blockers.length === 0` (the SAME
 * `canCreateQuote` gate the 5.4 preview + the 6.1 create path already use). A version with a
 * BLOCKER (MISSING_CUSTOMER / TOTAL_UNCOMPUTABLE) is UNSENDABLE; a version with only WARNINGS
 * (MISSING_FACILITY / LOW_MARGIN / TAX_SIGN_OFF_REQUIRED / requires_sign_off) IS sendable —
 * warnings NEVER gate (the demo-data-only accepted posture). Re-implementing the blocker rule is
 * the failure this pin prevents.
 *
 * PURE, in-memory, NO DB, NO PII, NO clock — runs under `node --test` (the fast gate that must
 * protect the send-gate classification). The helper is a sibling `.ts` (NOT inside a `.tsx`) so
 * `node --test` can import it (the JSX-can't-import-into-node:test trap).
 *
 * ── ATDD RED PHASE ─────────────────────────────────────────────────────────────────────────
 * `canSendQuoteVersion` (`src/features/quotes/send-gate.ts`) does NOT exist yet. Every case is
 * `{ skip: "ATDD red phase — send-gate not implemented (Story 6.4 Task 4)" }` so the fast gate
 * stays GREEN (visible SKIP, never a failing build) until Task 4 lands. The `declare` block
 * placeholders the not-yet-existent module so `tsc --noEmit` is clean in the red phase; DELETE
 * the `declare` block + import the real symbols when flipping green.
 *
 * GREEN-PHASE HANDOFF: implement `canSendQuoteVersion` as a thin adapter over `classifyReadiness`
 * (or a snapshot-shaped adapter yielding the IDENTICAL blocker set) → un-skip every case → delete
 * the `declare` placeholder → import from `@/features/quotes/send-gate`.
 *
 * [Source: test-design-epic-6.md#6.4-UNIT-01, R-608; story 6.4 Task 4.1 + Task 6.1;
 *  src/features/calculations/readiness.ts (ReadinessReport — blockers vs warnings; canCreateQuote
 *  = blockers.length === 0); src/server/commands/quotes/quotes.ts:189 (the 6.1 create path already
 *  calls classifyReadiness — reuse the SAME classification, don't fork)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyReadiness,
  type ReadinessInput,
} from "@/features/calculations/readiness";

// ── ATDD red-phase placeholder for the not-yet-existent send gate ───────────────────────────
// DELETE this `declare` block in the green phase and replace with:
//   import { canSendQuoteVersion } from "@/features/quotes/send-gate";
// The gate takes the SAME already-read readiness input (resolved values passed IN — no
// src/lib -> src/server inversion) and returns whether the version is sendable. It MUST consume
// `classifyReadiness` (or an identical snapshot-shaped adapter) — `sendable === blockers.length === 0`.
declare function canSendQuoteVersion(input: ReadinessInput): boolean;

/** A minimal SENDABLE readiness input: a linked customer + a computable total, no blockers. */
function sendableInput(): ReadinessInput {
  return {
    customer: {
      customer_id: crypto.randomUUID(),
      customer_display_name: "Kund AB",
      customer_type: "company",
      facility_name: "Anläggning 1",
      contact_name: "Anna Kontakt",
    },
    sections: [
      {
        rows: [
          {
            row_type: "material",
            quantity: 1,
            unit_sell_ore: 100000,
            unit_cost_ore: 60000,
            vat_rate_bp: 2500,
            is_hidden: false,
            is_optional: false,
            is_selected: null,
            source_kind: "article",
          },
        ],
      },
    ],
    vatPostureResolved: true,
    tax: { hasDeductionAssumption: false },
  };
}

test("6.4-UNIT-01 (AC1): a version with NO blockers is SENDABLE", { skip: "ATDD red phase — send-gate not implemented (Story 6.4 Task 4)" }, () => {
  const input = sendableInput();
  // Sanity: the underlying classifier agrees there are no blockers (the gate must match it).
  assert.equal(classifyReadiness(input).blockers.length, 0);
  assert.equal(canSendQuoteVersion(input), true);
});

test("6.4-UNIT-01 (AC1): a MISSING_CUSTOMER blocker makes the version UNSENDABLE", { skip: "ATDD red phase — send-gate not implemented (Story 6.4 Task 4)" }, () => {
  const input: ReadinessInput = {
    ...sendableInput(),
    customer: {
      customer_id: null,
      customer_display_name: null,
      customer_type: null,
      facility_name: null,
      contact_name: null,
    },
  };
  const report = classifyReadiness(input);
  assert.ok(report.blockers.some((b) => b.code === "MISSING_CUSTOMER"));
  // The gate MUST reject a blocked version — a blocked draft is unsendable (R-608).
  assert.equal(canSendQuoteVersion(input), false);
});

test("6.4-UNIT-01 (AC1): a TOTAL_UNCOMPUTABLE blocker makes the version UNSENDABLE", { skip: "ATDD red phase — send-gate not implemented (Story 6.4 Task 4)" }, () => {
  // A crafted overflow row → the engine rejects the total → TOTAL_UNCOMPUTABLE blocker.
  const input: ReadinessInput = {
    ...sendableInput(),
    sections: [
      {
        rows: [
          {
            row_type: "material",
            quantity: Number.MAX_SAFE_INTEGER,
            unit_sell_ore: Number.MAX_SAFE_INTEGER,
            unit_cost_ore: 0,
            vat_rate_bp: 2500,
            is_hidden: false,
            is_optional: false,
            is_selected: null,
            source_kind: "article",
          },
        ],
      },
    ],
  };
  const report = classifyReadiness(input);
  assert.ok(report.blockers.some((b) => b.code === "TOTAL_UNCOMPUTABLE"));
  assert.equal(canSendQuoteVersion(input), false);
});

test("6.4-UNIT-01 (AC1): WARNINGS never gate — a version with only warnings IS SENDABLE", { skip: "ATDD red phase — send-gate not implemented (Story 6.4 Task 4)" }, () => {
  // No facility/contact (warnings), a low-margin row (warning), a ROT sign-off assumption
  // (TAX_SIGN_OFF_REQUIRED warning — the demo-data-only accepted posture), a hidden counted row.
  const input: ReadinessInput = {
    customer: {
      customer_id: crypto.randomUUID(),
      customer_display_name: "Kund AB",
      customer_type: "private",
      facility_name: null, // MISSING_FACILITY warning
      contact_name: null, // MISSING_CONTACT warning
    },
    sections: [
      {
        rows: [
          {
            row_type: "labor",
            quantity: 1,
            unit_sell_ore: 100000,
            unit_cost_ore: 95000, // LOW_MARGIN warning (TB% < 15%)
            vat_rate_bp: 2500,
            is_hidden: true, // HIDDEN_ROWS_INCLUDED warning
            is_optional: false,
            is_selected: null,
            source_kind: null, // MISSING_WORK_ROLE warning
          },
        ],
      },
    ],
    vatPostureResolved: true,
    tax: {
      hasDeductionAssumption: true, // TAX_SIGN_OFF_REQUIRED warning (requires_sign_off posture)
      deductionType: "rot",
      eligibilityPosture: "private",
    },
  };
  const report = classifyReadiness(input);
  // Many warnings, but ZERO blockers → still sendable.
  assert.equal(report.blockers.length, 0);
  assert.ok(report.warnings.length > 0);
  assert.ok(report.warnings.some((w) => w.code === "TAX_SIGN_OFF_REQUIRED"));
  assert.equal(canSendQuoteVersion(input), true);
});
