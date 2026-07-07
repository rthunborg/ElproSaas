/**
 * Story 8.2 — ATDD RED-PHASE scaffold: the PURE four-error-state classifier unit pins
 * (AC3, P0/P1 — 8.2-UNIT-02, R-809/R-811).
 *
 * The FOUR distinct user-safe error states (blocked-type / too-large / network-or-server /
 * permission) are a PURE `.ts` decision (Task 1.2), NOT logic inside a `.tsx` (the
 * coverage-shape lesson — R-811). It maps a typed command `Result` code + the client-side
 * pre-check outcome to exactly ONE of `BLOCKED_TYPE` / `TOO_LARGE` / `NETWORK_OR_SERVER` /
 * `PERMISSION`.
 *
 * CRITICAL security branch (R-809): a `TENANT_ACCESS_DENIED` / `FILE_ACCESS_DENIED`
 * (cross-tenant or foreign-owner or genuinely-not-found) MUST resolve to the GENERIC
 * `PERMISSION` state — it can NEVER be split into a "not found" vs "forbidden" signal that
 * would reveal whether another tenant's file/owner exists. `VALIDATION_FAILED` is
 * disambiguated into BLOCKED_TYPE vs TOO_LARGE using the pre-check outcome (the raw value
 * is never echoed — the classifier reads a discriminant, not the file). `SERVER_ERROR` is
 * the retryable NETWORK_OR_SERVER state.
 *
 * Coverage (mapped to the epic test design + story Task 1.2 / Task 7.1):
 *   - 8.2-UNIT-02a (P0): VALIDATION_FAILED + pre-check `blocked-type` → BLOCKED_TYPE.
 *   - 8.2-UNIT-02b (P0): VALIDATION_FAILED + pre-check `too-large` → TOO_LARGE.
 *   - 8.2-UNIT-02c (P0/R-809): TENANT_ACCESS_DENIED → generic PERMISSION (no existence leak).
 *   - 8.2-UNIT-02d (P0/R-809): FILE_ACCESS_DENIED → generic PERMISSION.
 *   - 8.2-UNIT-02e (P1): SERVER_ERROR → NETWORK_OR_SERVER (retryable).
 *   - 8.2-UNIT-02f (P0): every branch is covered — no code path yields an unknown state.
 *
 * ── RED until Story 8.2 dev lands the classifier (Task 1.2) ──────────────────────────
 * Imports the not-yet-created pure classifier. The exact export name/shape is a Task-1.2
 * decision; this scaffold assumes a `classifyUploadError({ code, precheck })` returning a
 * `UploadErrorState` string-union. If dev names it differently, update the import here — the
 * BRANCH TABLE (the intended contract) does not change.
 *
 * Runs under `node --test` (pure, no DB, no PII).
 *
 * [Source: story 8.2 Task 1.2 / Task 7.1; test-design-epic-8.md §P0 (R-809 no-existence-
 *  disclosure), §Coverage-shape lesson (R-811); epics.md 8.2 AC3]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyUploadError,
  type UploadErrorState,
  type UploadPrecheck,
} from "@/server/storage/upload-error-classifier";

const ALL_STATES: readonly UploadErrorState[] = [
  "BLOCKED_TYPE",
  "TOO_LARGE",
  "NETWORK_OR_SERVER",
  "PERMISSION",
];

test("[8.2-UNIT-02a][P0/AC3] VALIDATION_FAILED + blocked-type pre-check → BLOCKED_TYPE", () => {
  const state = classifyUploadError({
    code: "VALIDATION_FAILED",
    precheck: "blocked-type" satisfies UploadPrecheck,
  });
  assert.equal(state, "BLOCKED_TYPE");
});

test("[8.2-UNIT-02b][P0/AC3] VALIDATION_FAILED + too-large pre-check → TOO_LARGE", () => {
  const state = classifyUploadError({
    code: "VALIDATION_FAILED",
    precheck: "too-large" satisfies UploadPrecheck,
  });
  assert.equal(state, "TOO_LARGE");
});

test("[8.2-UNIT-02c][P0/R-809] TENANT_ACCESS_DENIED → generic PERMISSION (no existence leak)", () => {
  // Cross-tenant / foreign-owner / genuinely-not-found ALL arrive as TENANT_ACCESS_DENIED
  // and MUST collapse to the SAME generic PERMISSION state — the UI can never tell a
  // foreign-existing file from a non-existent one.
  const state = classifyUploadError({ code: "TENANT_ACCESS_DENIED", precheck: "none" });
  assert.equal(state, "PERMISSION");
});

test("[8.2-UNIT-02d][P0/R-809] FILE_ACCESS_DENIED → generic PERMISSION", () => {
  const state = classifyUploadError({ code: "FILE_ACCESS_DENIED", precheck: "none" });
  assert.equal(state, "PERMISSION");
});

test("[8.2-UNIT-02e][P1] SERVER_ERROR → NETWORK_OR_SERVER (retryable, not a denial)", () => {
  // A transient infra/storage fault is retryable — it must NEVER be conflated with a
  // permanent PERMISSION denial (mirrors the signed-access transient-vs-permanent discipline).
  const state = classifyUploadError({ code: "SERVER_ERROR", precheck: "none" });
  assert.equal(state, "NETWORK_OR_SERVER");
});

test("[8.2-UNIT-02f][P0] every classified state is one of the FOUR distinct user-safe states", () => {
  const cases: { code: string; precheck: UploadPrecheck }[] = [
    { code: "VALIDATION_FAILED", precheck: "blocked-type" },
    { code: "VALIDATION_FAILED", precheck: "too-large" },
    { code: "TENANT_ACCESS_DENIED", precheck: "none" },
    { code: "FILE_ACCESS_DENIED", precheck: "none" },
    { code: "SERVER_ERROR", precheck: "none" },
  ];
  for (const c of cases) {
    const state = classifyUploadError({ code: c.code as never, precheck: c.precheck });
    assert.ok(
      ALL_STATES.includes(state),
      `code=${c.code} precheck=${c.precheck} produced an unknown state: ${state}`,
    );
  }
});

test("[8.2-UNIT-02f][P0/R-809] an unknown/unexpected code degrades to a SAFE state, never a leak", () => {
  // Defense-in-depth: an unmapped code must not throw and must not fall through to a
  // more-informative state. NETWORK_OR_SERVER (generic retryable) or PERMISSION (generic
  // denial) are both safe; a BLOCKED_TYPE/TOO_LARGE for an unknown code would over-disclose.
  const state = classifyUploadError({ code: "SOME_UNMAPPED_CODE" as never, precheck: "none" });
  assert.ok(
    state === "NETWORK_OR_SERVER" || state === "PERMISSION",
    `unknown code must degrade to a generic safe state, got: ${state}`,
  );
});
