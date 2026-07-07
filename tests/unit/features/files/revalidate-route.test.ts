/**
 * Story 8.5 — epic-8 review finding (client-supplied `revalidate_path`): the file upload/archive
 * actions must derive the route to revalidate ENTIRELY SERVER-SIDE from the resolved owner_type/
 * owner_id + structured parent ids, via a CLOSED template allow-list — and IGNORE any client-
 * supplied path. These UNIT pins prove `resolveRevalidateRoute` / `ownerRoute`:
 *   - every owner type maps to its correct server-owned route template;
 *   - a nested owner (facility/contact/quote_*) uses the STRUCTURED parent ids, not the owner id;
 *   - a crafted client value (a path like `/`, `../evil`, or a non-UUID) can NEVER become the
 *     revalidated route — it yields `null` (no revalidation), never a smuggled arbitrary route.
 *
 * [Source: src/features/files/revalidate-route.ts; src/features/files/actions.ts (uploadFileAction /
 *  archiveFileAction revalidation); epic-8-review-findings.md [Review][Decision][Med]]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ownerRoute,
  resolveRevalidateRoute,
} from "@/features/files/revalidate-route";

const CUSTOMER = "11111111-1111-1111-1111-111111111111";
const CALC = "22222222-2222-2222-2222-222222222222";
const JOB = "33333333-3333-3333-3333-333333333333";
const QUOTE = "44444444-4444-4444-4444-444444444444";
const VERSION = "55555555-5555-5555-5555-555555555555";
const FACILITY = "66666666-6666-6666-6666-666666666666";

/** No structured parent ids present (customer/calculation/job cases). */
const NO_PARENTS = {
  parentCustomerId: null,
  parentQuoteId: null,
  parentVersionId: null,
} as const;

test("[8-review][ownerRoute] each kind maps to its server-owned template (UUID-gated)", () => {
  assert.equal(ownerRoute({ kind: "customer", customerId: CUSTOMER }), `/customers/${CUSTOMER}`);
  assert.equal(ownerRoute({ kind: "calculation", calculationId: CALC }), `/calculations/${CALC}`);
  assert.equal(ownerRoute({ kind: "job", jobId: JOB }), `/jobs/${JOB}`);
  assert.equal(
    ownerRoute({ kind: "quote_version_subroute", quoteId: QUOTE, versionId: VERSION }),
    `/quotes/${QUOTE}/versions/${VERSION}`,
  );
});

test("[8-review][ownerRoute] a NON-UUID id can never enter a template → null", () => {
  // A crafted client value (a path/route) as an id is rejected — no arbitrary route is built.
  assert.equal(ownerRoute({ kind: "customer", customerId: "/" }), null);
  assert.equal(ownerRoute({ kind: "customer", customerId: "../../etc/passwd" }), null);
  assert.equal(ownerRoute({ kind: "calculation", calculationId: "not-a-uuid" }), null);
  assert.equal(ownerRoute({ kind: "job", jobId: "" }), null);
  // A partial quote subroute (one non-UUID segment) fails closed.
  assert.equal(
    ownerRoute({ kind: "quote_version_subroute", quoteId: QUOTE, versionId: "/" }),
    null,
  );
});

test("[8-review][resolve] customer/calculation/job derive from owner_id directly", () => {
  assert.equal(
    resolveRevalidateRoute({ ownerType: "customer", ownerId: CUSTOMER, ...NO_PARENTS }),
    `/customers/${CUSTOMER}`,
  );
  assert.equal(
    resolveRevalidateRoute({ ownerType: "calculation", ownerId: CALC, ...NO_PARENTS }),
    `/calculations/${CALC}`,
  );
  assert.equal(
    resolveRevalidateRoute({ ownerType: "job", ownerId: JOB, ...NO_PARENTS }),
    `/jobs/${JOB}`,
  );
});

test("[8-review][resolve] facility/contact revalidate the PARENT customer route (not the owner id)", () => {
  // The owner id is the facility/contact id — the route must be the parent customer hub.
  const route = resolveRevalidateRoute({
    ownerType: "facility",
    ownerId: FACILITY,
    parentCustomerId: CUSTOMER,
    parentQuoteId: null,
    parentVersionId: null,
  });
  assert.equal(route, `/customers/${CUSTOMER}`);
  assert.ok(!route!.includes(FACILITY), "facility owner id must never appear in the route");

  assert.equal(
    resolveRevalidateRoute({
      ownerType: "contact",
      ownerId: "77777777-7777-7777-7777-777777777777",
      parentCustomerId: CUSTOMER,
      parentQuoteId: null,
      parentVersionId: null,
    }),
    `/customers/${CUSTOMER}`,
  );
});

test("[8-review][resolve] quote_acceptance/quote_version revalidate the version subroute", () => {
  assert.equal(
    resolveRevalidateRoute({
      ownerType: "quote_acceptance",
      ownerId: "88888888-8888-8888-8888-888888888888",
      parentCustomerId: null,
      parentQuoteId: QUOTE,
      parentVersionId: VERSION,
    }),
    `/quotes/${QUOTE}/versions/${VERSION}`,
  );
  assert.equal(
    resolveRevalidateRoute({
      ownerType: "quote_version",
      ownerId: VERSION,
      parentCustomerId: null,
      parentQuoteId: QUOTE,
      parentVersionId: VERSION,
    }),
    `/quotes/${QUOTE}/versions/${VERSION}`,
  );
});

test("[8-review][resolve] an unknown owner type → null (no revalidation)", () => {
  assert.equal(
    resolveRevalidateRoute({ ownerType: "evil", ownerId: CUSTOMER, ...NO_PARENTS }),
    null,
  );
  assert.equal(
    resolveRevalidateRoute({ ownerType: null, ownerId: CUSTOMER, ...NO_PARENTS }),
    null,
  );
});

test("[8-review][resolve] a nested owner MISSING its parent ids → null (never falls back to owner id)", () => {
  // Without a parent customer id there is no legitimate route — the facility owner id is NOT a
  // customer route, so we must NOT revalidate anything (never `/facilities/{id}` or `/`).
  assert.equal(
    resolveRevalidateRoute({ ownerType: "facility", ownerId: FACILITY, ...NO_PARENTS }),
    null,
  );
  assert.equal(
    resolveRevalidateRoute({
      ownerType: "quote_acceptance",
      ownerId: "88888888-8888-8888-8888-888888888888",
      ...NO_PARENTS,
    }),
    null,
  );
});

test("[8-review][resolve] a crafted parent value (a path, not a UUID) is rejected → null", () => {
  // The DECISION: a crafted client path has NO effect. Even routed through the structured parent
  // field, a non-UUID (e.g. an injected `/` or traversal path) can never become the route.
  assert.equal(
    resolveRevalidateRoute({
      ownerType: "facility",
      ownerId: FACILITY,
      parentCustomerId: "/",
      parentQuoteId: null,
      parentVersionId: null,
    }),
    null,
  );
  assert.equal(
    resolveRevalidateRoute({
      ownerType: "quote_version",
      ownerId: VERSION,
      parentCustomerId: null,
      parentQuoteId: "../../admin",
      parentVersionId: VERSION,
    }),
    null,
  );
});
