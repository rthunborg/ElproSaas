import { COMMAND_CAPABILITIES, defineCommand, runCommand, type CommandDbClient } from "@/server/commands/envelope";
import { PERMISSION_MATRIX } from "@/server/authz/permission-matrix";
import { TENANT_ROLES, type TenantRole } from "@/server/authz/roles";
import { SCOPE_MANIFEST } from "@/scope/manifest";
import { TENANT_TABLES, type TenantTableName } from "../../integration/rls/tenant-table-inventory";

/**
 * The concrete least-privilege read/projection capability for every active table.
 * This is deliberately one row per table: table access must not be inferred from
 * an arbitrary capability in its containing module, particularly for the quote
 * economy and membership-history split privileges.
 */
export const TABLE_PROJECTION_CAPABILITIES: Readonly<Record<string, string>> = {
  tenants: "Memberships.Manage", tenant_memberships: "Memberships.Manage", membership_roles: "Memberships.Manage", audit_events: "Memberships.Manage", job_runs: "Notifications.View", notifications: "Notifications.Personal", notification_preferences: "Notifications.Personal", email_outbox: "Notifications.View", email_delivery_events: "Notifications.View", email_suppressions: "Notifications.View", email_unsubscribe_tokens: "Notifications.View", email_unsubscribe_rate_limits: "Notifications.View", email_delivery_artifacts: "Notifications.View", email_delivery_recoveries: "Notifications.View", membership_admin_operations: "Memberships.Manage",
  // The provisioning request/invite tables are platform protocol internals. No
  // tenant role can project them; platform allow-list authorization is verified
  // independently at the operator boundaries.
  tenant_provisioning_requests: "Platform.Operator.Access", tenant_provisioning_invites: "Platform.Operator.Access",
  customers: "Customers.View", facilities: "Customers.View", contacts: "Customers.View",
  company_settings: "CompanySettings.View", quote_terms: "CompanySettings.View", work_roles: "Pricing.Edit", articles: "Pricing.Edit",
  calculations: "Calculations.View", calculation_sections: "Calculations.View", calculation_rows: "Calculations.View",
  files: "Files.View", file_links: "Files.View",
  tenant_counters: "Quotes.Create", quotes: "Quotes.View", quote_versions: "Quotes.View", quote_version_lines: "Quotes.View", quote_version_attachments: "Quotes.View", quote_events: "Quotes.View", quote_review_authorizations: "Quotes.Approve", quote_acceptances: "Economy.ViewContributionMargin", quote_lost_reasons: "Quotes.View", quote_follow_ups: "Quotes.View",
  jobs: "Jobs.ViewAll", job_events: "Jobs.ViewAll",
};

/** Existing RLS self-context contract, intentionally broader than Memberships.Manage. */
export const TABLE_DIRECT_RLS_ALLOWED_ROLES: Readonly<Partial<Record<TenantTableName, readonly TenantRole[]>>> = {
  // 20260907171252: active users must resolve their tenant context and own membership roles.
  tenants: TENANT_ROLES,
  tenant_memberships: TENANT_ROLES,
  membership_roles: TENANT_ROLES,
  // 20260831124310: short-lived review-attestation payloads remain private to tenant admins.
  // Quotes.Approve still governs the business command; this is the deliberately narrower raw-table boundary.
  quote_review_authorizations: ["tenant_admin"],
  // The dark queue is exposed only through the redacted server projection.
  email_outbox: [],
  email_delivery_events: [],
  email_suppressions: [],
  email_delivery_recoveries: ["tenant_admin"],
  // 20260907171252: accepted totals are raw-table visible only to admin/project lead;
  // Economy.ViewContributionMargin is enforced by the server DTO for economy users.
  quote_acceptances: ["tenant_admin", "projektledare"],
};

export type RoleHarnessObligation = {
  readonly id: string;
  readonly kind: "table" | "command";
  readonly module: string;
  readonly capability?: string;
  /** Direct RLS self-context policy, rather than a business capability. */
  readonly allowedRoles?: readonly TenantRole[];
};

export type RoleHarnessCase = RoleHarnessObligation & {
  readonly role: TenantRole;
  readonly expected: "allowed" | "denied";
};

function activeModules() {
  return SCOPE_MANIFEST.modules.filter((module) => module.status === "active");
}

type RoleHarnessMetadata = {
  readonly projectionCapabilities?: Readonly<Record<string, unknown>>;
  readonly directRlsAllowedRoles?: Readonly<Record<string, unknown>>;
  readonly rlsProjectionAdapters?: Readonly<Record<string, unknown>>;
};

/** Reject stale metadata as well as missing active-table enrollment. */
export function validateRoleHarnessMetadata(metadata: RoleHarnessMetadata = {}): void {
  const activeTables = new Set(activeModules().flatMap((module) => module.tenantTables));
  const projectionCapabilities = metadata.projectionCapabilities ?? TABLE_PROJECTION_CAPABILITIES;
  const directRlsAllowedRoles = metadata.directRlsAllowedRoles ?? TABLE_DIRECT_RLS_ALLOWED_ROLES;
  const rlsProjectionAdapters = metadata.rlsProjectionAdapters ?? TABLE_RLS_PROJECTION_ADAPTERS;

  for (const table of activeTables) {
    if (!(table in projectionCapabilities)) throw new Error(`table capability enrollment missing for ${table}`);
    if (!(table in rlsProjectionAdapters)) throw new Error(`table RLS projection adapter missing for ${table}`);
  }
  for (const [name, entries] of [
    ["table capability", projectionCapabilities],
    ["direct RLS", directRlsAllowedRoles],
    ["table RLS projection adapter", rlsProjectionAdapters],
  ] as const) {
    const unknown = Object.keys(entries).filter((table) => !activeTables.has(table));
    if (unknown.length > 0) throw new Error(`unknown ${name} metadata: ${unknown.sort().join(", ")}`);
  }
}

/**
 * Derived enrollment snapshot. It deliberately has no hand-authored module/table
 * list: an activation missing a matrix row, table enrollment, or command mapping
 * produces an actionable error before policy tests can be reduced to a sample.
 */
export function activeRoleHarnessObligations(): RoleHarnessObligation[] {
  const active = activeModules();
  validateRoleHarnessMetadata();
  const activeIds = new Set(active.map((module) => module.id));
  const enrolledTables = new Set(TENANT_TABLES);
  const cases: RoleHarnessObligation[] = [];

  for (const scopeModule of active) {
    const matrixRows = (PERMISSION_MATRIX as Record<string, Record<string, unknown>>)[scopeModule.id];
    if (!matrixRows || Object.keys(matrixRows).length === 0) throw new Error(`matrix enrollment missing for active module ${scopeModule.id}`);
    for (const table of scopeModule.tenantTables) {
      if (!enrolledTables.has(table as never)) throw new Error(`table enrollment missing for active module ${scopeModule.id}: ${table}`);
      const capability = TABLE_PROJECTION_CAPABILITIES[table];
      if (!capability || !matrixRows[capability]) throw new Error(`table capability enrollment missing for ${table}`);
      cases.push({
        id: `table:${scopeModule.id}:${table}`,
        kind: "table",
        module: scopeModule.id,
        capability,
        allowedRoles: TABLE_DIRECT_RLS_ALLOWED_ROLES[table as TenantTableName],
      });
    }
  }
  for (const [command, requirement] of Object.entries(COMMAND_CAPABILITIES)) {
    if (!activeIds.has(requirement.module)) throw new Error(`unknown or inactive command module: ${command}`);
    const matrixRows = (PERMISSION_MATRIX as Record<string, Record<string, unknown>>)[requirement.module];
    if (!matrixRows?.[requirement.capability]) throw new Error(`command enrollment missing matrix capability: ${command}`);
    cases.push({ id: `command:${command}`, kind: "command", module: requirement.module, capability: requirement.capability });
  }
  const ids = cases.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate role harness enrollment metadata");
  return cases.sort((a, b) => a.id.localeCompare(b.id));
}

export function buildRoleHarnessCases(): RoleHarnessCase[] {
  return TENANT_ROLES.flatMap((role) => activeRoleHarnessObligations().map((obligation) => {
    const allowed = obligation.allowedRoles
      ? obligation.allowedRoles.includes(role)
      : obligation.capability
        ? ((PERMISSION_MATRIX as Record<string, Record<string, { roles: readonly TenantRole[] }>>)[obligation.module]?.[obligation.capability]?.roles ?? []).includes(role)
        : Object.values((PERMISSION_MATRIX as Record<string, Record<string, { roles: readonly TenantRole[] }>>)[obligation.module] ?? {}).some((row) => row.roles.includes(role));
    return { ...obligation, role, expected: allowed ? "allowed" : "denied" };
  }));
}

/**
 * Executes the production envelope's authorization gates for a registered command
 * without invoking its business mutation. Real command payload fixtures live in
 * their command suites; this adapter makes the matrix boundary exhaustive and
 * keeps denied cases side-effect-free by construction.
 */
export async function runCommandHarnessProbe(input: {
  readonly command: string;
  readonly client: CommandDbClient;
}) {
  const probe = defineCommand({
    command: input.command,
    auditable: false,
    eventType: "authorization_probe",
    targetType: "authorization_probe",
    validateInput: () => ({ ok: true as const, data: {} }),
    execute: () => ({ probed: true }),
  });
  return runCommand(probe, { client: input.client, input: {}, correlationId: crypto.randomUUID() });
}


/**
 * Test-support-only adapters for the concrete RLS read surface of every active
 * tenant table. Every adapter projects only the opaque row id; callers must
 * supply an id that the fixture seeded first, which prevents a denial from
 * passing merely because the target did not exist. Sensitive tables deliberately
 * never select money, contact, audit metadata, or file content columns here.
 */
type RlsReadClient = {
  from(table: string): {
    select(columns: string): { eq(column: string, value: string): Promise<{ data: readonly Record<string, unknown>[] | null; error: unknown | null }> };
  };
};

export type TableRlsProjectionAdapter = {
  readonly projection: string;
  /** Protocol tables intentionally have no authenticated SELECT grant. */
  readonly directReadDenied?: true;
  read(client: RlsReadClient, id: string): Promise<{ data: readonly Record<string, unknown>[] | null; error: unknown | null }>;
};

function keyProjection(table: TenantTableName, key = "id", directReadDenied = false): TableRlsProjectionAdapter {
  return {
    projection: key,
    ...(directReadDenied ? { directReadDenied: true as const } : {}),
    read: (client, id) => client.from(table).select(key).eq(key, id),
  };
}

const idProjection = (table: TenantTableName) => keyProjection(table);

export const TABLE_RLS_PROJECTION_ADAPTERS: Readonly<Record<TenantTableName, TableRlsProjectionAdapter>> = {
  tenants: idProjection("tenants"),
  tenant_memberships: idProjection("tenant_memberships"),
  membership_roles: idProjection("membership_roles"),
  membership_admin_operations: idProjection("membership_admin_operations"),
  audit_events: idProjection("audit_events"),
  job_runs: idProjection("job_runs"),
  notifications: idProjection("notifications"),
  notification_preferences: idProjection("notification_preferences"),
  email_outbox: keyProjection("email_outbox", "id", true),
  email_delivery_events: keyProjection("email_delivery_events", "id", true),
  email_suppressions: keyProjection("email_suppressions", "id", true),
  email_delivery_artifacts: keyProjection("email_delivery_artifacts", "id", true),
  email_delivery_recoveries: idProjection("email_delivery_recoveries"),
  tenant_provisioning_requests: keyProjection("tenant_provisioning_requests", "request_id", true),
  tenant_provisioning_invites: keyProjection("tenant_provisioning_invites", "tenant_id", true),
  customers: idProjection("customers"),
  facilities: idProjection("facilities"),
  contacts: idProjection("contacts"),
  company_settings: idProjection("company_settings"),
  quote_terms: idProjection("quote_terms"),
  work_roles: idProjection("work_roles"),
  articles: idProjection("articles"),
  calculations: idProjection("calculations"),
  calculation_sections: idProjection("calculation_sections"),
  calculation_rows: idProjection("calculation_rows"),
  files: idProjection("files"),
  file_links: idProjection("file_links"),
  tenant_counters: idProjection("tenant_counters"),
  quotes: idProjection("quotes"),
  quote_versions: idProjection("quote_versions"),
  quote_version_lines: idProjection("quote_version_lines"),
  quote_version_attachments: idProjection("quote_version_attachments"),
  quote_events: idProjection("quote_events"),
  quote_review_authorizations: idProjection("quote_review_authorizations"),
  quote_acceptances: idProjection("quote_acceptances"),
  quote_lost_reasons: idProjection("quote_lost_reasons"),
  quote_follow_ups: idProjection("quote_follow_ups"),
  jobs: idProjection("jobs"),
  job_events: idProjection("job_events"),
  // Public token protocol rows are never projected to tenant clients. Their
  // keys still enroll the role harness so manifest activation cannot drift.
  email_unsubscribe_tokens: keyProjection("email_unsubscribe_tokens" as TenantTableName, "id", true),
  email_unsubscribe_rate_limits: keyProjection("email_unsubscribe_rate_limits" as TenantTableName, "id", true),
} as unknown as Readonly<Record<TenantTableName, TableRlsProjectionAdapter>>;

export function tableRlsProjectionAdapter(table: string): TableRlsProjectionAdapter {
  const adapter = TABLE_RLS_PROJECTION_ADAPTERS[table as TenantTableName];
  if (!adapter) throw new Error(`table RLS projection adapter missing for ${table}`);
  return adapter;
}
