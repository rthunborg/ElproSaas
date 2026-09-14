import { adminQuery } from "../admin-sql";
import { rethrowWithCode } from "./core";
export interface CustomerSeed {
  readonly tenant_id: string;
  readonly customer_type: "private" | "company" | "brf" | "public";
  readonly display_name: string;
  readonly personnummer?: string | null;
  readonly org_nr?: string | null;
}

/** A seed for a `facilities` row (parent customer must already exist, same tenant). */
export interface FacilitySeed {
  readonly tenant_id: string;
  readonly customer_id: string;
  readonly name: string;
}

/** A seed for a `contacts` row (parent customer required; facility optional). */
export interface ContactSeed {
  readonly tenant_id: string;
  readonly customer_id: string;
  readonly facility_id?: string | null;
  readonly name: string;
}

/**
 * Seed ONE `customers` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error.
 */
export async function adminInsertCustomer(seed: CustomerSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.customers
         (tenant_id, customer_type, display_name, personnummer, org_nr)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        seed.tenant_id,
        seed.customer_type,
        seed.display_name,
        seed.personnummer ?? null,
        seed.org_nr ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertCustomer: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Rename a `customers` row's `display_name` via the privileged superuser pg path (BYPASSRLS).
 * Story 7.3 source-of-truth proof (7.3-INT-01): mutate the LIVE customer AFTER a job is created to
 * prove the job detail's FROZEN commitment name (from the version snapshot) does NOT move, while the
 * live-CRM link (jobs.customer_id join) DOES track the rename. THROWS (Postgres `code` preserved) on
 * a DB error so a broken seed fails loudly.
 */
export async function adminUpdateCustomerDisplayName(
  customerId: string,
  displayName: string,
): Promise<void> {
  try {
    await adminQuery(
      `update public.customers set display_name = $2 where id = $1`,
      [customerId, displayName],
    );
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `facilities` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error —
 * including the composite same-tenant FK `23503` if `customer_id`'s tenant differs.
 */
export async function adminInsertFacility(seed: FacilitySeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.facilities (tenant_id, customer_id, name)
       values ($1, $2, $3)
       returning id`,
      [seed.tenant_id, seed.customer_id, seed.name],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertFacility: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `contacts` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error.
 */
export async function adminInsertContact(seed: ContactSeed): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.contacts (tenant_id, customer_id, facility_id, name)
       values ($1, $2, $3, $4)
       returning id`,
      [seed.tenant_id, seed.customer_id, seed.facility_id ?? null, seed.name],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertContact: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/** A CRM row as read back independently (BYPASSRLS) — proves persisted state. */
export interface CrmRowReadback {
  readonly id: string;
  readonly tenant_id: string;
  readonly display_name?: string | null;
  readonly name?: string | null;
  readonly archived_at: string | null;
}

/**
 * Read ONE CRM row back via the privileged superuser pg path (BYPASSRLS),
 * independent of the app/RLS path. Returns `null` if the row does not exist (so a
 * "soft-delete, not hard-delete" negative can prove the row STILL EXISTS). Used by
 * the cross-tenant UPDATE negative (prove the foreign row is UNCHANGED) and the
 * archive negative (prove `archived_at` was set without a hard DELETE).
 *
 * `table` is one of the three CRM tables; `customers`/`facilities`/`contacts` use
 * `display_name`/`name`/`name` respectively for the human label — both are selected
 * so a single readback shape serves all three.
 */
export async function adminSelectCrmRowById(
  table: "customers" | "facilities" | "contacts",
  id: string,
): Promise<CrmRowReadback | null> {
  // `table` is a closed union (never client input), so the interpolation is safe.
  const labelCol = table === "customers" ? "display_name" : "name";
  const rows = await adminQuery<CrmRowReadback>(
    `select id, tenant_id, ${labelCol} as ${labelCol}, archived_at
       from public.${table}
      where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings seed/read helpers (Story 3.3, Task 3.3) — ADDITIVE (B1). Seed REAL
// `company_settings`/`quote_terms` rows via the loopback-gated superuser `pg` pool
// (BYPASSRLS) so the cross-tenant negatives target a CONCRETE Tenant B settings row,
// never a non-existent id that would deny vacuously. Mirror `adminInsertCustomer`:
// THROW on a DB error with the Postgres `code` preserved. Settings tables are
// `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture` tenant-delete
// cascades the seeded rows away — no new teardown path is needed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed ONE `company_settings` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error. The
 * NOT-NULL `default_vat_display`/`vat_rate_bp` are populated with the legacy default;
 * `company_name` carries a recognizable seed token so the cross-tenant unchanged
 * re-read can assert it was not overwritten.
 */
export async function adminInsertCompanySettings(seed: {
  readonly tenant_id: string;
  readonly company_name?: string;
  readonly default_vat_display?: string;
  readonly vat_rate_bp?: number;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.company_settings
         (tenant_id, company_name, default_vat_display, vat_rate_bp)
       values ($1, $2, $3, $4)
       returning id`,
      [
        seed.tenant_id,
        seed.company_name ?? "tenant-b-company-seed",
        seed.default_vat_display ?? "company_togglable",
        seed.vat_rate_bp ?? 2500,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertCompanySettings: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `quote_terms` row via the privileged superuser pg path (BYPASSRLS).
 * Returns the inserted id. THROWS (Postgres `code` preserved) on a DB error. NO
 * approval is set — a seeded row is not-approved by construction (approved_at NULL).
 */
export async function adminInsertQuoteTerms(seed: {
  readonly tenant_id: string;
  readonly terms_text?: string;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.quote_terms (tenant_id, terms_text)
       values ($1, $2)
       returning id`,
      [seed.tenant_id, seed.terms_text ?? "tenant-b-terms-seed (platshållartext)"],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertQuoteTerms: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE settings row's label column back via the privileged superuser pg path
 * (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE
 * negative to prove the foreign settings row is UNCHANGED. `labelColumn` is a closed
 * set (company_name / terms_text) supplied by the inventory, never client input.
 * Returns `null` if the row does not exist.
 */
export async function adminSelectSettingsLabel(
  table: "company_settings" | "quote_terms",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null } | null> {
  // `table` + `labelColumn` are closed/inventory-supplied (never client input).
  const rows = await adminQuery<{ id: string; label: string | null }>(
    `select id, ${labelColumn} as label from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing seed/read helpers (Story 3.4, Task 3.3) — ADDITIVE. Seed REAL
// `work_roles`/`articles` rows via the loopback-gated superuser `pg` pool (BYPASSRLS)
// so the cross-tenant negatives target a CONCRETE Tenant B pricing row, never a
// non-existent id that would deny vacuously. Mirror `adminInsertCompanySettings`:
// THROW on a DB error with the Postgres `code` preserved. Pricing tables are
// `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture` tenant-delete
// cascades the seeded rows away — no new teardown path is needed.
// CRITICAL no-supplier-scope: the article seed carries ONLY the minimal manual columns.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Seed ONE `work_roles` row via the privileged superuser pg path (BYPASSRLS). Returns
 * the inserted id. THROWS (Postgres `code` preserved) on a DB error. The NOT-NULL
 * `display_name` + integer-öre `cost_rate_ore`/`sell_rate_ore` are populated;
 * `display_name` carries a recognizable seed token so the cross-tenant unchanged re-read
 * can assert it was not overwritten.
 */
export async function adminInsertWorkRole(seed: {
  readonly tenant_id: string;
  readonly display_name?: string;
  readonly cost_rate_ore?: number;
  readonly sell_rate_ore?: number;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.work_roles
         (tenant_id, display_name, cost_rate_ore, sell_rate_ore)
       values ($1, $2, $3, $4)
       returning id`,
      [
        seed.tenant_id,
        seed.display_name ?? "tenant-b-role-seed",
        seed.cost_rate_ore ?? 30000,
        seed.sell_rate_ore ?? 60000,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertWorkRole: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Seed ONE `articles` row via the privileged superuser pg path (BYPASSRLS). Returns the
 * inserted id. THROWS (Postgres `code` preserved) on a DB error. ONLY the minimal manual
 * columns (`name`, `unit_price_ore`) are written — NO supplier scope of any kind.
 */
export async function adminInsertArticle(seed: {
  readonly tenant_id: string;
  readonly name?: string;
  readonly unit_price_ore?: number;
}): Promise<string> {
  try {
    const rows = await adminQuery<{ id: string }>(
      `insert into public.articles (tenant_id, name, unit_price_ore)
       values ($1, $2, $3)
       returning id`,
      [
        seed.tenant_id,
        seed.name ?? "tenant-b-article-seed",
        seed.unit_price_ore ?? 500,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error("adminInsertArticle: no id returned");
    return id;
  } catch (error) {
    rethrowWithCode(error);
  }
}

/**
 * Read ONE pricing row's label column back via the privileged superuser pg path
 * (BYPASSRLS), independent of the app/RLS path. Used by the cross-tenant UPDATE negative
 * to prove the foreign pricing row is UNCHANGED, and by the archive negative to prove the
 * row STILL EXISTS (is_active flipped, not hard-deleted). `table`/`labelColumn` are a
 * closed/inventory-supplied set (work_roles.display_name / articles.name), never client
 * input. Returns `null` if the row does not exist.
 */
export async function adminSelectPricingRow(
  table: "work_roles" | "articles",
  labelColumn: string,
  id: string,
): Promise<{ id: string; label: string | null; is_active: boolean } | null> {
  const rows = await adminQuery<{
    id: string;
    label: string | null;
    is_active: boolean;
  }>(
    `select id, ${labelColumn} as label, is_active from public.${table} where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation seed/read helpers (Story 5.1, Task 4.1) — ADDITIVE (B1: add ALONGSIDE
// the existing handles; the two-tenant fixture shape is unchanged, so the
// factory-isolation forward-compat smoke still pins it).
//
// Seed REAL `calculations`/`calculation_sections`/`calculation_rows` rows via the
// loopback-gated superuser `pg` pool (BYPASSRLS) so the cross-tenant/anon negatives
// can target a CONCRETE Tenant B calc row (never a non-existent id that would deny
// vacuously) and the command tests can seed an own-tenant parent to build under.
// Mirror `adminInsertCustomer`: THROW on a DB error with the Postgres `code`
// preserved (e.g. `23514` check-violation / `23503` FK-violation) so a negative can
// assert on the SPECIFIC constraint that bit.
//
// Calc tables are `tenant_id … on delete cascade`, so the EXISTING `cleanupFixture`
// tenant-delete cascades the seeded rows away — no new teardown path is needed.
// ─────────────────────────────────────────────────────────────────────────────

/** A seed for a `calculations` row (parent customer must exist, same tenant). */
