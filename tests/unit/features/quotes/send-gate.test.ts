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
 * `canSendQuoteVersion` runs the SAME 5.4 `classifyReadiness` rule table (no fork) —
 * `sendable === blockers.length === 0`. `evaluateSendGate` is the FROZEN-snapshot variant the
 * mark-sent COMMAND uses (it consumes the version's captured `warnings_snapshot` severities);
 * both share the identical `blockers.length === 0` semantics so preview and send never disagree.
 *
 * [Source: test-design-epic-6.md#6.4-UNIT-01, R-608; story 6.4 Task 4.1 + Task 6.1;
 *  src/features/calculations/readiness.ts (ReadinessReport — blockers vs warnings; canCreateQuote
 *  = blockers.length === 0); src/features/quotes/send-gate.ts (canSendQuoteVersion +
 *  evaluateSendGate); src/server/commands/quotes/quotes.ts:189 (the 6.1 create path already calls
 *  classifyReadiness — reuse the SAME classification, don't fork)]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyReadiness,
  type ReadinessInput,
} from "@/features/calculations/readiness";
import {
  canSendQuoteVersion,
  evaluateSendGate,
} from "@/features/quotes/send-gate";

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
            vat_type: "STANDARD_VAT_25",
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

test("6.4-UNIT-01 (AC1): a version with NO blockers is SENDABLE", () => {
  const input = sendableInput();
  // Sanity: the underlying classifier agrees there are no blockers (the gate must match it).
  assert.equal(classifyReadiness(input).blockers.length, 0);
  assert.equal(canSendQuoteVersion(input), true);
});

test("6.4-UNIT-01 (AC1): a MISSING_CUSTOMER blocker makes the version UNSENDABLE", () => {
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

test("6.4-UNIT-01 (AC1): a TOTAL_UNCOMPUTABLE blocker makes the version UNSENDABLE", () => {
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
            vat_type: "STANDARD_VAT_25",
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

test("6.4-UNIT-01 (AC1): WARNINGS never gate — a version with only warnings IS SENDABLE", () => {
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
            vat_type: "STANDARD_VAT_25",
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

// ── evaluateSendGate — the FROZEN-snapshot variant the mark-sent COMMAND consumes ────────────
// The command gates on the version's captured `warnings_snapshot` severities (NOT a live calc
// re-read; architecture §11). `canSend === blockers.length === 0` — the identical semantics.

test("6.4-UNIT-01 (AC1): evaluateSendGate — a frozen snapshot with NO blocker severity IS sendable", () => {
  const gate = evaluateSendGate({
    warningsSnapshot: [
      { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "…" },
      { code: "MISSING_FACILITY", severity: "warning", message: "…" },
    ],
    signOff: { requiresSignOff: true, termsApprovedAt: null },
  });
  assert.equal(gate.canSend, true);
  assert.equal(gate.blockers.length, 0);
});

test("6.4-UNIT-01 (AC1): evaluateSendGate — a frozen snapshot carrying a BLOCKER severity is UNSENDABLE", () => {
  const gate = evaluateSendGate({
    warningsSnapshot: [
      { code: "MISSING_CUSTOMER", severity: "blocker", message: "…" },
      { code: "MISSING_FACILITY", severity: "warning", message: "…" },
    ],
    signOff: { requiresSignOff: true, termsApprovedAt: null },
  });
  assert.equal(gate.canSend, false);
  assert.equal(gate.blockers.length, 1);
  assert.equal(gate.blockers[0]?.code, "MISSING_CUSTOMER");
});

test("6.4-UNIT-01 (R-610): a requires_sign_off=true snapshot is STILL sendable (demo-data-only accept — sign-off never gates)", () => {
  // The re-derived sign-off posture is threaded in as server truth but NEVER turns a warning into
  // a blocker for demo data (MEMORY: tax/terms sign-off deferred). An UNAPPROVED estimate sends.
  const gate = evaluateSendGate({
    warningsSnapshot: [
      { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "…" },
    ],
    signOff: { requiresSignOff: true, termsApprovedAt: null, customerDataTrack: "demo" },
  });
  assert.equal(gate.canSend, true);
});

test("10.6: unresolved TAX_SIGN_OFF_REQUIRED blocks a real-customer send but not a demo", () => {
  const frozenTaxWarning = [
    { code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "…" },
  ];
  assert.equal(
    evaluateSendGate({
      warningsSnapshot: frozenTaxWarning,
      signOff: { requiresSignOff: true, termsApprovedAt: null, customerDataTrack: "real_customer" },
    }).canSend,
    false,
  );
  assert.equal(
    evaluateSendGate({
      warningsSnapshot: frozenTaxWarning,
      signOff: { requiresSignOff: true, termsApprovedAt: null, customerDataTrack: "demo" },
    }).canSend,
    true,
  );
});
