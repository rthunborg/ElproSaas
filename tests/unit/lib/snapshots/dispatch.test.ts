/**
 * Story 3.5 — the `buildSnapshotSource(kind, row, opts)` DISPATCHER (Task 2.3).
 *
 * The dispatcher switches on the closed `kind` union and delegates to the matching
 * per-kind builder; its `default:` arm calls the `assertNever` exhaustiveness guard so a
 * FUTURE kind added without a builder branch is a COMPILE error (fail-loud). This suite
 * pins both halves of that contract behaviorally:
 *   - each in-contract `kind` routes to the RIGHT builder (output deep-equals the direct
 *     per-kind builder call, and is frozen);
 *   - an UNKNOWN `kind` (a value outside the union, forced past the type system) hits
 *     `assertNever` and THROWS at runtime — proving the guard is a real runtime backstop,
 *     not only a type-level one.
 *
 * Runner: `node --test` with TS strip-types (`pnpm test:unit`) — pure, NO DB.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildSnapshotSource,
  buildWorkRoleSnapshot,
  buildArticleSnapshot,
  buildCompanySettingsSnapshot,
  buildQuoteTermsSnapshot,
  type WorkRoleSourceRow,
  type ArticleSourceRow,
  type CompanySettingsSourceRow,
  type QuoteTermsSourceRow,
} from "@/lib/snapshots/build";
import type { SnapshotKind } from "@/lib/snapshots/types";

const CAPTURED_AT = "2026-06-30T12:00:00.000Z";
const SOURCE_UPDATED_AT = "2026-06-29T08:30:00.000Z";

const workRoleRow: WorkRoleSourceRow = {
  id: "wr-1",
  tenant_id: "tenant-A",
  display_name: "Elektriker",
  cost_rate_ore: 30000,
  sell_rate_ore: 60000,
  is_active: true,
  updated_at: SOURCE_UPDATED_AT,
};
const articleRow: ArticleSourceRow = {
  id: "art-1",
  tenant_id: "tenant-A",
  name: "Kabel 3x1.5",
  sku: "EKK",
  unit: "m",
  unit_price_ore: 1995,
  is_active: true,
  updated_at: SOURCE_UPDATED_AT,
};
const companySettingsRow: CompanySettingsSourceRow = {
  id: "cs-1",
  tenant_id: "tenant-A",
  company_name: "Acme El AB",
  vat_rate_bp: 2500,
  default_vat_display: "company_togglable",
  updated_at: SOURCE_UPDATED_AT,
};
const quoteTermsRow: QuoteTermsSourceRow = {
  id: "qt-1",
  tenant_id: "tenant-A",
  terms_text: "Villkor (platshållartext).",
  approved_at: null,
  approved_by: null,
  updated_at: SOURCE_UPDATED_AT,
};

describe("Story 3.5 — buildSnapshotSource dispatcher routes each kind to the right builder (AC1)", () => {
  test("[P0] work_role routes to buildWorkRoleSnapshot", () => {
    const viaDispatch = buildSnapshotSource("work_role", workRoleRow, { capturedAt: CAPTURED_AT });
    const direct = buildWorkRoleSnapshot(workRoleRow, { capturedAt: CAPTURED_AT });
    assert.equal(viaDispatch.kind, "work_role");
    assert.deepEqual({ ...viaDispatch }, { ...direct });
    assert.equal(Object.isFrozen(viaDispatch), true);
  });

  test("[P0] article routes to buildArticleSnapshot", () => {
    const viaDispatch = buildSnapshotSource("article", articleRow, { capturedAt: CAPTURED_AT });
    const direct = buildArticleSnapshot(articleRow, { capturedAt: CAPTURED_AT });
    assert.equal(viaDispatch.kind, "article");
    assert.deepEqual({ ...viaDispatch }, { ...direct });
    assert.equal(Object.isFrozen(viaDispatch), true);
  });

  test("[P0] company_settings routes to buildCompanySettingsSnapshot", () => {
    const viaDispatch = buildSnapshotSource("company_settings", companySettingsRow, { capturedAt: CAPTURED_AT });
    const direct = buildCompanySettingsSnapshot(companySettingsRow, { capturedAt: CAPTURED_AT });
    assert.equal(viaDispatch.kind, "company_settings");
    assert.deepEqual({ ...viaDispatch }, { ...direct });
    assert.equal(Object.isFrozen(viaDispatch), true);
  });

  test("[P0] quote_terms routes to buildQuoteTermsSnapshot", () => {
    const viaDispatch = buildSnapshotSource("quote_terms", quoteTermsRow, { capturedAt: CAPTURED_AT });
    const direct = buildQuoteTermsSnapshot(quoteTermsRow, { capturedAt: CAPTURED_AT });
    assert.equal(viaDispatch.kind, "quote_terms");
    assert.deepEqual({ ...viaDispatch }, { ...direct });
    assert.equal(Object.isFrozen(viaDispatch), true);
  });

  test("[P0] an UNKNOWN kind hits assertNever and THROWS (fail-loud runtime backstop)", () => {
    // Force a value outside the closed union past the type system to prove the
    // `default:` arm's assertNever throws at RUNTIME — not just at compile time.
    const bogusKind = "future_source" as unknown as SnapshotKind;
    assert.throws(
      () =>
        buildSnapshotSource(
          bogusKind,
          workRoleRow as never,
          { capturedAt: CAPTURED_AT },
        ),
      /no builder branch for snapshot kind/i,
    );
  });
});
