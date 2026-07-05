/**
 * Story 8.1 — PURE storage path + lifecycle helpers (AC4/AC5/AC6, P0 — 8.1-UNIT-01/02).
 *
 * Pins the load-bearing storage-path DERIVATION + lifecycle-access-eligibility
 * contract WITHOUT a DB, a browser, or the Supabase Storage service — the fast
 * `node --test` gate protecting the two decisions the coverage-shape lesson says
 * MUST live in pure `.ts` (never buried in a `.tsx`):
 *
 *   deriveObjectPath({ tenantId, fileId, displayName }) →
 *     - the FIRST path segment is ALWAYS the resolved tenantId (the tenant-first
 *       invariant — the segment `storage.objects` RLS keys on);
 *     - the display-name segment is SANITIZED: no `/`, no `..`, no control chars,
 *       so no path-traversal escapes the tenant prefix (`{tenantId}/{fileId}/…`);
 *     - the tenantId is used VERBATIM (it comes only from ctx.tenantContext, never
 *       client input) — the helper never re-derives or trusts a client path.
 *
 *   isAccessEligibleLifecycle(state) →
 *     - `draft`/`linked`/`locked` are access-eligible (a signed URL may be issued);
 *     - `archived`/`deleted` are NOT — the signing funnel rejects them (AC5 gate)
 *       BEFORE any createSignedUrl call.
 *
 * Pure logic, no I/O — runs under the dependency-free `node --test` runner
 * (`pnpm run test:unit`), the fast gate protecting path-derivation on every PR.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveObjectPath,
  sanitizeNameSegment,
} from "@/server/storage/object-path";
import { isAccessEligibleLifecycle } from "@/server/storage/lifecycle";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const FILE_ID = "22222222-2222-2222-2222-222222222222";

test("[P0/AC4] deriveObjectPath uses the resolved tenantId as the FIRST path segment", () => {
  const path = deriveObjectPath({
    tenantId: TENANT_ID,
    fileId: FILE_ID,
    displayName: "Quote.pdf",
  });
  // The tenant-first invariant `storage.objects` RLS keys on.
  assert.equal(path.split("/")[0], TENANT_ID);
  // The file id is the second segment.
  assert.equal(path.split("/")[1], FILE_ID);
});

test("[P0/AC4] deriveObjectPath strips path-traversal from the display-name segment", () => {
  // A malicious display name must NOT let the object escape the tenant prefix.
  const path = deriveObjectPath({
    tenantId: TENANT_ID,
    fileId: FILE_ID,
    displayName: "../../etc/passwd",
  });
  // Still tenant-first, and no traversal token survives anywhere in the path.
  assert.equal(path.split("/")[0], TENANT_ID);
  assert.ok(!path.includes(".."), `traversal token leaked: ${path}`);
  // The sanitized name segment carries no additional `/` beyond the fixed structure.
  assert.ok(
    path.split("/").length <= 3,
    `unexpected extra path segments (traversal): ${path}`,
  );
});

test("[P0/AC4] deriveObjectPath strips control chars and embedded slashes from the name", () => {
  const path = deriveObjectPath({
    tenantId: TENANT_ID,
    fileId: FILE_ID,
    displayName: "a/b c\n.pdf",
  });
  assert.equal(path.split("/")[0], TENANT_ID);
  assert.equal(path.split("/")[1], FILE_ID);
  // No raw control character (e.g. the embedded newline) survives sanitization.
  const hasControlChar = [...path].some((ch) => ch.charCodeAt(0) < 0x20);
  assert.ok(!hasControlChar, `control char leaked: ${path}`);
  assert.ok(path.split("/").length <= 3, `embedded slash not sanitized: ${path}`);
});

test("[P0/AC4] deriveObjectPath uses the tenantId VERBATIM (never a client-controlled value)", () => {
  // The helper takes the tenantId as-given (the caller passes ctx.tenantContext.tenantId).
  // It must not mutate/normalize the uuid such that the RLS-keyed first segment changes.
  const path = deriveObjectPath({
    tenantId: TENANT_ID,
    fileId: FILE_ID,
    displayName: "doc.pdf",
  });
  assert.ok(
    path.startsWith(`${TENANT_ID}/`),
    `path must start with the verbatim tenant id: ${path}`,
  );
});

test("[P0/AC4] deriveObjectPath never yields an empty name segment (fully-sanitized name)", () => {
  // A name that sanitizes entirely away (only dots/slashes) still yields a stable third
  // segment so the object has a valid three-segment path.
  const path = deriveObjectPath({
    tenantId: TENANT_ID,
    fileId: FILE_ID,
    displayName: "../..",
  });
  const segments = path.split("/");
  assert.equal(segments.length, 3);
  assert.ok(segments[2] && segments[2].length > 0, `empty name segment: ${path}`);
  assert.ok(!path.includes(".."), `traversal token leaked: ${path}`);
});

test("[P0/AC4] sanitizeNameSegment does not leave a lone surrogate when a >128-unit name is sliced mid-pair", () => {
  // A display name longer than the 128-code-unit bound that ends in an emoji (a UTF-16
  // surrogate PAIR) must not be sliced mid-pair, leaving a lone (unpaired) high surrogate
  // — an invalid code unit that yields a broken storage key. Build a name whose 128th
  // code unit is a high surrogate: 127 filler chars + one emoji (2 code units).
  const emoji = "\u{1F600}"; // 😀 — one code point, two UTF-16 code units
  const name = "a".repeat(127) + emoji + "tail";
  const seg = sanitizeNameSegment(name);
  // No lone high surrogate at the end.
  const lastUnit = seg.charCodeAt(seg.length - 1);
  assert.ok(
    !(lastUnit >= 0xd800 && lastUnit <= 0xdbff),
    `segment ends in a lone high surrogate: ${JSON.stringify(seg)}`,
  );
  // The segment is a well-formed string (no undefined/replacement artifacts from a split
  // pair): re-encoding round-trips.
  assert.equal(seg, seg.normalize("NFC"));
});

test("[P0/AC4] sanitizeNameSegment NFC-normalizes so composed/decomposed names map to ONE segment", () => {
  // "é" composed (U+00E9) vs decomposed ("e" + U+0301 combining acute) are visually
  // identical — NFC normalization maps both to the SAME object-path segment.
  // Explicit escapes so the two literals are GENUINELY different code-unit sequences.
  const composed = "café.pdf"; // e-acute precomposed U+00E9
  const decomposed = "café.pdf"; // e + combining acute U+0301
  assert.notEqual(composed, decomposed);
  assert.equal(sanitizeNameSegment(composed), sanitizeNameSegment(decomposed));
});

test("[P0/AC5] isAccessEligibleLifecycle admits draft/linked/locked", () => {
  for (const state of ["draft", "linked", "locked"] as const) {
    assert.equal(
      isAccessEligibleLifecycle(state),
      true,
      `${state} must be access-eligible`,
    );
  }
});

test("[P0/AC5] isAccessEligibleLifecycle REJECTS archived/deleted (the signing gate)", () => {
  for (const state of ["archived", "deleted"] as const) {
    assert.equal(
      isAccessEligibleLifecycle(state),
      false,
      `${state} must NOT be access-eligible — signing must be refused before createSignedUrl`,
    );
  }
});

test("[P0/AC5] isAccessEligibleLifecycle fail-closes on an unknown state", () => {
  assert.equal(isAccessEligibleLifecycle("bogus" as never), false);
});
