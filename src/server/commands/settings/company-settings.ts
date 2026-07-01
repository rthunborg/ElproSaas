/**
 * Company-settings command (Story 3.3, Task 2.2; architecture §5 command table —
 * "updateCompanySettings: Tenant quote identity and defaults; audit settings change").
 *
 * `updateCompanySettings` — a `defineCommand` through the EXISTING envelope (resolve
 * user → resolve active tenant_admin → validate typed input → execute via the RLS
 * client → append-only audit → typed Result). No bespoke auth/error/audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`; a client-supplied tenant_id is ignored (the validator never
 *   reads it, and execute writes the resolved tenant).
 * - ONE row per tenant: an UPSERT keyed on the `unique (tenant_id)` (`onConflict:
 *   "tenant_id"`) — a second call UPDATES the same row, never duplicates.
 * - The write runs on the request-bound RLS client (`ctx.db`); the own-tenant
 *   INSERT/UPDATE policies + the `is_tenant_admin` WITH CHECK keep it in-tenant.
 * - Audit metadata carries NO PII (org_nr / address / company name / VAT rate): the
 *   command passes only `{ targetId }`, and `sanitizeAuditMetadata` drops anything
 *   else by construction.
 * - NO VAT/ROT calculation is performed here (Epic 4 owns the engine) — this STORES
 *   the validated VAT defaults (display mode + vat_rate_bp basis points) only.
 */
import { defineCommand } from "../envelope";
import { asSettingsWriteClient, throwMappedWriteError } from "./settings-db";
import {
  validateUpdateCompanySettings,
  type UpdateCompanySettingsInput,
} from "./validation";

/** Every settings command returns the affected row id under `targetId`. */
export interface SettingsCommandResult {
  readonly targetId: string;
}

/**
 * Build the UPSERT payload for company_settings, scoped to the resolved tenant.
 *
 * `logo_url` is OMITTED-vs-CLEARED aware (data-loss guard): the form currently renders no
 * `logo_url` control, so an omitted `input.logo_url` MUST NOT wipe a previously-saved logo
 * (the "PDF-ready branding" field). We therefore leave `logo_url` OUT of the payload when it
 * is absent — on an UPSERT that means the ON-CONFLICT UPDATE preserves the stored value
 * (untouched column), while a first INSERT falls back to the column default (NULL). When a
 * value IS provided it is written verbatim. The other identity fields ARE rendered by the
 * form and submitted on every save, so their `?? null` (explicit clear) is intentional.
 */
function companySettingsUpsertValues(
  tenantId: string,
  input: UpdateCompanySettingsInput,
): Record<string, unknown> {
  return {
    tenant_id: tenantId, // resolved tenant — NEVER a client-supplied id
    company_name: input.company_name ?? null,
    org_nr: input.org_nr ?? null,
    address_line1: input.address_line1 ?? null,
    address_line2: input.address_line2 ?? null,
    postal_code: input.postal_code ?? null,
    city: input.city ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    // Omitted (undefined) → not in the payload → UPDATE preserves the existing logo,
    // INSERT uses the column default. Provided → written verbatim.
    ...(input.logo_url !== undefined ? { logo_url: input.logo_url } : {}),
    default_vat_display: input.default_vat_display,
    vat_rate_bp: input.vat_rate_bp, // integer basis points — never a float
  };
}

export const updateCompanySettings = defineCommand<
  UpdateCompanySettingsInput,
  SettingsCommandResult
>({
  command: "company_settings.update",
  auditable: true,
  eventType: "company_settings.updated",
  targetType: "company_settings",
  validateInput: validateUpdateCompanySettings,
  // No ownership target — the row is keyed on the resolved tenant (the upsert
  // INSERT/UPDATE WITH CHECK on is_tenant_admin keeps it in-tenant). A foreign-tenant
  // settings row is invisible under RLS, so the upsert can only ever touch the
  // caller's own row.
  execute: async (ctx) => {
    const db = asSettingsWriteClient(ctx.db);
    const { data, error } = await db
      .from("company_settings")
      .upsert(
        companySettingsUpsertValues(ctx.tenantContext.tenantId, ctx.input),
        { onConflict: "tenant_id" },
      )
      .select("id");
    if (error) throwMappedWriteError(error);
    const id = data?.[0]?.id;
    if (typeof id !== "string") {
      throw new Error("updateCompanySettings: no id returned");
    }
    return { targetId: id };
  },
  // Allow-listed audit metadata — ONLY the target id, NEVER the org_nr / address /
  // company name / VAT rate (sanitizeAuditMetadata drops anything else anyway).
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});
