/**
 * Story 8.3 — ATDD RED-PHASE scaffold: the PURE signed-access UI-state + refresh/expiry
 * decision module (AC1/AC2, P0/P1 — 8.3-UNIT-01, R-806/R-810).
 *
 * The per-file preview/download affordance's `useActionState` contract lives in a PURE `.ts`
 * module (`src/features/files/signed-access-state.ts`) so the fast `node --test` gate protects
 * the expiry/refresh DECISION (the coverage-shape lesson — NEVER bury it in a `.tsx`, or it
 * escapes the fast gate; test-design-epic-8.md names the "signed-access-refresh decision (8.3)"
 * as an explicit target for this pattern).
 *
 * This file pins the pure decisions:
 *   - `SIGNED_ACCESS_INITIAL`: the pristine, error-free starting shape (idle, no url/code/error);
 *   - the state shape maps a `success` (carries `signedUrl` + `expiresAt`, NO code/formError) vs
 *     an `error` (carries `code` + `formError`, NO url — R-809: no url ever rides an error);
 *   - `isSignedUrlExpired(expiresAt, nowIso)`: every branch — null expiry (treat as "must
 *     (re)authorize" → expired), past expiry, future expiry, EXACTLY-at-boundary (the instant of
 *     expiry is expired — a signed URL is valid strictly BEFORE its expiry);
 *   - `shouldReauthorize(state, nowIso)`: an idle/error state OR a success whose `expiresAt` has
 *     passed → true (offer the "open again" re-authorize control); a success whose url is still
 *     in-window → false (the current url is usable, do NOT re-sign).
 *
 * CRITICAL BOUNDARY (Task 1.3): the pure helper decides WHEN the client offers a re-open
 * affordance — it NEVER re-signs and NEVER caches/reuses a stale url. The lifecycle re-check
 * (archived/deleted → not re-signed) is the COMMAND's job on every call, NOT this helper's. So
 * these units assert the DECISION only; the reauthorization teeth (a lifecycle-changed file is
 * NOT re-signed on retry) are the INT suite's (file-signed-access-refresh.int.test.ts).
 *
 * Mirrors the signed-preview state family VERBATIM in shape (the THIRD instance): the job
 * evidence-preview state (`src/features/jobs/evidence-preview-state.ts`) + the quote-PDF preview.
 * Do NOT invent a new mechanism.
 *
 * Runs under `node --test` (pure, no DB, no PII).
 *
 * ── RED until Story 8.3 dev creates `src/features/files/signed-access-state.ts` (Task 1.1/1.2) ──
 * The import below resolves to a not-yet-existing module — the units fail at import
 * (ERR_MODULE_NOT_FOUND) / typecheck (no exported member) until Task 1 lands. That is the
 * intended red-phase signal.
 *
 * [Source: story 8.3 Task 1.1/1.2/1.3 + Task 5.1; src/features/jobs/evidence-preview-state.ts
 *  (the state family this mirrors); test-design-epic-8.md §"Coverage-shape lesson applies to the
 *  Wave-2 UI logic"; epics.md 8.3 AC1/AC2]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGNED_ACCESS_INITIAL,
  isSignedUrlExpired,
  shouldReauthorize,
  type SignedAccessState,
} from "@/features/files/signed-access-state";

const NOW = "2026-07-04T12:00:00.000Z";
const PAST = "2026-07-04T11:59:59.000Z"; // 1s before NOW
const FUTURE = "2026-07-04T12:05:00.000Z"; // 5min after NOW (the default 300s TTL window)

// ── SIGNED_ACCESS_INITIAL is the pristine starting shape ─────────────────────────────────
test("[8.3-UNIT-01a][P1] SIGNED_ACCESS_INITIAL is a pristine, idle, url-free starting shape", () => {
  assert.equal(SIGNED_ACCESS_INITIAL.status, "idle");
  assert.equal(SIGNED_ACCESS_INITIAL.code, null);
  assert.equal(SIGNED_ACCESS_INITIAL.formError, null);
  assert.equal(SIGNED_ACCESS_INITIAL.signedUrl, null);
  assert.equal(SIGNED_ACCESS_INITIAL.expiresAt, null);
});

// ── the state shape: success carries a url; error NEVER carries a url (R-809/R-810) ──────
test("[8.3-UNIT-01b][P1/R-810] a success state carries signedUrl + expiresAt (no code/formError)", () => {
  const success: SignedAccessState = {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://local/storage/v1/object/sign/tenant-files/…",
    expiresAt: FUTURE,
  };
  assert.equal(success.status, "success");
  assert.equal(typeof success.signedUrl, "string");
  assert.ok((success.signedUrl ?? "").length > 0);
  assert.equal(typeof success.expiresAt, "string");
  // A success never carries an error code / message.
  assert.equal(success.code, null);
  assert.equal(success.formError, null);
});

test("[8.3-UNIT-01c][P1/R-809] an error state carries code + formError and NEVER a signedUrl", () => {
  const error: SignedAccessState = {
    status: "error",
    code: "TENANT_ACCESS_DENIED",
    formError: "Filen kunde inte öppnas.",
    signedUrl: null,
    expiresAt: null,
  };
  assert.equal(error.status, "error");
  assert.equal(error.code, "TENANT_ACCESS_DENIED");
  assert.ok((error.formError ?? "").trim().length > 0);
  // metadata-first / no-leak: a failure carries NO url payload (mirror the 8.1 no-URL-on-failure).
  assert.equal(error.signedUrl, null);
});

// ── isSignedUrlExpired — every branch (null / past / future / exactly-at-boundary) ───────
test("[8.3-UNIT-01d][P0/R-806] isSignedUrlExpired: a null expiry is treated as expired (must (re)authorize)", () => {
  assert.equal(isSignedUrlExpired(null, NOW), true);
});

test("[8.3-UNIT-01e][P0/R-806] isSignedUrlExpired: a PAST expiry is expired", () => {
  assert.equal(isSignedUrlExpired(PAST, NOW), true);
});

test("[8.3-UNIT-01f][P0/R-806] isSignedUrlExpired: a FUTURE expiry is NOT expired", () => {
  assert.equal(isSignedUrlExpired(FUTURE, NOW), false);
});

test("[8.3-UNIT-01g][P0/R-806] isSignedUrlExpired: EXACTLY at the expiry instant is expired (valid strictly before)", () => {
  // A signed URL is valid strictly BEFORE its expiry — the boundary instant itself is expired.
  assert.equal(isSignedUrlExpired(NOW, NOW), true);
});

// ── shouldReauthorize — the client's "open again" affordance verdict ─────────────────────
test("[8.3-UNIT-01h][P1/AC2] shouldReauthorize: an idle state offers (re)authorize (no url yet)", () => {
  assert.equal(shouldReauthorize(SIGNED_ACCESS_INITIAL, NOW), true);
});

test("[8.3-UNIT-01i][P1/AC2] shouldReauthorize: a success with a still-valid url does NOT re-sign", () => {
  const fresh: SignedAccessState = {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://local/…",
    expiresAt: FUTURE,
  };
  assert.equal(shouldReauthorize(fresh, NOW), false);
});

test("[8.3-UNIT-01j][P1/AC2/R-806] shouldReauthorize: a success whose url EXPIRED offers re-authorize", () => {
  const stale: SignedAccessState = {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://local/…",
    expiresAt: PAST,
  };
  // The stale url is NOT reused — the affordance offers a re-open (re-invoke the command = a
  // FRESH full auth). The helper only says "offer it"; it never re-signs on its own (Task 1.3).
  assert.equal(shouldReauthorize(stale, NOW), true);
});

test("[8.3-UNIT-01k][P1/AC2] shouldReauthorize: an error state offers (re)authorize (retry)", () => {
  const error: SignedAccessState = {
    status: "error",
    code: "SERVER_ERROR",
    formError: "Något gick fel. Försök igen.",
    signedUrl: null,
    expiresAt: null,
  };
  assert.equal(shouldReauthorize(error, NOW), true);
});

// ── COVERAGE EXPANSION (bmad-testarch-automate, Story 8.3) ─────────────────────────────────
// The shipped `isSignedUrlExpired` has an explicit fail-toward-expired branch for UNPARSEABLE
// instants (`!Number.isFinite(...) ⇒ return true`) and a `shouldReauthorize` success-with-null-
// expiry path — both untested by the ATDD scaffold above. These pin the ROBUSTNESS boundary:
// a malformed/missing `expiresAt` must NEVER fail-OPEN (serving a possibly-stale URL) — the
// helper must fail toward "expired / re-authorize". A regression here would silently reuse a
// stale signed URL past its window (R-806/R-810), so these branches are load-bearing security
// behavior, not incidental defensiveness.

test("[8.3-UNIT-01l][P1/R-806] isSignedUrlExpired: an UNPARSEABLE expiresAt fails toward expired (never serve a stale URL)", () => {
  assert.equal(isSignedUrlExpired("not-a-date", NOW), true);
});

test("[8.3-UNIT-01m][P1/R-806] isSignedUrlExpired: an EMPTY-STRING expiresAt fails toward expired", () => {
  // Date.parse("") is NaN — a blank/missing expiry must be treated as expired, not fail-open.
  assert.equal(isSignedUrlExpired("", NOW), true);
});

test("[8.3-UNIT-01n][P1/R-806] isSignedUrlExpired: an UNPARSEABLE nowIso fails toward expired (defensive — no fail-open on a bad clock)", () => {
  assert.equal(isSignedUrlExpired(FUTURE, "not-a-date"), true);
});

test("[8.3-UNIT-01o][P1/AC2] shouldReauthorize: a SUCCESS state with a NULL expiresAt offers re-authorize (defensive — a success without an expiry is not a reusable window)", () => {
  const successNoExpiry: SignedAccessState = {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://local/…",
    expiresAt: null,
  };
  // Delegates to isSignedUrlExpired(null) ⇒ expired ⇒ offer re-authorize (do NOT reuse a URL
  // that carries no verifiable expiry window).
  assert.equal(shouldReauthorize(successNoExpiry, NOW), true);
});

test("[8.3-UNIT-01p][P1/AC2/R-806] shouldReauthorize: a SUCCESS state EXACTLY at the expiry boundary offers re-authorize (valid strictly before)", () => {
  const atBoundary: SignedAccessState = {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://local/…",
    expiresAt: NOW, // expiry == now ⇒ expired (mirrors the isSignedUrlExpired boundary rule)
  };
  assert.equal(shouldReauthorize(atBoundary, NOW), true);
});

test("[8.3-UNIT-01q][P1/AC2] shouldReauthorize: a SUCCESS with an UNPARSEABLE expiresAt offers re-authorize (fails toward re-sign, never reuses a malformed-window URL)", () => {
  const badExpiry: SignedAccessState = {
    status: "success",
    code: null,
    formError: null,
    signedUrl: "https://local/…",
    expiresAt: "garbage",
  };
  assert.equal(shouldReauthorize(badExpiry, NOW), true);
});
