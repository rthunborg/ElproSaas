/**
 * Story 2.2 — AUTHORITATIVE cross-tenant RLS negatives (AC2 / R-001, P0).
 *
 * Proves Tenant A's authenticated tenant_admin cannot READ, INSERT (spoof),
 * UPDATE, or DELETE Tenant B rows through the anon-key app path. Data-driven over
 * the SHARED tenant-table inventory (`tenant-table-inventory.ts`) — the single
 * source of truth the H4 inventory gate also reads (Story 2.4, Task 3.1). A new
 * tenant-owned table enlists by enrolling in `TENANT_TABLES` there, NOT by a
 * copy-pasted parallel suite.
 *
 * Story 2.3 enrolled `audit_events` (now part of the shared inventory). A real
 * Tenant B audit row is seeded so the cross-tenant SELECT has a concrete row to be
 * denied. NOTE: `audit_events` differs from tenants/memberships in two ways the
 * spoof/insert path accounts for: (a) `authenticated` HAS a SELECT grant on it
 * (RLS narrows to own-tenant → empty set, no 42501 on read), and (b) the app path
 * has NO INSERT grant (writes go via the record_audit_event DEFINER), so the
 * spoof-INSERT is denied at the privilege layer (42501) exactly like the others.
 *
 * Denial assertions pin the actual fail-closed layer: normally RLS/privilege `42501`,
 * with generic `QV409` for Story 10.6 quote-family triggers that must resolve a parent
 * before RLS WITH CHECK. Independent re-reads still prove every foreign row is unchanged.
 *
 * Runs against the LOCAL Supabase stack only; skips when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTwoTenantFixture,
  makeAuthedServerClient,
  cleanupFixture,
  adminInsertCustomer,
  adminInsertFacility,
  adminInsertContact,
  adminInsertCompanySettings,
  adminInsertQuoteTerms,
  adminInsertWorkRole,
  adminInsertArticle,
  adminInsertCalculation,
  adminInsertSection,
  adminInsertRow,
  adminInsertFile,
  adminInsertFileLink,
  adminInsertTenantCounter,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionAttachment,
  adminInsertQuoteEvent,
  adminInsertQuoteReviewAuthorization,
  adminInsertQuoteAcceptance,
  adminInsertQuoteLostReason,
  adminInsertQuoteFollowUp,
  adminInsertJob,
  adminInsertJobEvent,
  adminUpdateQuoteVersionStatus,
  adminSelectCrmRowById,
  adminSelectSettingsLabel,
  adminSelectPricingRow,
  adminSelectCalcLabel,
  adminSelectFileLabel,
  adminSelectQuoteLabel,
  adminSelectAcceptanceLabel,
  adminSelectQuoteVersionLines,
  type TwoTenantFixture,
  type TestServerClient,
} from "../../factories/tenants";
import { adminInsertAuditEvent } from "../../factories/audit-events";
import { adminQuery } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import {
  TENANT_TABLES,
  spoofedRowFor,
  tenantBFilter,
  hijackMutationFor,
  updateDenialKind,
  rlsInvisibleLabelColumn,
  type InventoryContext,
} from "./tenant-table-inventory";

let stackUp = false;
let fixture: TwoTenantFixture;
let a: TestServerClient; // adminA's authenticated anon-key client
let tenantBAuditId: string; // a seeded Tenant B audit row (cross-tenant target)
let tenantBCustomerId: string; // a seeded Tenant B customer (cross-tenant CRM target)
let tenantBFacilityId: string; // a seeded Tenant B facility (cross-tenant CRM target)
let tenantBContactId: string; // a seeded Tenant B contact (cross-tenant CRM target)
let tenantBCompanySettingsId: string; // a seeded Tenant B company_settings (3.3 target)
let tenantBQuoteTermsId: string; // a seeded Tenant B quote_terms (3.3 target)
let tenantBWorkRoleId: string; // a seeded Tenant B work_role (3.4 pricing target)
let tenantBArticleId: string; // a seeded Tenant B article (3.4 pricing target)
let tenantBCalculationId: string; // a seeded Tenant B calc (5.1 calculation target)
let tenantBCalcSectionId: string; // a seeded Tenant B section (5.1 calculation target)
let tenantBCalcRowId: string; // a seeded Tenant B row (5.1 calculation target)
let tenantBFileId: string; // a seeded Tenant B file (8.1 file target + file_links parent)
let tenantBFileLinkId: string; // a seeded Tenant B file_link (8.1 file target)
let tenantBTenantCounterId: string; // a seeded Tenant B counter (6.1 quote target)
let tenantBQuoteId: string; // a seeded Tenant B quote (6.1 target + version/event parent)
let tenantBQuoteSourceCalcId: string; // a seeded Tenant B source calc (version composite FK)
let tenantBQuoteVersionId: string; // a seeded Tenant B version (6.1 target + line/attach parent)
let tenantBQuoteVersionLineId: string; // a seeded Tenant B line (6.1 target)
let tenantBQuoteVersionAttachmentId: string; // a seeded Tenant B attachment (6.1 target)
let tenantBQuoteEventId: string; // a seeded Tenant B event (6.1 target)
let tenantBQuoteReviewAuthorizationId: string; // a seeded Tenant B review authority (10.8 target)
let tenantBQuoteAcceptanceId: string; // a seeded Tenant B acceptance (7.1 target + job parent)
let tenantBJobId: string; // a seeded Tenant B job (7.1 target + job_event parent)
let tenantBJobEventId: string; // a seeded Tenant B job event (7.1 target)
let tenantBQuoteLostReasonId: string; // a seeded Tenant B lost reason (10.2 target)
let tenantBQuoteFollowUpId: string; // a seeded Tenant B follow-up (10.3 target)
let tenantBAdminOperationId: string; // a seeded Tenant B operation (11.3 target)
let ctx: InventoryContext; // shared-inventory context (fixture + the seeded ids)

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  a = await makeAuthedServerClient(fixture.adminA);
  // Seed a REAL Tenant B audit row via the privileged path so the cross-tenant
  // SELECT/UPDATE/DELETE has a concrete target that must stay invisible to A.
  tenantBAuditId = await adminInsertAuditEvent({
    tenant_id: fixture.tenantB.id,
    actor_user_id: fixture.adminB.id,
    command: "b.command",
    event_type: "b.event",
    target_type: "tenant",
    target_id: fixture.tenantB.id,
    correlation_id: crypto.randomUUID(),
    metadata: { reason: "tenant-b-seed" },
  });
  // Seed REAL Tenant B CRM rows (customer → facility → contact) via the privileged
  // BYPASSRLS path so the customers/facilities/contacts cross-tenant negatives target
  // a CONCRETE Tenant B row (never a non-existent id that would deny vacuously). The
  // composite same-tenant FKs force the child rows into the SAME Tenant B, so the
  // parent/child chain is consistent. cleanupFixture's tenant-delete cascades these.
  tenantBCustomerId = await adminInsertCustomer({
    tenant_id: fixture.tenantB.id,
    customer_type: "company",
    display_name: "tenant-b-customer-seed",
    org_nr: "556000-9999",
  });
  tenantBFacilityId = await adminInsertFacility({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    name: "tenant-b-facility-seed",
  });
  tenantBContactId = await adminInsertContact({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    facility_id: tenantBFacilityId,
    name: "tenant-b-contact-seed",
  });
  // Seed REAL Tenant B settings rows (Story 3.3) so the company_settings/quote_terms
  // cross-tenant negatives target a CONCRETE Tenant B row. The unchanged re-read
  // asserts these seed labels were NOT overwritten by Tenant A's denied UPDATE.
  tenantBCompanySettingsId = await adminInsertCompanySettings({
    tenant_id: fixture.tenantB.id,
    company_name: "tenant-b-company-seed",
  });
  tenantBQuoteTermsId = await adminInsertQuoteTerms({
    tenant_id: fixture.tenantB.id,
    terms_text: "tenant-b-terms-seed (platshållartext)",
  });
  // Seed REAL Tenant B pricing rows (Story 3.4) so the work_roles/articles cross-tenant
  // negatives target a CONCRETE Tenant B row. The unchanged re-read asserts these seed
  // labels were NOT overwritten by Tenant A's denied UPDATE. The article seed carries
  // ONLY the minimal manual columns (HARD no-supplier-scope).
  tenantBWorkRoleId = await adminInsertWorkRole({
    tenant_id: fixture.tenantB.id,
    display_name: "tenant-b-role-seed",
  });
  tenantBArticleId = await adminInsertArticle({
    tenant_id: fixture.tenantB.id,
    name: "tenant-b-article-seed",
  });
  // Seed a REAL Tenant B CALCULATION chain (calc → section → row, Story 5.1) so the
  // calculations/calculation_sections/calculation_rows cross-tenant negatives target a
  // CONCRETE Tenant B row (never a non-existent id that would deny vacuously), AND so
  // the section/row spoof INSERTs have a real Tenant B parent to reference. The composite
  // same-tenant FKs force the child rows into the SAME Tenant B, so the chain is
  // consistent. cleanupFixture's tenant-delete cascades these. The unchanged re-read
  // asserts these seed labels were NOT overwritten by Tenant A's denied UPDATE.
  tenantBCalculationId = await adminInsertCalculation({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
    title: "tenant-b-calc-seed",
  });
  tenantBCalcSectionId = await adminInsertSection({
    tenant_id: fixture.tenantB.id,
    calculation_id: tenantBCalculationId,
    title: "tenant-b-section-seed",
  });
  tenantBCalcRowId = await adminInsertRow({
    tenant_id: fixture.tenantB.id,
    section_id: tenantBCalcSectionId,
    row_type: "labor",
    unit_cost_ore: 45000,
    unit_sell_ore: 85000,
    // label is the rls-invisible re-read column for calculation_rows; a recognizable
    // seed token so the unchanged re-read can assert it was not overwritten.
  });
  // Seed a REAL Tenant B FILE + FILE_LINK (Story 8.1) so the files/file_links
  // cross-tenant negatives target a CONCRETE Tenant B row, AND so the file_links spoof
  // INSERT has a real Tenant B file parent (its composite same-tenant FK). The file
  // fixture carries METADATA SHAPE only — an anonymized display name, NO raw content,
  // NO PII (R-819). The link's purpose ('crm_document') is the rls-invisible re-read
  // column; the hijack sets a different purpose so the unchanged re-read is meaningful.
  tenantBFileId = await adminInsertFile({
    tenant_id: fixture.tenantB.id,
    display_name: "tenant-b-file-seed.pdf",
    lifecycle_state: "linked",
  });
  tenantBFileLinkId = await adminInsertFileLink({
    tenant_id: fixture.tenantB.id,
    file_id: tenantBFileId,
    owner_type: "customer",
    owner_id: tenantBCustomerId,
    purpose: "crm_document",
  });
  // Seed a REAL Tenant B QUOTE chain (counter → quote → version → line → attachment →
  // event, Story 6.1) so the six quote-table cross-tenant negatives target a CONCRETE
  // Tenant B row (never a non-existent id that would deny vacuously), AND so the child
  // spoof INSERTs have a real Tenant B parent to reference. The composite same-tenant FKs
  // force the whole chain into the SAME Tenant B (quote → customers; version → quote +
  // calculations; line/attachment → version; attachment → files; event → quote), so it is
  // consistent. cleanupFixture's tenant-delete cascades these. The quote fixtures carry
  // DISPLAY/METADATA SHAPE only — anonymized names + integer öre/bp, NO PII.
  tenantBTenantCounterId = await adminInsertTenantCounter({
    tenant_id: fixture.tenantB.id,
    counter_name: "quote_number",
    current_value: 1,
  });
  tenantBQuoteId = await adminInsertQuote({
    tenant_id: fixture.tenantB.id,
    customer_id: tenantBCustomerId,
  });
  tenantBQuoteSourceCalcId = tenantBCalculationId; // a REAL Tenant B calc (version FK)
  tenantBQuoteVersionId = await adminInsertQuoteVersion({
    tenant_id: fixture.tenantB.id,
    quote_id: tenantBQuoteId,
    calculation_id: tenantBQuoteSourceCalcId,
    company_name: "tenant-b-version-seed",
    accepted_price_ore: 125000,
  });
  const tenantBVersionLines = await adminSelectQuoteVersionLines(tenantBQuoteVersionId);
  tenantBQuoteVersionLineId = String(tenantBVersionLines[0]?.id ?? "");
  if (!tenantBQuoteVersionLineId) {
    throw new Error("cross-tenant fixture: canonical V2 quote line missing");
  }
  tenantBQuoteVersionAttachmentId = await adminInsertQuoteVersionAttachment({
    tenant_id: fixture.tenantB.id,
    quote_version_id: tenantBQuoteVersionId,
    file_id: tenantBFileId,
    display_name: "tenant-b-attachment-seed.pdf",
  });
  tenantBQuoteEventId = await adminInsertQuoteEvent({
    tenant_id: fixture.tenantB.id,
    quote_id: tenantBQuoteId,
    quote_version_id: tenantBQuoteVersionId,
    event_type: "created",
  });
  tenantBQuoteReviewAuthorizationId = await adminInsertQuoteReviewAuthorization({
    tenant_id: fixture.tenantB.id,
    actor_user_id: fixture.adminB.id,
    quote_id: tenantBQuoteId,
    quote_version_id: tenantBQuoteVersionId,
  });
  // Seed a REAL Tenant B ACCEPTANCE → JOB → JOB_EVENT chain (Story 7.1) so the three new
  // commitment-table cross-tenant negatives target a CONCRETE Tenant B row (never a
  // non-existent id that would deny vacuously), AND so the job/job_event spoof INSERTs have a
  // real Tenant B parent to reference. The DB has NO sent-state constraint on quote_acceptances
  // (that gate is command-only), so a draft version is a valid FK target — but flip it to sent
  // for realism (BYPASSRLS bypasses the sent-lock trigger). The composite same-tenant FKs force
  // the whole chain into the SAME Tenant B. cleanupFixture's tenant-delete cascades these. The
  // fixtures carry DISPLAY/METADATA SHAPE only — anonymized names + integer öre < 10 digits, NO PII.
  await adminUpdateQuoteVersionStatus(tenantBQuoteVersionId, "sent");
  tenantBQuoteAcceptanceId = await adminInsertQuoteAcceptance({
    tenant_id: fixture.tenantB.id,
    quote_id: tenantBQuoteId,
    quote_version_id: tenantBQuoteVersionId,
    accepted_price_ore: 125000,
    source_sent_total_ore: 125000,
  });
  tenantBJobId = await adminInsertJob({
    tenant_id: fixture.tenantB.id,
    quote_acceptance_id: tenantBQuoteAcceptanceId,
    quote_version_id: tenantBQuoteVersionId,
    customer_id: tenantBCustomerId,
    title: "tenant-b-job-seed",
  });
  tenantBJobEventId = await adminInsertJobEvent({
    tenant_id: fixture.tenantB.id,
    job_id: tenantBJobId,
    event_type: "created",
  });
  // Seed a REAL Tenant B LOST REASON (Story 10.2) so the quote_lost_reasons cross-tenant negative
  // targets a CONCRETE Tenant B row (never a non-existent id that would deny vacuously). It
  // references the SAME Tenant B quote + version (composite same-tenant FKs). quote_lost_reasons is
  // INSERT-ONLY (no UPDATE grant), so the cross-tenant UPDATE negative is a privilege denial (42501);
  // the row carries NO money/öre column (Story 10.2 Stop Condition).
  tenantBQuoteLostReasonId = await adminInsertQuoteLostReason({
    tenant_id: fixture.tenantB.id,
    quote_id: tenantBQuoteId,
    quote_version_id: tenantBQuoteVersionId,
    outcome: "forlorad",
    category: "pris",
  });
  // Seed a REAL Tenant B FOLLOW-UP (Story 10.3) so the quote_follow_ups cross-tenant negative targets
  // a CONCRETE Tenant B row (never a non-existent id that would deny vacuously). It references the
  // SAME Tenant B quote + version (composite same-tenant FKs). quote_follow_ups is UPDATE-able (has an
  // UPDATE grant), so the cross-tenant UPDATE negative is the "rls-invisible" mechanism (zero rows +
  // an unchanged `note` re-read); the seed note is a recognizable token proving the hijack never
  // landed. The row carries NO money/öre column (Story 10.3 Stop Condition).
  tenantBQuoteFollowUpId = await adminInsertQuoteFollowUp({
    tenant_id: fixture.tenantB.id,
    quote_id: tenantBQuoteId,
    quote_version_id: tenantBQuoteVersionId,
    due_date: "2026-08-01",
    note: "tenant-b-followup-seed",
    status: "open",
  });
  // Seed a concrete Tenant B operation so the membership_admin_operations
  // cross-tenant SELECT/UPDATE/DELETE checks cannot pass against an empty table.
  await adminQuery(
    "insert into public.membership_admin_operations (id, tenant_id, actor_user_id, action, outcome) values ($1,$2,$3,'invite','succeeded')",
    [crypto.randomUUID(), fixture.tenantB.id, fixture.adminB.id],
  );
  await adminQuery("insert into public.notifications (tenant_id, recipient_user_id, category, title, body, route) values ($1, $2, 'quote.follow_up_due', 'Tenant B notification', 'seed', '/notifications')", [fixture.tenantB.id, fixture.adminB.id]);
  await adminQuery("insert into public.notification_preferences (tenant_id, user_id, category, channel, enabled) values ($1, $2, 'quote.follow_up_due', 'in_app', true)", [fixture.tenantB.id, fixture.adminB.id]);
  const operationSeed = await adminQuery<{ id: string }>(
    `insert into public.membership_admin_operations
       (id, tenant_id, actor_user_id, membership_id, action, outcome)
     values (gen_random_uuid(), $1, $2,
       (select id from public.tenant_memberships where tenant_id = $1 and user_id = $2),
       'disable', 'succeeded') returning id`,
    [fixture.tenantB.id, fixture.adminB.id],
  );
  tenantBAdminOperationId = String(operationSeed[0]?.id ?? "");
  // VACUITY GUARD (DX#4, epic-2 hardening): the audit_events cross-tenant negatives
  // filter Tenant B's row by `id = tenantBAuditId`. If the seed ever returned without
  // a real id, `.eq("id", undefined/null)` would match NOTHING and the SELECT/UPDATE/
  // DELETE denials would pass VACUOUSLY (a non-existent row trivially denies/empties).
  // Assert the seed produced a real id BEFORE any denial assertion runs, so a broken
  // seed fails loudly here instead of green-by-vacuity. This does NOT weaken the
  // denial mechanism — the per-table tests still assert the 42501 SQLSTATE.
  if (!tenantBAuditId) {
    throw new Error(
      "cross-tenant audit seed produced no id (tenantBAuditId is null/undefined) — " +
        "the audit_events cross-tenant negatives would pass VACUOUSLY against a " +
        "non-existent row. Failing loudly so the seed is fixed, not silently green.",
    );
  }
  // Same vacuity guard for the seeded CRM + settings rows: a missing id would make the
  // cross-tenant negatives target a non-existent row and pass vacuously.
  if (!tenantBCustomerId || !tenantBFacilityId || !tenantBContactId) {
    throw new Error(
      "cross-tenant CRM seed produced no id (customer/facility/contact) — the CRM " +
        "cross-tenant negatives would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBCompanySettingsId || !tenantBQuoteTermsId) {
    throw new Error(
      "cross-tenant settings seed produced no id (company_settings/quote_terms) — the " +
        "settings cross-tenant negatives would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBWorkRoleId || !tenantBArticleId) {
    throw new Error(
      "cross-tenant pricing seed produced no id (work_roles/articles) — the pricing " +
        "cross-tenant negatives would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBCalculationId || !tenantBCalcSectionId || !tenantBCalcRowId) {
    throw new Error(
      "cross-tenant calculation seed produced no id (calculations/calculation_sections/" +
        "calculation_rows) — the calc cross-tenant negatives would pass VACUOUSLY " +
        "against a non-existent row.",
    );
  }
  if (!tenantBFileId || !tenantBFileLinkId) {
    throw new Error(
      "cross-tenant file seed produced no id (files/file_links) — the file cross-tenant " +
        "negatives would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (
    !tenantBTenantCounterId ||
    !tenantBQuoteId ||
    !tenantBQuoteVersionId ||
    !tenantBQuoteVersionLineId ||
    !tenantBQuoteVersionAttachmentId ||
    !tenantBQuoteEventId ||
    !tenantBQuoteReviewAuthorizationId
  ) {
    throw new Error(
      "cross-tenant quote seed produced no id (tenant_counters/quotes/quote_versions/" +
        "quote_version_lines/quote_version_attachments/quote_events) — the quote " +
        "cross-tenant negatives would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBQuoteAcceptanceId || !tenantBJobId || !tenantBJobEventId) {
    throw new Error(
      "cross-tenant acceptance seed produced no id (quote_acceptances/jobs/job_events) — the " +
        "acceptance cross-tenant negatives would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBQuoteLostReasonId) {
    throw new Error(
      "cross-tenant lost-reason seed produced no id (quote_lost_reasons) — the lost-reason " +
        "cross-tenant negative would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBQuoteFollowUpId) {
    throw new Error(
      "cross-tenant follow-up seed produced no id (quote_follow_ups) — the follow-up " +
        "cross-tenant negative would pass VACUOUSLY against a non-existent row.",
    );
  }
  if (!tenantBAdminOperationId) {
    throw new Error("cross-tenant operation seed produced no id — membership_admin_operations negatives would pass VACUOUSLY.");
  }
  ctx = {
    fixture,
    tenantBAuditId,
    tenantBCustomerId,
    tenantBFacilityId,
    tenantBContactId,
    tenantBCompanySettingsId,
    tenantBQuoteTermsId,
    tenantBWorkRoleId,
    tenantBArticleId,
    tenantBCalculationId,
    tenantBCalcSectionId,
    tenantBCalcRowId,
    tenantBFileId,
    tenantBFileLinkId,
    tenantBTenantCounterId,
    tenantBQuoteId,
    tenantBQuoteSourceCalcId,
    tenantBQuoteVersionId,
    tenantBQuoteVersionLineId,
    tenantBQuoteVersionAttachmentId,
    tenantBQuoteEventId,
    tenantBQuoteReviewAuthorizationId,
    tenantBQuoteAcceptanceId,
    tenantBJobId,
    tenantBJobEventId,
    tenantBQuoteLostReasonId,
    tenantBQuoteFollowUpId,
    tenantBAdminOperationId,
  };
});

afterAll(async () => {
  if (stackUp && fixture) await cleanupFixture(fixture);
});

describe("Cross-tenant RLS isolation — data-driven over the shared inventory (AC2 / R-001)", () => {
  // Story 11.2 moves audited Phase A mutations behind checked transactional
  // wrappers and revokes their direct authenticated DML grants. Keep that
  // closure explicit instead of mistaking its 42501 for RLS invisibility. The
  // SELECT cases above still prove the concrete Tenant B rows remain invisible.
  const directDmlRevokedTables = new Set([
    "customers",
    "facilities",
    "contacts",
    "company_settings",
    "quote_terms",
    "work_roles",
    "articles",
    "files",
    "file_links",
    "quote_acceptances",
    "jobs",
    "job_events",
    "quote_follow_ups",
  ]);
  // Provisioning request and invitation facts are tenant-keyed for H4 coverage,
  // but they are platform-command internals: normal tenant roles receive no direct
  // SELECT privilege, so denial occurs before RLS row filtering.
  const directReadRevokedTables = new Set([
    "tenant_provisioning_requests",
    "tenant_provisioning_invites",
  ]);

  for (const table of TENANT_TABLES) {
    describe(`table: ${table}`, () => {
      it(`[P0] SELECT: Tenant A admin reads ZERO ${table} rows belonging to Tenant B (no error leak)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { column, value } = tenantBFilter(table, ctx);
        const { data, error } = await a.from(table).select("*").eq(column, value);
        if (directReadRevokedTables.has(table)) {
          expect(error?.code).toBe("42501");
          expect(data).toBeNull();
          return;
        }
        // RLS yields an empty set, NOT an error that confirms existence.
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it(`[P0] INSERT: Tenant A admin cannot INSERT a ${table} row carrying Tenant B ownership (no spoof)`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { error } = await a.from(table).insert(spoofedRowFor(table, ctx));
        // Assert the DENIAL MECHANISM, not a bare non-null error. This includes
        // quote_acceptances: Story 10.8 deliberately revokes its authenticated
        // direct-DML grant, so the spoof is rejected at the privilege layer before
        // any quote-family trigger can run. This is neither a PK/FK collision nor an
        // existence disclosure.
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
      });

      it(`[P0] UPDATE: Tenant A admin cannot UPDATE Tenant B's ${table} rows`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { column, value } = tenantBFilter(table, ctx);
        const { data: affected, error } = await a
          .from(table)
          .update(hijackMutationFor(table))
          .eq(column, value)
          .select();

        // Assert the MECHANISM by the table's grant profile (updateDenialKind), never a
        // vacuous empty set:
        //   - "privilege": `authenticated` has NO UPDATE grant (tenants/memberships/
        //     audit_events — append-only), so the write is denied at the table-privilege
        //     layer (42501). A future regression that GRANTed UPDATE against a
        //     zero-matching USING clause would still produce an empty set and MUST NOT
        //     pass here. `error` is non-null and `data` is null on a denied write.
        //   - "rls-invisible": direct UPDATE remains available only for the
        //     high-churn calculation edit tables. Their foreign rows are hidden by
        //     RLS USING, so the statement matches ZERO rows with NO error (empty
        //     set, not null). The denial is proven by zero-rows-affected PLUS an
        //     INDEPENDENT BYPASSRLS re-read showing the Tenant B row is UNCHANGED.
        if (directDmlRevokedTables.has(table) || updateDenialKind(table) === "privilege") {
          expect(error).not.toBeNull();
          expect(error?.code).toBe("42501");
          expect(affected).toBeNull();
          if (table === "quote_acceptances") {
            // Privilege denial is deliberate (Story 10.8), but still prove the real
            // foreign acceptance exists and its immutable channel was not overwritten.
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectAcceptanceLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            expect(row?.label).toBeNull();
          }
        } else {
          // rls-invisible calculation editing rows.
          expect(error).toBeNull();
          expect(affected).toEqual([]); // zero rows affected — the foreign row is hidden
          // Independent re-read proves the row exists and its label is UNCHANGED (the
          // hijack value "hijacked-by-tenant-a" never landed). CRM and settings tables
          // use different readback helpers; the inventory names the label column.
          if (table === "company_settings" || table === "quote_terms") {
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectSettingsLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            expect(row?.label).not.toBe("hijacked-by-tenant-a");
          } else if (table === "work_roles" || table === "articles") {
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectPricingRow(table, labelColumn, value);
            expect(row).not.toBeNull();
            expect(row?.label).not.toBe("hijacked-by-tenant-a");
          } else if (
            table === "calculations" ||
            table === "calculation_sections" ||
            table === "calculation_rows"
          ) {
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectCalcLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            expect(row?.label).not.toBe("hijacked-by-tenant-a");
        } else if (table === "notifications" || table === "notification_preferences") {
          const rows = await adminQuery<{ read_at: string | null; enabled: boolean | null }>(
            table === "notifications"
              ? "select read_at, null::boolean as enabled from public.notifications where tenant_id = $1"
              : "select null::timestamptz::text as read_at, enabled from public.notification_preferences where tenant_id = $1",
            [value],
          );
          expect(rows).toHaveLength(1);
          if (table === "notifications") expect(rows[0]?.read_at).toBeNull();
          else expect(rows[0]?.enabled).toBe(true);
        } else if (table === "files" || table === "file_links") {
            // files hijack sets display_name = "hijacked-by-tenant-a"; file_links hijack
            // sets purpose = "job_evidence" (a DIFFERENT valid value than the seed's
            // "crm_document"). Prove the seed value was NOT overwritten.
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectFileLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            if (table === "files") {
              expect(row?.label).not.toBe("hijacked-by-tenant-a");
            } else {
              expect(row?.label).not.toBe("job_evidence");
              expect(row?.label).toBe("crm_document");
            }
          } else if (
            table === "tenant_counters" ||
            table === "quotes" ||
            table === "quote_versions" ||
            table === "quote_version_lines" ||
            table === "quote_version_attachments" ||
            table === "quote_events"
          ) {
            // The quote-table hijacks set a distinct value per table (current_value=999999
            // / archived_at=2099 / company_name / label / display_name / channel). Prove
            // the seed value was NOT overwritten by Tenant A's denied UPDATE.
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectQuoteLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            if (table === "tenant_counters") {
              // The seed current_value is 1; the hijack is 999999 (as text: "999999").
              expect(row?.label).not.toBe("999999");
            } else if (table === "quotes" || table === "quote_events") {
              // The seed archived_at/channel is NULL — the hijack never landed.
              expect(row?.label).toBeNull();
            } else {
              expect(row?.label).not.toBe("hijacked-by-tenant-a");
            }
          } else if (table === "quote_follow_ups") {
            // Story 10.3: UPDATE-able ("rls-invisible"). The hijack sets note = "hijacked-by-tenant-a";
            // prove the seed value ("tenant-b-followup-seed") was NOT overwritten by A's denied UPDATE.
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectQuoteLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            expect(row?.label).not.toBe("hijacked-by-tenant-a");
            expect(row?.label).toBe("tenant-b-followup-seed");
          } else if (
            table === "quote_acceptances" ||
            table === "jobs" ||
            table === "job_events"
          ) {
            // The acceptance/job hijacks set a distinct value per table (notes / title /
            // channel). Prove the seed value was NOT overwritten by Tenant A's denied UPDATE.
            const labelColumn = rlsInvisibleLabelColumn(table);
            const row = await adminSelectAcceptanceLabel(table, labelColumn, value);
            expect(row).not.toBeNull();
            if (table === "quote_acceptances" || table === "job_events") {
              // The seed notes/channel is NULL — the hijack ("hijacked-by-tenant-a") never landed.
              expect(row?.label).toBeNull();
            } else {
              // jobs: the seed title is "tenant-b-job-seed" — the hijack never landed.
              expect(row?.label).not.toBe("hijacked-by-tenant-a");
              expect(row?.label).toBe("tenant-b-job-seed");
            }
          } else {
            const crmTable = table as "customers" | "facilities" | "contacts";
            const row = await adminSelectCrmRowById(crmTable, value);
            expect(row).not.toBeNull();
            const label = crmTable === "customers" ? row?.display_name : row?.name;
            expect(label).not.toBe("hijacked-by-tenant-a");
          }
        }
      });

      it(`[P0] DELETE: Tenant A admin cannot DELETE Tenant B's ${table} rows`, async (testCtx) => {
        if (skipUnlessStack(testCtx, stackUp)) return;
        const { column, value } = tenantBFilter(table, ctx);
        const { data: deleted, error } = await a
          .from(table)
          .delete()
          .eq(column, value)
          .select();
        // No DELETE grant for the app path → denied at the privilege layer (42501).
        // Assert the mechanism (non-null error, the 42501 SQLSTATE, null data), not a
        // vacuous empty set — matching the adjacent UPDATE/INSERT branches so a
        // regression flipping the denial to an empty result set does not pass
        // (review fix 2026-06-26; [Review][Patch][Med] 2026-06-29).
        expect(error).not.toBeNull();
        expect(error?.code).toBe("42501");
        expect(deleted).toBeNull();
      });
    });
  }

  it("[P0] Tenant B's rows are UNCHANGED after Tenant A's attempts (verified as Tenant B)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const b = await makeAuthedServerClient(fixture.adminB);
    // Tenant B still sees its own tenant + its own active membership intact.
    const { data: tenantRows } = await b
      .from("tenants")
      .select("id, name")
      .eq("id", fixture.tenantB.id);
    expect(tenantRows?.length).toBe(1);

    const { data: membershipRows } = await b
      .from("tenant_memberships")
      .select("tenant_id, status")
      .eq("tenant_id", fixture.tenantB.id);
    expect(membershipRows?.length).toBe(1);
    expect(membershipRows?.[0]?.status).toBe("active");

    // The seeded Tenant B audit row is still present and UNCHANGED for Tenant B
    // (Tenant A's denied UPDATE/DELETE attempts above never mutated it).
    const { data: auditRows } = await b
      .from("audit_events")
      .select("id, command, metadata")
      .eq("id", tenantBAuditId);
    expect(auditRows?.length).toBe(1);
    expect(auditRows?.[0]?.command).toBe("b.command");
    expect(auditRows?.[0]?.metadata).toEqual({ reason: "tenant-b-seed" });
  });
});
