/**
 * Story 2.4 — the SINGLE SOURCE OF TRUTH tenant-table inventory (Task 1.2).
 *
 * This module is the one place a tenant-owned table enrolls into the security
 * harness. The parameterized cross-tenant negative suite
 * (`cross-tenant-isolation.rls.test.ts`), the anonymous-path negative suite
 * (`anon-path-isolation.rls.test.ts`), AND the H4 RLS table-inventory gate
 * (`rls-inventory-gate.int.test.ts`) all import `TENANT_TABLES` and the per-table
 * metadata from HERE — so adding a future tenant-owned table is a ONE-PLACE edit
 * (data-driven, not a copy-pasted parallel suite). [architecture §18]
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ "TENANT-OWNED" — the gate's precise, stable definition (architecture §6/§7).  │
 * │                                                                              │
 * │ An APPLICATION base/partitioned table (any non-system schema) that is         │
 * │ tenant-scoped by ANY of these signals:                                        │
 * │   (a) carries a direct `tenant_id` column (the §6 Phase A convention), OR      │
 * │   (b) has a FOREIGN KEY whose target is `public.tenants` — REGARDLESS of the   │
 * │       FK column's NAME (so a future `org_id`/`company_id`-scoped table is      │
 * │       still caught, not silently invisible), OR                               │
 * │   (c) IS the literal `tenants` ROOT table — its PK `id` IS the tenant id, it  │
 * │       has NO `tenant_id` column, yet it IS tenant-owned and IS RLS-protected.  │
 * │ It is NOT a global enum/reference table nor an auth-/system-owned table.       │
 * │                                                                              │
 * │ FAIL-CLOSED detection (NOT naming-bound): the introspection introspects ACTUAL │
 * │ tenancy signals — the `tenant_id` column AND FK targets to `tenants` AND       │
 * │ partitioned parents AND non-`public` application schemas — so a future         │
 * │ tenant-owned table scoped by a differently-named FK, living in another         │
 * │ application schema, or implemented as a partitioned parent is STILL demanded   │
 * │ for enrollment. Only well-known SYSTEM schemas (pg_*, information_schema, auth, │
 * │ storage, realtime/_realtime, supabase_*, extensions, graphql*, vault, etc.)    │
 * │ are excluded; any OTHER schema is treated as application-owned (unknown =>      │
 * │ enroll). This is the exact silent-incompleteness the `tenants` edge case was   │
 * │ added to prevent, now generalised beyond the naming convention.                │
 * │                                                                              │
 * │ CRITICAL EDGE CASES:                                                          │
 * │  - a naive `WHERE column_name = 'tenant_id'` query DROPS `tenants` (no          │
 * │    tenant_id column); the introspection UNIONS the literal `tenants` root in.   │
 * │  - a PARTITIONED parent's children carry `tenant_id` while the parent may not;  │
 * │    the introspection enrolls the PARENT (relkind 'p') and EXCLUDES child        │
 * │    partitions (relispartition) so children never surface as spurious            │
 * │    "unenrolled".                                                              │
 * │  - an internal `_realtime.tenants` / `auth.*` exists too — the SYSTEM-schema    │
 * │    exclusion keeps them out (never `_realtime.tenants`).                        │
 * │                                                                              │
 * │ STANDING CONTRACT (Epics 3-9): a product PR that ADDS or TOUCHES a            │
 * │ tenant-owned table MUST enroll it in `TENANT_TABLES` below with BOTH metadata │
 * │ seams — the cross-tenant helpers (spoofedRowFor/tenantBFilter/                │
 * │ hijackMutationFor) AND the anon-path helpers (anonRowFor/anonFilterFor/       │
 * │ anonMutationFor) — BEFORE merge. The H4 gate fails CI with a                  │
 * │ named "table not covered" message when it does not — automated enforcement,   │
 * │ not reviewer diligence. See docs/quality/quality-gates.md (Gate 4).          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * EXPECTED current tenant-owned set (as of Story 6.1): the foundation tables
 * (tenants, tenant_memberships, audit_events) + CRM (customers/facilities/contacts) +
 * settings (company_settings/quote_terms) + pricing (work_roles/articles) + calc
 * (calculations/calculation_sections/calculation_rows) + files (files/file_links) +
 * quotes (tenant_counters/quotes/quote_versions/quote_version_lines/
 * quote_version_attachments/quote_events). `tenant_counters` enrolls like any other
 * tenant-owned table (the easy-to-forget one). The gate demands enrollment of any
 * FURTHER tenant-owned table when it lands.
 *
 * TEST-ONLY: imported only by suites under `tests/integration/rls/**`. The
 * introspection runs the loopback-gated `pg` superuser pool (admin-sql.ts).
 */
import type { TwoTenantFixture } from "../../factories/tenants";

/**
 * The `tenants` ROOT table — tenant-owned despite carrying NO `tenant_id` column
 * (its PK `id` IS the tenant id). It MUST be unioned into the introspected set and
 * MUST be enrolled. Named here so the gate's edge-case handling is a single,
 * documented constant rather than a magic string scattered across queries.
 */
export const TENANT_ROOT_TABLE = "tenants" as const;

/** The enrolled tenant-owned tables — the single source of truth (Task 1.2). */
export const TENANT_TABLES = [
  "tenants",
  "tenant_memberships",
  "audit_events",
  // Story 3.1 CRM tables (the first tenant-owned BUSINESS tables). UNLIKE the
  // three above, `authenticated` HAS an INSERT/UPDATE grant on these (the tenant
  // admin manages CRM via the app path) — so their cross-tenant UPDATE denial
  // mechanism is RLS-USING invisibility (zero rows + unchanged on independent
  // re-read), NOT a missing-grant 42501. See `mutationDenialKind` below.
  "customers",
  "facilities",
  "contacts",
  // Story 3.3 settings tables (the first tenant-owned SETTINGS tables). Like the CRM
  // tables, `authenticated` HAS an INSERT/UPDATE grant (the tenant admin manages
  // settings via the app path) — so their cross-tenant UPDATE denial mechanism is
  // RLS-USING invisibility (zero rows + unchanged on independent re-read), NOT a
  // missing-grant 42501. See `updateDenialKind` below. Both are ONE-row-per-tenant
  // (a unique (tenant_id)).
  "company_settings",
  "quote_terms",
  // Story 3.4 pricing tables (the first tenant-owned PRICING tables). Like the CRM /
  // settings tables, `authenticated` HAS an INSERT/UPDATE grant (the tenant admin
  // manages pricing via the app path) — so their cross-tenant UPDATE denial mechanism
  // is RLS-USING invisibility (zero rows + unchanged re-read), NOT a missing-grant
  // 42501. UNLIKE the settings tables these are MANY-rows-per-tenant collections (NO
  // unique (tenant_id)). The articles spoof/anon rows carry ONLY the minimal manual
  // columns — there is NO supplier-ish column to populate (HARD no-supplier-scope).
  "work_roles",
  "articles",
  // Story 5.1 calculation tables (the first tenant-owned CALCULATION tables). Like the
  // CRM / settings / pricing tables, `authenticated` HAS an INSERT/UPDATE grant (the
  // tenant admin manages calculations via the app path) — so their cross-tenant UPDATE
  // denial mechanism is RLS-USING invisibility (zero rows + unchanged re-read), NOT a
  // missing-grant 42501. See `updateDenialKind` below. All three are MANY-rows-per-tenant
  // collections (NO unique (tenant_id)). The spoof/anon rows carry ONLY the closed-union
  // / integer-öre / bp columns — NO supplier-ish column (HARD no-supplier-scope). The
  // cross-tenant spoof INSERT carries a parent id pointing at a Tenant B parent (customer
  // for calculations; calc for calculation_sections; section for calculation_rows).
  "calculations",
  "calculation_sections",
  "calculation_rows",
  // Story 8.1 file tables (the first tenant-owned FILE tables — the single Phase A file
  // model). Like the CRM / settings / pricing / calc tables, `authenticated` HAS an
  // INSERT/UPDATE grant (the tenant admin manages files/links via the app path) — so
  // their cross-tenant UPDATE denial mechanism is RLS-USING invisibility (zero rows +
  // unchanged re-read), NOT a missing-grant 42501. See `updateDenialKind` below. Both
  // are MANY-rows-per-tenant collections (NO unique (tenant_id)). The spoof/anon rows
  // carry ONLY the file-metadata / link columns — NO supplier-ish column, NO raw file
  // content, NO PII. The file_links cross-tenant spoof carries a Tenant B file_id parent
  // + a valid owner_type/purpose (the composite same-tenant FK binds it to Tenant B).
  "files",
  "file_links",
  // Story 6.1 quote tables (the first tenant-owned QUOTE tables — the composite immutable
  // snapshot model). Like the CRM / settings / pricing / calc / file tables,
  // `authenticated` HAS an INSERT/UPDATE grant (the tenant admin creates quote versions
  // via the app path + the create_quote_version_from_calculation RPC) — so their
  // cross-tenant UPDATE denial mechanism is RLS-USING invisibility (zero rows + unchanged
  // re-read), NOT a missing-grant 42501. See `updateDenialKind` below. All six are
  // MANY-rows-per-tenant collections (tenant_counters is many-per-tenant keyed by
  // (tenant_id, counter_name); NO unique (tenant_id)). The spoof/anon rows carry ONLY the
  // display/metadata / integer-öre / bp columns — NO supplier-ish column, NO PII. The
  // child spoof INSERTs carry a Tenant B parent id (quote for quote_versions/quote_events;
  // version for quote_version_lines/quote_version_attachments) + the source calc/file
  // parents so the composite same-tenant FKs bind them to Tenant B. `tenant_counters` is
  // the easy-to-forget one — it enrolls like any other tenant-owned table.
  "tenant_counters",
  "quotes",
  "quote_versions",
  "quote_version_lines",
  "quote_version_attachments",
  "quote_events",
  // Story 7.1 acceptance/job commitment tables (the acceptance-to-job model). Like every
  // business table since 3.1, `authenticated` HAS an INSERT/UPDATE grant (the tenant admin
  // captures acceptances via the app path / the captureQuoteAcceptance command; jobs are
  // created but unpopulated by any live path in 7.1) — so their cross-tenant UPDATE denial
  // mechanism is RLS-USING invisibility (zero rows + unchanged re-read), NOT a missing-grant
  // 42501. See `updateDenialKind` below. All three are MANY-rows-per-tenant collections (NO
  // unique (tenant_id)). The spoof/anon rows carry ONLY the display/metadata / integer-öre
  // columns — NO supplier-ish column, NO PII; öre values kept < 10 digits (the orgnr-scan
  // boundary, R-717). The child spoof INSERTs carry a Tenant B parent id (acceptance →
  // version/quote; job → acceptance/version/customer; job_event → job) + the source parents so
  // the composite same-tenant FKs bind them to Tenant B. `job_events` is the easy-to-forget
  // event table — it enrolls like any other tenant-owned table (retro epic-8).
  "quote_acceptances",
  "jobs",
  "job_events",
] as const;

export type TenantTableName = (typeof TENANT_TABLES)[number];

/** The path to this module, surfaced in the gate's developer-facing failure (DX). */
export const INVENTORY_MODULE_PATH =
  "tests/integration/rls/tenant-table-inventory.ts";

/**
 * Per-table cross-tenant metadata, extracted verbatim (behaviour-preserving) from
 * `cross-tenant-isolation.rls.test.ts`. Each entry depends on the live two-tenant
 * fixture + (for audit_events) a seeded Tenant B audit row id, so the helpers take
 * a context object rather than closing over suite-local variables.
 */
export interface InventoryContext {
  readonly fixture: TwoTenantFixture;
  /** A REAL Tenant B audit row id (cross-tenant target for the audit_events row). */
  readonly tenantBAuditId: string;
  /**
   * REAL Tenant B CRM row ids (Story 3.1) — concrete cross-tenant targets the
   * customers/facilities/contacts negatives point Tenant A at, so the denial is
   * never vacuous against a non-existent row. Optional so the anon suite (which
   * never reads a seeded row — anon is denied before any row matches) can omit
   * them; the cross-tenant suite seeds and asserts them. A consumer that needs one
   * but finds it missing fails LOUDLY in the helper (vacuity guard), never silently.
   */
  readonly tenantBCustomerId?: string;
  readonly tenantBFacilityId?: string;
  readonly tenantBContactId?: string;
  /**
   * REAL Tenant B SETTINGS row ids (Story 3.3) — concrete cross-tenant targets the
   * company_settings/quote_terms negatives point Tenant A at, so the denial is never
   * vacuous against a non-existent row. Optional so the anon suite (which never reads
   * a seeded row) can omit them; the cross-tenant suite seeds and asserts them. A
   * consumer that needs one but finds it missing fails LOUDLY (vacuity guard).
   */
  readonly tenantBCompanySettingsId?: string;
  readonly tenantBQuoteTermsId?: string;
  /**
   * REAL Tenant B PRICING row ids (Story 3.4) — concrete cross-tenant targets the
   * work_roles/articles negatives point Tenant A at, so the denial is never vacuous
   * against a non-existent row. Optional so the anon suite (which never reads a seeded
   * row) can omit them; the cross-tenant suite seeds and asserts them. A consumer that
   * needs one but finds it missing fails LOUDLY (vacuity guard via requireCrmId).
   */
  readonly tenantBWorkRoleId?: string;
  readonly tenantBArticleId?: string;
  /**
   * REAL Tenant B CALCULATION row ids (Story 5.1) — concrete cross-tenant targets the
   * calculations/calculation_sections/calculation_rows negatives point Tenant A at, so
   * the denial is never vacuous against a non-existent row. `tenantBCalculationId` also
   * doubles as the Tenant B PARENT the calculation_sections spoof INSERT references, and
   * `tenantBCalcSectionId` the parent the calculation_rows spoof references. Optional so
   * the anon suite (which never reads a seeded row) can omit them; the cross-tenant suite
   * seeds and asserts them. A consumer that needs one but finds it missing fails LOUDLY
   * (vacuity guard via requireCrmId).
   */
  readonly tenantBCalculationId?: string;
  readonly tenantBCalcSectionId?: string;
  readonly tenantBCalcRowId?: string;
  /**
   * REAL Tenant B FILE row ids (Story 8.1) — concrete cross-tenant targets the
   * files/file_links negatives point Tenant A at, so the denial is never vacuous
   * against a non-existent row. `tenantBFileId` also doubles as the Tenant B PARENT the
   * file_links spoof INSERT references (its composite same-tenant FK). Optional so the
   * anon suite (which never reads a seeded row) can omit them; the cross-tenant suite
   * seeds and asserts them. A consumer that needs one but finds it missing fails LOUDLY
   * (vacuity guard via requireCrmId).
   */
  readonly tenantBFileId?: string;
  readonly tenantBFileLinkId?: string;
  /**
   * REAL Tenant B QUOTE row ids (Story 6.1) — concrete cross-tenant targets the
   * tenant_counters/quotes/quote_versions/quote_version_lines/quote_version_attachments/
   * quote_events negatives point Tenant A at, so the denial is never vacuous against a
   * non-existent row. `tenantBQuoteId` also doubles as the Tenant B PARENT the
   * quote_versions/quote_events spoof INSERTs reference, and `tenantBQuoteVersionId` the
   * parent the quote_version_lines/quote_version_attachments spoofs reference. Optional so
   * the anon suite (which never reads a seeded row) can omit them; the cross-tenant suite
   * seeds and asserts them. A consumer that needs one but finds it missing fails LOUDLY
   * (vacuity guard via requireCrmId).
   */
  readonly tenantBTenantCounterId?: string;
  readonly tenantBQuoteId?: string;
  readonly tenantBQuoteVersionId?: string;
  readonly tenantBQuoteVersionLineId?: string;
  readonly tenantBQuoteVersionAttachmentId?: string;
  readonly tenantBQuoteEventId?: string;
  /** The Tenant B source calculation the quote_versions spoof references (composite FK). */
  readonly tenantBQuoteSourceCalcId?: string;
  /**
   * REAL Tenant B ACCEPTANCE/JOB row ids (Story 7.1) — concrete cross-tenant targets the
   * quote_acceptances/jobs/job_events negatives point Tenant A at, so the denial is never
   * vacuous against a non-existent row. `tenantBQuoteAcceptanceId` also doubles as the Tenant B
   * PARENT the jobs spoof references, and `tenantBJobId` the parent the job_events spoof
   * references. Optional so the anon suite can omit them; the cross-tenant suite seeds and
   * asserts them. A consumer that needs one but finds it missing fails LOUDLY (requireCrmId).
   */
  readonly tenantBQuoteAcceptanceId?: string;
  readonly tenantBJobId?: string;
  readonly tenantBJobEventId?: string;
}

/**
 * The cross-tenant mutation-denial MECHANISM for a table, by grant profile:
 *   - "privilege"    — `authenticated` has NO write grant, so the write is denied at
 *     the PRIVILEGE layer (`42501`). True for tenants/tenant_memberships/audit_events
 *     (and for DELETE on every table — no app-path DELETE grant anywhere).
 *   - "rls-invisible" — `authenticated` HAS the write grant (the CRM tables), so a
 *     cross-tenant UPDATE matches ZERO rows under RLS USING (the foreign row is
 *     invisible) and returns an empty set with NO error. The negative asserts the
 *     mechanism via zero-rows-affected PLUS an independent BYPASSRLS re-read proving
 *     the target row is UNCHANGED — never a bare/vacuous empty set.
 * This keeps the data-driven suite STRONG per table (each asserts its real
 * mechanism), not loosened to a lowest-common-denominator.
 */
export type MutationDenialKind = "privilege" | "rls-invisible";

/**
 * The cross-tenant UPDATE denial mechanism for `table`. DELETE is "privilege" for
 * ALL tables (no app-path DELETE grant), so this descriptor governs only the UPDATE
 * branch of the cross-tenant suite.
 */
export function updateDenialKind(table: TenantTableName): MutationDenialKind {
  switch (table) {
    case "tenants":
    case "tenant_memberships":
    case "audit_events":
      return "privilege"; // no UPDATE grant to authenticated → 42501
    case "customers":
    case "facilities":
    case "contacts":
    case "company_settings":
    case "quote_terms":
    case "work_roles":
    case "articles":
    case "calculations":
    case "calculation_sections":
    case "calculation_rows":
    case "files":
    case "file_links":
    case "tenant_counters":
    case "quotes":
    case "quote_versions":
    case "quote_version_lines":
    case "quote_version_attachments":
    case "quote_events":
    case "quote_acceptances":
    case "jobs":
    case "job_events":
      return "rls-invisible"; // UPDATE granted; RLS USING hides foreign rows
    default:
      return assertNever(table);
  }
}

/**
 * Exhaustiveness guard. Called from the `default:` arm of every per-table metadata
 * `switch (table)` below: because `table` is narrowed to `never` once all
 * `TenantTableName` members are handled, a FUTURE table added to `TENANT_TABLES`
 * WITHOUT a matching metadata branch makes this call a TypeScript COMPILE error
 * (`Argument of type '"new_table"' is not assignable to parameter of type 'never'`)
 * — not a silently membership-shaped (wrong) cross-tenant negative row.
 *
 * This is the compile-safe backstop for the "enrolls by data, one edit" standing-gate
 * contract (AC4 "the gate bites"): the H4 inventory gate auto-demands enrollment of a
 * new tenant-owned table; this guard ensures that enrolling it WITHOUT its metadata
 * fails the typecheck rather than submitting a `{tenant_id,user_id,role,status}` row
 * against a table that may not carry those columns (which would red/false-green for the
 * wrong reason). [iter-2 review Decision — human-chosen direction: FIX]
 */
function assertNever(table: never): never {
  throw new Error(
    `tenant-table-inventory: no metadata branch for enrolled table ` +
      `${JSON.stringify(table)} — add its spoof/filter/mutation/anon metadata in ` +
      `${INVENTORY_MODULE_PATH}.`,
  );
}

/**
 * A row that, if it slipped past RLS, would forge Tenant B ownership for `table`.
 *
 * Each uses a FRESH `crypto.randomUUID()` id (or a non-conflicting key) so the
 * denial is the PRIVILEGE layer (`42501` — missing INSERT GRANT / RLS), NOT a PK
 * collision (`23505`) — a green that would prove nothing about isolation. Behaviour
 * is unchanged from the original cross-tenant suite (Story 2.2/2.3 review fixes).
 */
export function spoofedRowFor(
  table: TenantTableName,
  ctx: InventoryContext,
): Record<string, unknown> {
  const { fixture } = ctx;
  switch (table) {
    case "tenants":
      // A NEW tenant root with a FRESH id (review fix 2026-06-26). Reusing Tenant B's
      // existing PK would fail with `23505` BEFORE the privilege/RLS layer is reached.
      // With a fresh uuid only the missing INSERT GRANT / RLS can reject the write, so
      // the test exercises the ACTUAL denial.
      return { id: crypto.randomUUID(), name: "spoofed-by-tenant-a" };
    case "audit_events":
      // An audit row carrying Tenant B's tenant_id == a forged cross-tenant audit
      // write. FRESH id so the denial is the missing INSERT GRANT (42501), not a PK
      // collision (the app path has NO direct INSERT grant on audit_events — writes go
      // via the record_audit_event DEFINER).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        actor_user_id: fixture.adminA.id,
        command: "spoof.by.a",
        event_type: "spoof.by.a",
        target_type: "tenant",
        target_id: fixture.tenantB.id,
        correlation_id: crypto.randomUUID(),
        metadata: {},
      };
    case "tenant_memberships":
      // A membership row carrying Tenant B's tenant_id == self-grant into Tenant B. Uses
      // adminA's own user_id against Tenant B (a NON-conflicting row), so the denial is
      // the missing INSERT GRANT / RLS, not a unique collision.
      return {
        tenant_id: fixture.tenantB.id,
        user_id: fixture.adminA.id,
        role: "tenant_admin",
        status: "active",
      };
    case "customers":
      // A customer row forging Tenant B ownership. `authenticated` HAS an INSERT
      // grant on customers, so the denial is the RLS INSERT WITH CHECK
      // (is_tenant_admin(tenant_id=B) is false for a Tenant A admin) → `42501` "new
      // row violates row-level security policy". FRESH id so the denial is the
      // policy, never a `23505` PK collision.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        customer_type: "company",
        display_name: "spoofed-by-tenant-a",
        org_nr: "556000-0000",
      };
    case "facilities":
      // A facility forging Tenant B ownership, pointing at a REAL Tenant B customer
      // parent. The RLS INSERT WITH CHECK on tenant_id=B fires `42501` before the
      // row lands (fresh id; the parent is a concrete Tenant B customer).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        customer_id: requireCrmId(ctx.tenantBCustomerId, "tenantBCustomerId", table),
        name: "spoofed-facility-by-a",
      };
    case "contacts":
      // A contact forging Tenant B ownership, pointing at a REAL Tenant B customer
      // parent. RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        customer_id: requireCrmId(ctx.tenantBCustomerId, "tenantBCustomerId", table),
        name: "spoofed-contact-by-a",
      };
    case "company_settings":
      // A company_settings row forging Tenant B ownership. `authenticated` HAS an
      // INSERT grant, so the denial is the RLS INSERT WITH CHECK
      // (is_tenant_admin(tenant_id=B) is false for a Tenant A admin) → `42501`. FRESH
      // id + the NOT-NULL columns (default_vat_display, vat_rate_bp) populated so the
      // denial is the policy, never a `23505` PK collision or a NOT-NULL violation.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        company_name: "spoofed-by-tenant-a",
        default_vat_display: "company_togglable",
        vat_rate_bp: 2500,
      };
    case "quote_terms":
      // A quote_terms row forging Tenant B ownership. RLS INSERT WITH CHECK on
      // tenant_id=B → `42501` (fresh id; the NOT-NULL terms_text populated). NO
      // approval field is set — approval is never part of a write payload.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        terms_text: "spoofed-terms-by-a (platshållartext)",
      };
    case "work_roles":
      // A work_roles row forging Tenant B ownership. `authenticated` HAS an INSERT
      // grant, so the denial is the RLS INSERT WITH CHECK (is_tenant_admin(tenant_id=B)
      // is false for a Tenant A admin) → `42501`. FRESH id + the NOT-NULL columns
      // (display_name + the two integer-öre rates) populated so the denial is the
      // policy, never a `23505` PK collision or a NOT-NULL violation.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        display_name: "spoofed-by-tenant-a",
        cost_rate_ore: 1,
        sell_rate_ore: 1,
      };
    case "articles":
      // An articles row forging Tenant B ownership. RLS INSERT WITH CHECK on
      // tenant_id=B → `42501` (fresh id; the NOT-NULL name + unit_price_ore populated).
      // CRITICAL no-supplier-scope: ONLY the minimal manual columns appear here — there
      // is NO supplier-ish column to populate (one would not even exist in the schema).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        name: "spoofed-by-tenant-a",
        unit_price_ore: 1,
      };
    case "calculations":
      // A calc row forging Tenant B ownership, pointing at a REAL Tenant B customer
      // parent. `authenticated` HAS an INSERT grant, so the denial is the RLS INSERT
      // WITH CHECK (is_tenant_admin(tenant_id=B) is false for a Tenant A admin) →
      // `42501`. FRESH id + NOT-NULL title so the denial is the policy, never a `23505`
      // PK collision (the WITH CHECK fires before the FK is checked).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        customer_id: requireCrmId(
          ctx.tenantBCustomerId,
          "tenantBCustomerId",
          table,
        ),
        title: "spoofed-calc-by-a",
      };
    case "calculation_sections":
      // A section forging Tenant B ownership, pointing at a REAL Tenant B calc parent.
      // RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        calculation_id: requireCrmId(
          ctx.tenantBCalculationId,
          "tenantBCalculationId",
          table,
        ),
        title: "spoofed-section-by-a",
      };
    case "calculation_rows":
      // A row forging Tenant B ownership, pointing at a REAL Tenant B section parent.
      // RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id; the NOT-NULL row_type
      // + quantity + unit populated so the denial is the policy, never a NOT-NULL/CHECK
      // violation).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        section_id: requireCrmId(
          ctx.tenantBCalcSectionId,
          "tenantBCalcSectionId",
          table,
        ),
        row_type: "labor",
        quantity: 1,
        unit: "h",
      };
    case "files":
      // A files row forging Tenant B ownership. `authenticated` HAS an INSERT grant, so
      // the denial is the RLS INSERT WITH CHECK (is_tenant_admin(tenant_id=B) is false
      // for a Tenant A admin) → `42501`. FRESH id + a FRESH unique object_path (so no
      // `23505` unique (bucket_id, object_path) collision fires before the policy) +
      // NOT-NULL display_name so the denial is the policy. NO raw file content / PII.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        object_path: `${fixture.tenantB.id}/${crypto.randomUUID()}/spoof-by-a.pdf`,
        display_name: "spoofed-file-by-a",
      };
    case "file_links":
      // A file_links row forging Tenant B ownership, pointing at a REAL Tenant B file
      // parent. The RLS INSERT WITH CHECK on tenant_id=B fires `42501` before the row
      // lands (fresh id; the parent is a concrete Tenant B file; owner_type/owner_id/
      // purpose populated so the denial is the policy, never a CHECK/NOT-NULL violation).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        file_id: requireCrmId(ctx.tenantBFileId, "tenantBFileId", table),
        owner_type: "customer",
        owner_id: requireCrmId(ctx.tenantBCustomerId, "tenantBCustomerId", table),
        purpose: "crm_document",
      };
    case "tenant_counters":
      // A counter row forging Tenant B ownership. `authenticated` HAS an INSERT grant, so
      // the denial is the RLS INSERT WITH CHECK (is_tenant_admin(tenant_id=B) is false for
      // a Tenant A admin) → `42501`. A FRESH counter_name avoids a `23505` unique
      // (tenant_id, counter_name) collision before the policy fires.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        counter_name: `spoof-${crypto.randomUUID().slice(0, 8)}`,
        current_value: 1,
      };
    case "quotes":
      // A quote forging Tenant B ownership, pointing at a REAL Tenant B customer parent.
      // RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        customer_id: requireCrmId(ctx.tenantBCustomerId, "tenantBCustomerId", table),
      };
    case "quote_versions":
      // A version forging Tenant B ownership, pointing at a REAL Tenant B quote + source
      // calc parent. RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id; the
      // NOT-NULL version_number/quote_number/calculation_id/captured_at populated so the
      // denial is the policy, never a NOT-NULL/CHECK violation).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        quote_id: requireCrmId(ctx.tenantBQuoteId, "tenantBQuoteId", table),
        version_number: 1,
        quote_number: 1,
        calculation_id: requireCrmId(
          ctx.tenantBQuoteSourceCalcId,
          "tenantBQuoteSourceCalcId",
          table,
        ),
        captured_at: "2026-07-05T12:00:00.000Z",
        company_name: "spoofed-version-by-a",
      };
    case "quote_version_lines":
      // A line forging Tenant B ownership, pointing at a REAL Tenant B version parent.
      // RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id; NOT-NULL row_type).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        quote_version_id: requireCrmId(
          ctx.tenantBQuoteVersionId,
          "tenantBQuoteVersionId",
          table,
        ),
        row_type: "line",
        label: "spoofed-line-by-a",
      };
    case "quote_version_attachments":
      // An attachment forging Tenant B ownership, pointing at a REAL Tenant B version + a
      // REAL Tenant B file parent. RLS INSERT WITH CHECK on tenant_id=B → `42501`.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        quote_version_id: requireCrmId(
          ctx.tenantBQuoteVersionId,
          "tenantBQuoteVersionId",
          table,
        ),
        file_id: requireCrmId(ctx.tenantBFileId, "tenantBFileId", table),
        display_name: "spoofed-attachment-by-a.pdf",
      };
    case "quote_events":
      // An event forging Tenant B ownership, pointing at a REAL Tenant B quote parent.
      // RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id; event_type populated so
      // the denial is the policy, never a CHECK violation).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        quote_id: requireCrmId(ctx.tenantBQuoteId, "tenantBQuoteId", table),
        event_type: "created",
      };
    case "quote_acceptances":
      // An acceptance forging Tenant B ownership, pointing at REAL Tenant B quote + version
      // parents. RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id; the NOT-NULL
      // accepted_at/accepted_price_ore/source_sent_total_ore populated so the denial is the
      // policy, never a NOT-NULL/CHECK violation). Öre < 10 digits (orgnr-scan boundary).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        quote_id: requireCrmId(ctx.tenantBQuoteId, "tenantBQuoteId", table),
        quote_version_id: requireCrmId(
          ctx.tenantBQuoteVersionId,
          "tenantBQuoteVersionId",
          table,
        ),
        channel: "spoofed-channel-by-a",
        accepted_at: "2026-07-09T09:00:00.000Z",
        accepted_price_ore: 125000,
        source_sent_total_ore: 125000,
      };
    case "jobs":
      // A job forging Tenant B ownership, pointing at REAL Tenant B acceptance + version +
      // customer parents. RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        quote_acceptance_id: requireCrmId(
          ctx.tenantBQuoteAcceptanceId,
          "tenantBQuoteAcceptanceId",
          table,
        ),
        quote_version_id: requireCrmId(
          ctx.tenantBQuoteVersionId,
          "tenantBQuoteVersionId",
          table,
        ),
        customer_id: requireCrmId(ctx.tenantBCustomerId, "tenantBCustomerId", table),
        title: "spoofed-job-by-a",
        status: "created",
      };
    case "job_events":
      // A job event forging Tenant B ownership, pointing at a REAL Tenant B job parent.
      // RLS INSERT WITH CHECK on tenant_id=B → `42501` (fresh id; event_type populated).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantB.id,
        job_id: requireCrmId(ctx.tenantBJobId, "tenantBJobId", table),
        event_type: "created",
      };
    default:
      return assertNever(table);
  }
}

/**
 * Vacuity guard for the CRM cross-tenant targets: the customers/facilities/contacts
 * negatives target a CONCRETE seeded Tenant B row. A missing id would make the
 * `.eq(...)` / spoof parent match nothing → a vacuous green. Fail LOUDLY so a broken
 * seed is fixed, not silently passed. Mirrors the `tenantBFilter('audit_events')`
 * vacuity guard.
 */
function requireCrmId(
  id: string | undefined,
  name: string,
  table: TenantTableName,
): string {
  if (!id) {
    throw new Error(
      `tenant-table-inventory: the ${table} cross-tenant negative requires a real ` +
        `seeded ${name}, but it is null/undefined — the negative would pass ` +
        `vacuously against a non-existent row. Seed it in the cross-tenant suite ` +
        `beforeAll and pass it on the InventoryContext.`,
    );
  }
  return id;
}

/** The id column + value to filter Tenant B's existing rows by, per table. */
export function tenantBFilter(
  table: TenantTableName,
  ctx: InventoryContext,
): { column: string; value: string } {
  switch (table) {
    case "tenants":
      return { column: "id", value: ctx.fixture.tenantB.id };
    case "audit_events":
      // VACUITY GUARD (DX#4, epic-2 hardening): the audit_events cross-tenant negative
      // filters by this SPECIFIC seeded Tenant B row id. A null/empty id would make
      // `.eq("id", …)` match nothing, so the denial would pass VACUOUSLY (a missing row
      // trivially denies). Fail loudly here so a broken seed cannot green-by-vacuity.
      // This travels with the metadata so any future consumer of the inventory inherits
      // the guard; the cross-tenant suite's beforeAll also asserts it at seed time.
      if (!ctx.tenantBAuditId) {
        throw new Error(
          "tenant-table-inventory: tenantBFilter('audit_events') requires a real " +
            "seeded tenantBAuditId, but it is null/undefined — the cross-tenant " +
            "audit negative would pass vacuously against a non-existent row.",
        );
      }
      return { column: "id", value: ctx.tenantBAuditId };
    case "tenant_memberships":
      return { column: "tenant_id", value: ctx.fixture.tenantB.id };
    case "customers":
      // Target the SPECIFIC seeded Tenant B customer by id — the cross-tenant
      // SELECT/UPDATE must read/affect ZERO rows under A's RLS, and the "unchanged"
      // re-read proves THIS row stayed intact. Vacuity-guarded (requireCrmId).
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBCustomerId, "tenantBCustomerId", table),
      };
    case "facilities":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBFacilityId, "tenantBFacilityId", table),
      };
    case "contacts":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBContactId, "tenantBContactId", table),
      };
    case "company_settings":
      // Target the SPECIFIC seeded Tenant B company_settings row by id — the
      // cross-tenant SELECT/UPDATE must read/affect ZERO rows under A's RLS, and the
      // "unchanged" re-read proves THIS row stayed intact. Vacuity-guarded.
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBCompanySettingsId,
          "tenantBCompanySettingsId",
          table,
        ),
      };
    case "quote_terms":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBQuoteTermsId,
          "tenantBQuoteTermsId",
          table,
        ),
      };
    case "work_roles":
      // Target the SPECIFIC seeded Tenant B work_role by id — the cross-tenant
      // SELECT/UPDATE must read/affect ZERO rows under A's RLS, and the "unchanged"
      // re-read proves THIS row stayed intact. Vacuity-guarded.
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBWorkRoleId, "tenantBWorkRoleId", table),
      };
    case "articles":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBArticleId, "tenantBArticleId", table),
      };
    case "calculations":
      // Target the SPECIFIC seeded Tenant B calc by id — the cross-tenant SELECT/UPDATE
      // must read/affect ZERO rows under A's RLS, and the "unchanged" re-read proves THIS
      // row stayed intact. Vacuity-guarded.
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBCalculationId,
          "tenantBCalculationId",
          table,
        ),
      };
    case "calculation_sections":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBCalcSectionId,
          "tenantBCalcSectionId",
          table,
        ),
      };
    case "calculation_rows":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBCalcRowId, "tenantBCalcRowId", table),
      };
    case "files":
      // Target the SPECIFIC seeded Tenant B file by id — the cross-tenant SELECT/UPDATE
      // must read/affect ZERO rows under A's RLS, and the "unchanged" re-read proves THIS
      // row's display_name stayed intact. Vacuity-guarded.
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBFileId, "tenantBFileId", table),
      };
    case "file_links":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBFileLinkId, "tenantBFileLinkId", table),
      };
    case "tenant_counters":
      // Target the SPECIFIC seeded Tenant B counter by id — the cross-tenant SELECT/UPDATE
      // must read/affect ZERO rows under A's RLS. Vacuity-guarded.
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBTenantCounterId,
          "tenantBTenantCounterId",
          table,
        ),
      };
    case "quotes":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBQuoteId, "tenantBQuoteId", table),
      };
    case "quote_versions":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBQuoteVersionId,
          "tenantBQuoteVersionId",
          table,
        ),
      };
    case "quote_version_lines":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBQuoteVersionLineId,
          "tenantBQuoteVersionLineId",
          table,
        ),
      };
    case "quote_version_attachments":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBQuoteVersionAttachmentId,
          "tenantBQuoteVersionAttachmentId",
          table,
        ),
      };
    case "quote_events":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBQuoteEventId,
          "tenantBQuoteEventId",
          table,
        ),
      };
    case "quote_acceptances":
      return {
        column: "id",
        value: requireCrmId(
          ctx.tenantBQuoteAcceptanceId,
          "tenantBQuoteAcceptanceId",
          table,
        ),
      };
    case "jobs":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBJobId, "tenantBJobId", table),
      };
    case "job_events":
      return {
        column: "id",
        value: requireCrmId(ctx.tenantBJobEventId, "tenantBJobEventId", table),
      };
    default:
      return assertNever(table);
  }
}

/**
 * The UPDATE mutation payload that, if it landed, would hijack Tenant B's row.
 * `audit_events` is append-only (no update grant), so its payload still triggers
 * the same 42501 privilege denial the suite asserts. For the CRM tables
 * `authenticated` HAS an UPDATE grant, so the same payload instead matches ZERO
 * rows under RLS USING (the foreign row is invisible) — the "rls-invisible" denial
 * the cross-tenant suite asserts via zero-rows-affected + an unchanged re-read.
 */
export function hijackMutationFor(
  table: TenantTableName,
): Record<string, unknown> {
  switch (table) {
    case "tenants":
      return { name: "hijacked-by-tenant-a" };
    case "audit_events":
      return { metadata: { hijacked: true } };
    case "tenant_memberships":
      return { status: "disabled" };
    case "customers":
      return { display_name: "hijacked-by-tenant-a" };
    case "facilities":
    case "contacts":
      return { name: "hijacked-by-tenant-a" };
    case "company_settings":
      return { company_name: "hijacked-by-tenant-a" };
    case "quote_terms":
      return { terms_text: "hijacked-by-tenant-a" };
    case "work_roles":
      return { display_name: "hijacked-by-tenant-a" };
    case "articles":
      return { name: "hijacked-by-tenant-a" };
    case "calculations":
    case "calculation_sections":
      return { title: "hijacked-by-tenant-a" };
    case "calculation_rows":
      return { label: "hijacked-by-tenant-a" };
    case "files":
      return { display_name: "hijacked-by-tenant-a" };
    case "file_links":
      // purpose is a mutable, non-id column with a closed CHECK — the hijack sets it to
      // a DIFFERENT valid value than the seed's so the unchanged re-read is meaningful.
      return { purpose: "job_evidence" };
    case "tenant_counters":
      // current_value is a mutable numeric — the hijack sets a DIFFERENT value than the
      // seed's so the unchanged re-read (via current_value) is meaningful.
      return { current_value: 999999 };
    case "quotes":
      // archived_at is a mutable timestamptz (seed is NULL) — the hijack sets a non-null
      // value so the unchanged re-read (archived_at stays NULL) is meaningful.
      return { archived_at: "2099-01-01T00:00:00.000Z" };
    case "quote_versions":
      return { company_name: "hijacked-by-tenant-a" };
    case "quote_version_lines":
      return { label: "hijacked-by-tenant-a" };
    case "quote_version_attachments":
      return { display_name: "hijacked-by-tenant-a" };
    case "quote_events":
      // channel is a mutable free-text column (seed is NULL) — the hijack sets a value so
      // the unchanged re-read (channel stays NULL) is meaningful.
      return { channel: "hijacked-by-tenant-a" };
    case "quote_acceptances":
      // notes is a mutable free-text column (seed is NULL) — the hijack sets a value so the
      // unchanged re-read (notes stays NULL) is meaningful.
      return { notes: "hijacked-by-tenant-a" };
    case "jobs":
      // title is a mutable free-text column (seed is "tenant-b-job-seed") — the hijack sets a
      // DIFFERENT value so the unchanged re-read is meaningful.
      return { title: "hijacked-by-tenant-a" };
    case "job_events":
      // channel is a mutable free-text column (seed is NULL) — the hijack sets a value so the
      // unchanged re-read (channel stays NULL) is meaningful.
      return { channel: "hijacked-by-tenant-a" };
    default:
      return assertNever(table);
  }
}

/**
 * The label column whose value the cross-tenant UPDATE negative reads back
 * (independently, BYPASSRLS) to prove the hijack value never landed, for an
 * "rls-invisible" table. Matches the column `hijackMutationFor` would have set.
 * Settings tables added in Story 3.3; CRM tables in Story 3.1.
 */
export function rlsInvisibleLabelColumn(table: TenantTableName): string {
  switch (table) {
    case "customers":
      return "display_name";
    case "facilities":
    case "contacts":
      return "name";
    case "company_settings":
      return "company_name";
    case "quote_terms":
      return "terms_text";
    case "work_roles":
      return "display_name";
    case "articles":
      return "name";
    case "calculations":
    case "calculation_sections":
      return "title";
    case "calculation_rows":
      return "label";
    case "files":
      return "display_name";
    case "file_links":
      // purpose is the mutable column the file_links hijack sets — re-read it to prove
      // the seed value ('crm_document') was NOT overwritten with the hijack value.
      return "purpose";
    case "tenant_counters":
      // current_value is the column the tenant_counters hijack sets — re-read it to prove
      // the seed value was NOT overwritten with the hijack value (999999).
      return "current_value";
    case "quotes":
      // archived_at is the column the quotes hijack sets — re-read it (::text) to prove the
      // seed value (NULL) was NOT overwritten with the hijack timestamp.
      return "archived_at";
    case "quote_versions":
      return "company_name";
    case "quote_version_lines":
      return "label";
    case "quote_version_attachments":
      return "display_name";
    case "quote_events":
      // channel is the column the quote_events hijack sets — re-read it to prove the seed
      // value (NULL) was NOT overwritten.
      return "channel";
    case "quote_acceptances":
      // notes is the column the quote_acceptances hijack sets — re-read it to prove the seed
      // value (NULL) was NOT overwritten.
      return "notes";
    case "jobs":
      // title is the column the jobs hijack sets — re-read it to prove the seed value
      // ("tenant-b-job-seed") was NOT overwritten.
      return "title";
    case "job_events":
      // channel is the column the job_events hijack sets — re-read it to prove the seed value
      // (NULL) was NOT overwritten.
      return "channel";
    // The "privilege"-denial tables never reach the unchanged-re-read branch, so a
    // label column is not meaningful for them — but the exhaustive switch keeps the
    // enrollment compile-safe (assertNever on a future unenrolled table).
    case "tenants":
      return "name";
    case "audit_events":
      return "command";
    case "tenant_memberships":
      return "status";
    default:
      return assertNever(table);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Anonymous-path metadata (anon-path-isolation.rls.test.ts) — every enrolled
// table covered for anon SELECT/INSERT/UPDATE/DELETE (AC5).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A row an ANONYMOUS caller might try to write into `table` (a forged tenant root
 * / self-grant / cross-tenant audit write). Anon has NO grant on any of these, so
 * the write is denied at the privilege layer regardless of the row's shape.
 */
export function anonRowFor(
  table: TenantTableName,
  ctx: InventoryContext,
): Record<string, unknown> {
  const { fixture } = ctx;
  switch (table) {
    case "tenants":
      return { id: crypto.randomUUID(), name: "anon-spoof" };
    case "audit_events":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        actor_user_id: fixture.adminA.id,
        command: "anon.spoof",
        event_type: "anon.spoof",
        target_type: "tenant",
        target_id: fixture.tenantA.id,
        correlation_id: crypto.randomUUID(),
        metadata: {},
      };
    case "tenant_memberships":
      return {
        tenant_id: fixture.tenantA.id,
        user_id: fixture.adminA.id,
        role: "tenant_admin",
        status: "active",
      };
    case "customers":
      // Anon has NO grant on customers, so the INSERT is denied at the privilege
      // layer (42501) regardless of the row shape. A valid-enough row (the CHECK
      // constraints are never reached — the grant denial fires first).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        customer_type: "company",
        display_name: "anon-spoof",
        org_nr: "556000-0001",
      };
    case "facilities":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        customer_id: crypto.randomUUID(),
        name: "anon-spoof-facility",
      };
    case "contacts":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        customer_id: crypto.randomUUID(),
        name: "anon-spoof-contact",
      };
    case "company_settings":
      // Anon has NO grant on company_settings, so the INSERT is denied at the
      // privilege layer (42501) regardless of the row shape. The NOT-NULL columns are
      // populated so the grant denial — not a NOT-NULL violation — is what fires.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        company_name: "anon-spoof",
        default_vat_display: "company_togglable",
        vat_rate_bp: 2500,
      };
    case "quote_terms":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        terms_text: "anon-spoof terms (platshållartext)",
      };
    case "work_roles":
      // Anon has NO grant on work_roles, so the INSERT is denied at the privilege
      // layer (42501) regardless of the row shape. NOT-NULL columns populated so the
      // grant denial — not a NOT-NULL violation — is what fires.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        display_name: "anon-spoof",
        cost_rate_ore: 1,
        sell_rate_ore: 1,
      };
    case "articles":
      // Anon has NO grant on articles → 42501. ONLY the minimal manual columns appear
      // (no supplier-ish column — HARD no-supplier-scope).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        name: "anon-spoof",
        unit_price_ore: 1,
      };
    case "calculations":
      // Anon has NO grant on the calc tables, so the INSERT is denied at the privilege
      // layer (42501) regardless of the row shape (a random parent id never matters —
      // the grant denial fires first). NOT-NULL title populated.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        customer_id: crypto.randomUUID(),
        title: "anon-spoof-calc",
      };
    case "calculation_sections":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        calculation_id: crypto.randomUUID(),
        title: "anon-spoof-section",
      };
    case "calculation_rows":
      // NOT-NULL row_type/quantity/unit populated so the grant denial — not a NOT-NULL/
      // CHECK violation — is what fires. NO supplier-ish column (HARD no-supplier-scope).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        section_id: crypto.randomUUID(),
        row_type: "labor",
        quantity: 1,
        unit: "h",
      };
    case "files":
      // Anon has NO grant on the file tables, so the INSERT is denied at the privilege
      // layer (42501) regardless of the row shape. NOT-NULL object_path/display_name
      // populated so the grant denial — not a NOT-NULL violation — is what fires. NO raw
      // file content / PII.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        object_path: `${fixture.tenantA.id}/${crypto.randomUUID()}/anon-spoof.pdf`,
        display_name: "anon-spoof-file",
      };
    case "file_links":
      // Anon has NO grant → 42501. A random file_id/owner_id never matters — the grant
      // denial fires first. owner_type/purpose populated so it is not a CHECK violation.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        file_id: crypto.randomUUID(),
        owner_type: "customer",
        owner_id: crypto.randomUUID(),
        purpose: "crm_document",
      };
    case "tenant_counters":
      // Anon has NO grant on the quote tables → the INSERT is denied at the privilege
      // layer (42501) regardless of the row shape. NOT-NULL columns populated so the grant
      // denial — not a NOT-NULL violation — is what fires.
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        counter_name: `anon-${crypto.randomUUID().slice(0, 8)}`,
        current_value: 1,
      };
    case "quotes":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        customer_id: crypto.randomUUID(),
      };
    case "quote_versions":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        quote_id: crypto.randomUUID(),
        version_number: 1,
        quote_number: 1,
        calculation_id: crypto.randomUUID(),
        captured_at: "2026-07-05T12:00:00.000Z",
        company_name: "anon-spoof-version",
      };
    case "quote_version_lines":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        quote_version_id: crypto.randomUUID(),
        row_type: "line",
        label: "anon-spoof-line",
      };
    case "quote_version_attachments":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        quote_version_id: crypto.randomUUID(),
        file_id: crypto.randomUUID(),
        display_name: "anon-spoof-attachment.pdf",
      };
    case "quote_events":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        quote_id: crypto.randomUUID(),
        event_type: "created",
      };
    case "quote_acceptances":
      // Anon has NO grant on the acceptance tables → the INSERT is denied at the privilege
      // layer (42501) regardless of the row shape (a random parent id never matters — the
      // grant denial fires first). NOT-NULL columns populated so the grant denial — not a
      // NOT-NULL violation — is what fires. Öre < 10 digits (orgnr-scan boundary).
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        quote_id: crypto.randomUUID(),
        quote_version_id: crypto.randomUUID(),
        accepted_at: "2026-07-09T09:00:00.000Z",
        accepted_price_ore: 125000,
        source_sent_total_ore: 125000,
      };
    case "jobs":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        quote_acceptance_id: crypto.randomUUID(),
        quote_version_id: crypto.randomUUID(),
        customer_id: crypto.randomUUID(),
        title: "anon-spoof-job",
        status: "created",
      };
    case "job_events":
      return {
        id: crypto.randomUUID(),
        tenant_id: fixture.tenantA.id,
        job_id: crypto.randomUUID(),
        event_type: "created",
      };
    default:
      return assertNever(table);
  }
}

/**
 * The id column + value an anonymous UPDATE/DELETE would target on `table`. Anon is
 * denied at the privilege layer before any row matches, so the value need only be a
 * valid existing Tenant A row.
 */
export function anonFilterFor(
  table: TenantTableName,
  ctx: InventoryContext,
): { column: string; value: string } {
  switch (table) {
    case "tenants":
      return { column: "id", value: ctx.fixture.tenantA.id };
    // `audit_events`, `tenant_memberships`, and the CRM tables SHARE one branch
    // (deliberate fall-through) and all filter by `tenant_id` here — and that is
    // intentional: anon is denied at the PRIVILEGE layer (42501) before any row is
    // matched, so the filter only needs to name a real, valid column for the table.
    // This DIFFERS on purpose from `tenantBFilter`, which targets the CRM/audit rows
    // by `id` (the cross-tenant suite needs a SPECIFIC seeded Tenant B row to prove
    // it stayed unchanged on independent re-read); the anon path has no such re-read,
    // so `tenant_id` suffices. Hence one shared branch, not a per-table copy.
    case "audit_events":
    case "tenant_memberships":
    case "customers":
    case "facilities":
    case "contacts":
    case "company_settings":
    case "quote_terms":
    case "work_roles":
    case "articles":
    case "calculations":
    case "calculation_sections":
    case "calculation_rows":
    case "files":
    case "file_links":
    case "tenant_counters":
    case "quotes":
    case "quote_versions":
    case "quote_version_lines":
    case "quote_version_attachments":
    case "quote_events":
    case "quote_acceptances":
    case "jobs":
    case "job_events":
      return { column: "tenant_id", value: ctx.fixture.tenantA.id };
    default:
      return assertNever(table);
  }
}

/** The anon UPDATE mutation payload per table (denied at the privilege layer). */
export function anonMutationFor(
  table: TenantTableName,
): Record<string, unknown> {
  switch (table) {
    case "tenants":
      return { name: "anon-hijack" };
    case "audit_events":
      return { metadata: { hijacked: true } };
    case "tenant_memberships":
      return { status: "disabled" };
    case "customers":
      return { display_name: "anon-hijack" };
    case "facilities":
    case "contacts":
      return { name: "anon-hijack" };
    case "company_settings":
      return { company_name: "anon-hijack" };
    case "quote_terms":
      return { terms_text: "anon-hijack" };
    case "work_roles":
      return { display_name: "anon-hijack" };
    case "articles":
      return { name: "anon-hijack" };
    case "calculations":
    case "calculation_sections":
      return { title: "anon-hijack" };
    case "calculation_rows":
      return { label: "anon-hijack" };
    case "files":
      return { display_name: "anon-hijack" };
    case "file_links":
      return { purpose: "job_evidence" };
    case "tenant_counters":
      return { current_value: 999999 };
    case "quotes":
      return { archived_at: "2099-01-01T00:00:00.000Z" };
    case "quote_versions":
      return { company_name: "anon-hijack" };
    case "quote_version_lines":
      return { label: "anon-hijack" };
    case "quote_version_attachments":
      return { display_name: "anon-hijack" };
    case "quote_events":
      return { channel: "anon-hijack" };
    case "quote_acceptances":
      return { notes: "anon-hijack" };
    case "jobs":
      return { title: "anon-hijack" };
    case "job_events":
      return { channel: "anon-hijack" };
    default:
      return assertNever(table);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// The H4 gate core (Task 1.1 / 1.4).
// ─────────────────────────────────────────────────────────────────────────────

/** A minimal admin-query signature so the gate can be exercised with fakes too. */
export type AdminQueryFn = <T extends Record<string, unknown>>(
  sql: string,
  params?: readonly unknown[],
) => Promise<T[]>;

/**
 * Well-known SYSTEM / platform schemas the gate NEVER treats as tenant-owned
 * application surface. Everything NOT in this set (and not matching a system
 * prefix) is treated as an application schema and IS subject to the tenant-owned
 * detection — fail-closed: an unknown schema is assumed application-owned, not
 * waved through. Keep `_realtime`/`realtime`/`auth`/`storage` here so their
 * `tenants`-named or tenant-scoped internal tables never count.
 */
const SYSTEM_SCHEMAS = new Set([
  "pg_catalog",
  "pg_toast",
  "information_schema",
  "auth",
  "storage",
  "realtime",
  "_realtime",
  "_analytics",
  "extensions",
  "vault",
  "graphql",
  "graphql_public",
  "net",
  "cron",
  "supabase_functions",
  "supabase_migrations",
  "pgsodium",
  "pgsodium_masks",
  "pgbouncer",
]);

/** A schema prefix that is always system/platform (e.g. `pg_temp_3`, `pg_toast_temp`). */
function isSystemSchema(nspname: string): boolean {
  return (
    SYSTEM_SCHEMAS.has(nspname) ||
    nspname.startsWith("pg_") ||
    nspname.startsWith("supabase_") ||
    nspname.startsWith("pgsodium")
  );
}

/**
 * Introspect the LIVE schema and return the set of TENANT-OWNED application tables
 * (see the module header for the precise, fail-closed definition). It is NOT bound
 * to the `tenant_id` NAMING convention: it unions THREE tenancy signals —
 *
 *   (a) any APPLICATION table carrying a direct `tenant_id` column;
 *   (b) any APPLICATION table with a FOREIGN KEY targeting `public.tenants`
 *       REGARDLESS of the FK column's name (catches `org_id`/`company_id`/etc.);
 *   (c) the literal `tenants` ROOT (no `tenant_id` column — the load-bearing edge
 *       case a naive heuristic drops).
 *
 * "Application table" = a base table (relkind 'r') OR a PARTITIONED PARENT
 * (relkind 'p') in a non-SYSTEM schema, EXCLUDING child partitions (relispartition)
 * — so a partitioned tenant table enrolls as its parent, and its child partitions
 * do NOT surface as spurious "unenrolled" tables. System/platform schemas (auth,
 * storage, realtime, `_realtime`, pg_*, supabase_*, etc.) are excluded so an
 * internal `_realtime.tenants` never counts (fail-closed: an UNKNOWN schema is
 * treated as application-owned, not waved through).
 *
 * Returns BARE table names (the enrolled inventory keys on bare names; today every
 * tenant-owned table is in `public`). A future non-`public` application table would
 * be reported here too, surfacing in the gate until enrolled.
 *
 * CURRENT SCOPE + EXTENSION TRIGGER (G-8b, deliberate non-action — epic-2 hardening):
 * the three signals above (direct `tenant_id`, FK to `public.tenants`, the `tenants`
 * root) fully cover EVERY Phase-A tenant-owned table — all three are `public` BASE
 * tables with a direct `tenant_id` (or the root). Deeper introspection (VIEWS /
 * materialized views, TRANSITIVE FK chains to a non-`tenants` tenant-owned parent,
 * non-`public` application schemas, schema-qualified name collisions) is INTENTIONALLY
 * NOT built: it is forward-looking gate-DX with nothing in the current schema to test
 * against, and adding it now would be untestable over-engineering. EXTEND THIS
 * INTROSPECTION ONLY WHEN the first view-shaped, transitively-scoped, partitioned, or
 * non-`public` tenant table is actually proposed — the H4 gate fails closed on any
 * UNKNOWN schema today, so a genuinely novel table cannot silently slip the net before
 * then. (Ledger: deferred-work.md, "H4 introspection still has coverage gaps beyond
 * direct-`tenant_id` public base tables".)
 */
export async function introspectTenantOwnedTables(
  adminQuery: AdminQueryFn,
): Promise<Set<string>> {
  // (a) Every APPLICATION table (base table or partitioned parent, non-system
  // schema, NOT a child partition) carrying a direct `tenant_id` column — the §6
  // Phase A convention.
  const carriers = await adminQuery<{ nspname: string; table_name: string }>(
    `select n.nspname as nspname, c.relname as table_name
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a
         on a.attrelid = c.oid
        and a.attname = 'tenant_id'
        and a.attnum > 0
        and not a.attisdropped
      where c.relkind in ('r', 'p')
        and not c.relispartition`,
  );

  // (b) Every APPLICATION table with a FOREIGN KEY whose target relation is
  // `public.tenants`, REGARDLESS of the local FK column's name — so a tenant table
  // scoped via a differently-named FK (`org_id`, `company_id`, …) is still caught.
  // `confrelid` is the referenced relation; we resolve it to the `tenants` root.
  const fkRefs = await adminQuery<{ nspname: string; table_name: string }>(
    `select n.nspname as nspname, c.relname as table_name
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_class fc on fc.oid = con.confrelid
       join pg_namespace fn on fn.oid = fc.relnamespace
      where con.contype = 'f'
        and fn.nspname = 'public'
        and fc.relname = $1
        and c.relkind in ('r', 'p')
        and not c.relispartition`,
    [TENANT_ROOT_TABLE],
  );

  const owned = new Set<string>();
  for (const r of [...carriers, ...fkRefs]) {
    if (isSystemSchema(r.nspname)) continue; // fail-closed: unknown schema = app-owned
    if (r.table_name === TENANT_ROOT_TABLE && r.nspname !== "public") continue;
    owned.add(r.table_name);
  }

  // (c) The literal `tenants` ROOT — tenant-owned but carries NO tenant_id column
  // and has no FK to itself, so (a)/(b) never return it. Union it in EXPLICITLY,
  // but only if it actually exists as a `public` base/partitioned table (so the gate
  // reflects the real schema, never a phantom). The documented edge-case handling.
  const rootRows = await adminQuery<{ exists: boolean }>(
    `select exists(
       select 1 from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname = $1
         and c.relkind in ('r', 'p')
         and not c.relispartition
     ) as exists`,
    [TENANT_ROOT_TABLE],
  );
  if (rootRows[0]?.exists) owned.add(TENANT_ROOT_TABLE);

  return owned;
}

/**
 * PURE comparison core (Task 1.4) — mirrors the resolve-tenant-context-core
 * pure-core pattern so the gate's bite is unit-testable with fakes (no DB, no
 * scratch branch). Returns the SORTED, de-duped list of tables that are
 * tenant-owned IN SCHEMA but NOT enrolled (the H4 violation set).
 *
 * Guards ONLY the `owned ⊆ enrolled` direction: an enrolled-but-not-yet-in-schema
 * table is harmless here (coverage that landed early), so it is NOT reported.
 *
 * @param owned    the tenant-owned tables present in the live schema.
 * @param enrolled the tables enrolled in the parameterized negative suite.
 */
export function findUnenrolledTenantTables(
  owned: Iterable<string>,
  enrolled: Iterable<string>,
): string[] {
  const enrolledSet = new Set(enrolled);
  const missing = new Set<string>();
  for (const table of owned) {
    if (!enrolledSet.has(table)) missing.add(table);
  }
  return [...missing].sort();
}

/**
 * Build the developer-facing failure message for an unenrolled tenant-owned table
 * (Task 1.3 / P3 DX). Names the offending table(s) AND points at the inventory
 * module to update — so a future contributor knows EXACTLY what enrollment
 * requires, not just that "something" is uncovered.
 *
 * The message names BOTH metadata seams an enrollee must wire: the cross-tenant
 * helpers (`spoofedRowFor`/`tenantBFilter`/`hijackMutationFor`) AND the anon-path
 * helpers (`anonRowFor`/`anonFilterFor`/`anonMutationFor`). Omitting the anon
 * helpers would let a freshly-enrolled table fall through to a membership-shaped
 * default in the anonymous-path negatives (`anon-path-isolation.rls.test.ts`),
 * silently weakening that suite. [DX#3, epic-2 hardening; supersedes the iter-2
 * "enrollment guidance omits the anon-path metadata helpers" deferral]
 */
export function unenrolledTablesMessage(unenrolled: readonly string[]): string {
  return (
    `H4 RLS coverage gate (architecture §18): ${unenrolled.length} tenant-owned ` +
    `table(s) NOT enrolled in the parameterized cross-tenant negative suite: ` +
    `${unenrolled.join(", ")}. Every tenant-owned table MUST be enrolled before ` +
    `merge — add it to TENANT_TABLES in ${INVENTORY_MODULE_PATH} AND supply BOTH ` +
    `metadata seams: (1) the cross-tenant helpers spoofedRowFor/tenantBFilter/` +
    `hijackMutationFor, AND (2) the anon-path helpers anonRowFor/anonFilterFor/` +
    `anonMutationFor (so the anonymous-path negatives in ` +
    `anon-path-isolation.rls.test.ts cover the new table instead of falling ` +
    `through to a membership-shaped default). Then re-run the harness.`
  );
}
