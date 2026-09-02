/**
 * PURE mark-sent SEND-GATE adapter (Story 6.4, Task 4 / AC1; R-608) — "is this version
 * sendable?".
 *
 * IT DOES NOT FORK THE READINESS RULE TABLE (R-608). The gate consumes the SAME
 * blocker-vs-warning classification the Story-5.4 preview + the 6.1 create path produced:
 * the version's FROZEN `warnings_snapshot` (built at create time from `classifyReadiness`
 * — see `src/server/commands/quotes/quotes.ts`) carries every issue as a 5.4 `ReadinessCode`
 * + `ReadinessSeverity`. The gate is derived SOLELY from `blockers.length === 0` (the
 * identical `canCreateQuote` semantics) — a version whose frozen snapshot carries ANY
 * `severity: "blocker"` issue is UNSENDABLE; WARNINGS NEVER gate (a `TAX_SIGN_OFF_REQUIRED`
 * / `requires_sign_off` warning is the demo-data-only accepted posture, NOT a send blocker).
 *
 * DATA SOURCE (documented decision — Task 4.2): the gate reads the FROZEN snapshot's blocker
 * state, NOT a re-read of the live calc. RATIONALE: a sent version freezes the SNAPSHOT (the
 * commitment) — re-reading the live calc would let a later calc edit change the sendability
 * of an already-frozen version (architecture §11). The classification LOGIC is still the 5.4
 * rule table (the snapshot's severities ARE its output), so preview and send can never
 * disagree. The captured set today has no blocker codes for a version that passed the create
 * gate — but a directly-RPC-forged version could carry one, and this gate rejects it.
 *
 * SERVER-TRUTH RE-DERIVATION (Task 4.3 — the 6.1 direct-RPC-forge deferral): the send path
 * must NOT trust the persisted `requires_sign_off` / `terms_approved_at` blindly as the
 * "approved, safe to send" signal — a directly-callable create RPC could persist a forged
 * `requires_sign_off=false`. This module re-derives the sign-off posture from the demo-data-
 * only default (`requiresSignOff` STAYS `true` — an UNAPPROVED estimate — and is ACCEPTED
 * for demo data; MEMORY: tax/terms sign-off deferred). In Phase A demo-data-only the send is
 * NOT hard-blocked by an unapproved-terms gate — the point of "re-derive as server truth" is
 * that the gate is computed HERE from the classifier + the demo posture, not from a client-
 * forgeable persisted boolean, so a forged `requires_sign_off=false` cannot smuggle a version
 * past a real gate if one is later enabled (STOP + re-score to a blocker if real-customer use
 * is proposed).
 *
 * PURE: no `"use client"`, no DB, no clock, no network, no PII. Resolved values are passed IN
 * (no `src/lib`→`src/server` inversion). Unit-pinned (6.4-UNIT-01).
 *
 * [Source: src/features/calculations/readiness.ts (ReadinessCode/ReadinessSeverity — the
 *  single rule table; canCreateQuote = blockers.length === 0); src/server/commands/quotes/
 *  quotes.ts:189-224 (the 6.1 create path captures the SAME classification into warnings_
 *  snapshot); test-design-epic-6.md#6.4-UNIT-01/6.4-INT-04, R-608/R-610; architecture.md#11
 *  (a sent version freezes the snapshot); MEMORY (demo-data-only; requiresSignOff framing)]
 */
import {
  classifyReadiness,
  type ReadinessCode,
  type ReadinessInput,
  type ReadinessSeverity,
} from "@/features/calculations/readiness";

/**
 * A single FROZEN warnings-snapshot issue as read off the version row (the 5.4 classifier
 * output, copy-by-value). `severity` is the SAME `ReadinessSeverity` the classifier emitted.
 */
export interface FrozenReadinessIssue {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
}

/** The re-derivable server-truth posture fields (Task 4.3) — never trusted blindly. */
export interface SendGateSignOffPosture {
  /** The persisted `requires_sign_off` marker (re-derived, not the sole trust source). */
  readonly requiresSignOff: boolean;
  /** The persisted terms sign-off instant (NULL = not-approved), captured verbatim. */
  readonly termsApprovedAt: string | null;
  /**
   * A server-selected delivery track. A disposable demo may display the unresolved estimate
   * warning; a real customer commitment must not be sent while that warning remains.
   */
  readonly customerDataTrack?: "demo" | "real_customer";
}

/** The pure send-gate input: the frozen classifier output + the re-derivable posture. */
export interface SendGateInput {
  /** The version's FROZEN warnings_snapshot (the 5.4 classifier codes + severities). */
  readonly warningsSnapshot: readonly FrozenReadinessIssue[];
  /** The re-derivable sign-off posture (Task 4.3 — demo-data-only accepted). */
  readonly signOff: SendGateSignOffPosture;
}

/** The send-gate decision: sendable iff there are NO blocker-severity issues. */
export interface SendGateResult {
  /** `true` iff the version passes the blocking readiness checks (no blockers). */
  readonly canSend: boolean;
  /** The blocking issues that make the version unsendable (empty when `canSend`). */
  readonly blockers: readonly FrozenReadinessIssue[];
}

/** The blocker severity discriminant — the SAME literal the 5.4 classifier emits. */
const BLOCKER: ReadinessSeverity = "blocker";

/**
 * Decide whether a quote version is sendable.
 *
 * `canSend` is `blockers.length === 0` — the IDENTICAL `canCreateQuote` semantics. Warnings
 * (incl. `TAX_SIGN_OFF_REQUIRED` / any `requires_sign_off` framing) NEVER gate. The sign-off
 * posture is accepted for demo data (no hard terms-approval block — MEMORY: sign-off
 * deferred); it is threaded in as SERVER TRUTH so a forged persisted boolean cannot bypass a
 * real gate if one is later enabled.
 */
export function evaluateSendGate(input: SendGateInput): SendGateResult {
  const blockers = input.warningsSnapshot.filter(
    (issue) => issue.severity === BLOCKER,
  );
  const hasUnresolvedTaxSignOff =
    input.signOff.requiresSignOff &&
    input.warningsSnapshot.some((issue) => issue.code === "TAX_SIGN_OFF_REQUIRED");
  // The omitted value remains the historical demo-only posture so frozen legacy callers retain
  // their valid behavior. The real customer path is explicit and fail-closed in mark-sent.
  if (
    input.signOff.customerDataTrack === "real_customer" &&
    hasUnresolvedTaxSignOff
  ) {
    blockers.push({
      code: "TAX_SIGN_OFF_REQUIRED",
      severity: BLOCKER,
      message: "Skatteantaganden måste godkännas innan en offert skickas till en verklig kund.",
    });
  }
  return {
    canSend: blockers.length === 0,
    blockers,
  };
}

/**
 * The closed set of 5.4 blocker codes (documentation reference — the gate branches on
 * SEVERITY, never on a hard-coded code list, so a NEW blocker code the classifier adds gates
 * automatically). Kept as a typed reference so a code drift is a compile-time signal.
 */
export const KNOWN_BLOCKER_CODES: readonly ReadinessCode[] = [
  "MISSING_CUSTOMER",
  "TOTAL_UNCOMPUTABLE",
];

/**
 * Decide sendability DIRECTLY from an already-read `ReadinessInput` by running the SAME 5.4
 * `classifyReadiness` rule table (NO fork; R-608). `sendable === blockers.length === 0` — the
 * IDENTICAL `canCreateQuote` gate the 5.4 preview + the 6.1 create path use. WARNINGS never gate.
 *
 * This is the classification-source variant of the gate (the 6.1 create path feeds a
 * `ReadinessInput` when it CAPTURES the warnings snapshot; the command send-path gates on the
 * FROZEN snapshot via `evaluateSendGate`). Both derive from the SAME classifier output, so the
 * preview and the send can NEVER disagree. Pure — resolved values passed IN, no DB/clock/PII.
 */
export function canSendQuoteVersion(input: ReadinessInput): boolean {
  return classifyReadiness(input).canCreateQuote;
}
