/**
 * Story 3.5 — ATDD RED-PHASE scaffold: snapshot-source OWNERSHIP acceptance (AC3,
 * P0). Proves cross-tenant use of a source id is rejected by BOTH layers — the
 * command-layer RLS-client resolver (`TENANT_ACCESS_DENIED` on zero rows) AND the
 * existing own-tenant `is_tenant_admin` RLS policies (zero rows under a direct
 * RLS-client SELECT) — across ALL FOUR Phase-A sources (work_roles, articles,
 * company_settings, quote_terms). Reuses the EXISTING two-tenant factories + admin
 * seed helpers; NO new auth/error mechanism, NO new H4 enrollment (the four tables
 * are already enrolled by 3-3/3-4 — VERIFIED in tenant-table-inventory.ts).
 *
 * ── GREEN PHASE (Story 3.5 dev) ─────────────────────────────────────────────────
 * The resolver (`src/server/snapshots/resolve-source.ts`) now exists (Task 3), so this
 * suite imports it directly and the `.skip` gate is removed. The resolver signature:
 *   resolveSnapshotSource({ client, kind, sourceId }) =>
 *     Promise<Result<SourceRow, CommandErrorCode>>   // err code TENANT_ACCESS_DENIED on a foreign/absent id
 * The assertions are the CONTRACT — they are not weakened.
 *
 * Every assertion encodes EXPECTED behavior. Runs against the LOCAL Supabase stack only;
 * skips visibly when unreachable. Per-run unique ids (the factory) + deterministic —
 * never `sleep`.
 *
 * The LOAD-BEARING contract (AC3, BOTH layers):
 *   - own-tenant id  → resolver SUCCEEDS, yields a buildable row whose tenant_id is
 *     the RESOLVED (caller's) tenant — never a client-supplied tenant_id.
 *   - Tenant-B id    → resolver returns TENANT_ACCESS_DENIED (command layer), no
 *     snapshot built, no leaked existence signal.
 *   - Tenant-B id    → an INDEPENDENT direct RLS-client SELECT of the B id returns
 *     ZERO rows (the RLS layer) — proven against a CONCRETE seeded Tenant-B row.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertWorkRole,
  adminInsertArticle,
  adminInsertCompanySettings,
  adminInsertQuoteTerms,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  resolveSnapshotSource,
  type SnapshotSourceDbClient,
} from "@/server/snapshots/resolve-source";
import type { SnapshotKind } from "@/lib/snapshots/types";

// The RLS-scoped test anon-key client (a full SupabaseClient) satisfies the resolver's
// minimal `.from(...).select(...).eq(...).limit(...)` surface structurally. Assert once
// here so the call sites read cleanly without a per-call cast.
function asResolverClient(client: TestServerClient): SnapshotSourceDbClient {
  return client as unknown as SnapshotSourceDbClient;
}

// The RLS-client read column-by-table for the INDEPENDENT RLS-half assertion. `kind`
// is a closed union (never client input), so the table name is safe.
const TABLE_FOR: Record<SnapshotKind, "work_roles" | "articles" | "company_settings" | "quote_terms"> = {
  work_role: "work_roles",
  article: "articles",
  company_settings: "company_settings",
  quote_terms: "quote_terms",
};

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key (RLS) client

// Seeded Tenant A ids (own-tenant — resolver should SUCCEED).
const aId: Partial<Record<SnapshotKind, string>> = {};
// Seeded Tenant B ids (cross-tenant — resolver should DENY; RLS sees zero rows).
const bId: Partial<Record<SnapshotKind, string>> = {};

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);

  // Seed a CONCRETE row per source for BOTH tenants via the BYPASSRLS factories.
  aId.work_role = await adminInsertWorkRole({ tenant_id: fixture.tenantA.id, display_name: "a-role-seed" });
  aId.article = await adminInsertArticle({ tenant_id: fixture.tenantA.id, name: "a-article-seed" });
  aId.company_settings = await adminInsertCompanySettings({ tenant_id: fixture.tenantA.id, company_name: "a-company-seed" });
  aId.quote_terms = await adminInsertQuoteTerms({ tenant_id: fixture.tenantA.id, terms_text: "a-terms-seed (platshållartext)" });

  bId.work_role = await adminInsertWorkRole({ tenant_id: fixture.tenantB.id, display_name: "b-role-seed" });
  bId.article = await adminInsertArticle({ tenant_id: fixture.tenantB.id, name: "b-article-seed" });
  bId.company_settings = await adminInsertCompanySettings({ tenant_id: fixture.tenantB.id, company_name: "b-company-seed" });
  bId.quote_terms = await adminInsertQuoteTerms({ tenant_id: fixture.tenantB.id, terms_text: "b-terms-seed (platshållartext)" });

  // VACUITY GUARD: a missing seed id would make the cross-tenant negatives target a
  // non-existent row and pass VACUOUSLY. Fail loudly BEFORE any denial assertion.
  for (const kind of Object.keys(TABLE_FOR) as SnapshotKind[]) {
    if (!aId[kind] || !bId[kind]) {
      throw new Error(`snapshot-source seed produced no id for ${kind} — cross-tenant negatives would pass vacuously`);
    }
  }
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Story 3.5 — snapshot-source ownership: BOTH layers reject a foreign id (AC3)", () => {
  for (const kind of Object.keys(TABLE_FOR) as SnapshotKind[]) {
    describe(`source kind: ${kind}`, () => {
      it(`[P0] own-tenant id RESOLVES and yields a row owned by the RESOLVED tenant`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const result = await resolveSnapshotSource({
          client: asResolverClient(a),
          kind,
          sourceId: aId[kind]!,
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.id).toBe(aId[kind]);
          // The snapshot's tenant is whatever the RESOLVED row carries — under
          // own-tenant RLS that is ALWAYS the caller's tenant, never a client value.
          expect(result.data.tenant_id).toBe(fixture.tenantA.id);
        }
      });

      it(`[P0] command layer: a Tenant-B id → TENANT_ACCESS_DENIED (no row, no leak)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const result = await resolveSnapshotSource({
          client: asResolverClient(a),
          kind,
          sourceId: bId[kind]!,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("TENANT_ACCESS_DENIED");
          // The generic message must not echo the id or leak existence.
          expect(result.message).not.toContain(bId[kind]!);
        }
      });

      it(`[P0] RLS layer: a direct RLS-client SELECT of the Tenant-B id returns ZERO rows`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        // INDEPENDENT proof of the RLS half — does not depend on the resolver. The
        // foreign row is invisible to Tenant A under the own-tenant SELECT policy.
        const { data, error } = await a.from(TABLE_FOR[kind]).select("id, tenant_id").eq("id", bId[kind]!);
        expect(error).toBeNull(); // RLS yields an empty set, NOT an error that confirms existence
        expect(data).toEqual([]);
      });

      it(`[P0] a non-existent id is denied the SAME way (no existence signal differs from a foreign id)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const ghostId = "00000000-0000-0000-0000-0000deadbeef";
        const result = await resolveSnapshotSource({
          client: asResolverClient(a),
          kind,
          sourceId: ghostId,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe("TENANT_ACCESS_DENIED");
      });
    });
  }
});
