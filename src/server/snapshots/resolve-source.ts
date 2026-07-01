/**
 * Story 3.5 — the server-side snapshot-source OWNERSHIP RESOLVER (Task 3).
 *
 * SERVER-ONLY. The COMMAND-LAYER half of the AC3 both-layers cross-tenant rejection: it
 * READS the requested source row by id on the per-request RLS client (`@supabase/ssr`
 * cookie-bound, ANON key — NEVER a service-role client), selecting only the real columns
 * the matching builder needs. RLS scopes the read to the caller's tenant with NO tenant id
 * passed (architecture §6): a FOREIGN-tenant id — or a non-existent id — returns ZERO rows,
 * which the resolver maps to a typed `TENANT_ACCESS_DENIED` Result. No snapshot is built,
 * no existence signal leaks, no raw error/stack/SQL crosses the boundary.
 *
 * This REUSES the established primitives — the typed `Result`/`ok`/`err`, the stable
 * `CommandErrorCode` (`TENANT_ACCESS_DENIED`/`SERVER_ERROR`) + `COMMAND_MESSAGES`, and the
 * envelope's ownership-verify SEMANTICS (a tenant-scoped SELECT under RLS → zero rows ⇒
 * `TENANT_ACCESS_DENIED`; a transient query error ⇒ retryable `SERVER_ERROR`, NOT masked as
 * a permanent access denial). It does NOT invent a new error surface or a new auth mechanism.
 *
 * The resolver NEVER reads a client-supplied `tenant_id`; the built snapshot's `tenant_id`
 * is whatever the RESOLVED row carries — which, under own-tenant RLS, is ALWAYS the
 * caller's tenant. So a snapshot can never carry a foreign tenant id.
 *
 * SCOPE: this is a READ/RESOLVE step only — it does NOT write, audit, or build the
 * snapshot. Epic 5 (Story 5.3) / Epic 6 (Story 6.1) COMPOSE it into their write commands:
 * they call `resolveSnapshotSource(...)`, then feed the returned row to the matching pure
 * builder in `src/lib/snapshots/build.ts`.
 *
 * [Source: epics.md#Story 3.5 AC3; architecture.md#5 (server reads on RLS client; typed
 *  Result) / #6 (resolved tenant authority; RLS read isolation; no client tenant_id);
 *  src/server/commands/envelope.ts (verifyOwnership semantics — REUSED); command-errors.ts;
 *  src/server/db/supabase-server-client.ts; src/lib/snapshots/build.ts (the row shapes).]
 */
import { err, ok, type Result } from "@/lib/result/result";
import {
  COMMAND_MESSAGES,
  type CommandErrorCode,
} from "@/server/commands/command-errors";
import type {
  ArticleSourceRow,
  CompanySettingsSourceRow,
  QuoteTermsSourceRow,
  WorkRoleSourceRow,
} from "@/lib/snapshots/build";
import type { SnapshotKind } from "@/lib/snapshots/types";

/**
 * The minimal RLS-client surface the resolver drives: a tenant-scoped SELECT of one row
 * by id. The real `@supabase/ssr` server client and the test anon-key client both satisfy
 * this structurally (`.from(table).select(cols).eq("id", id).limit(1)`).
 */
export interface SnapshotSourceDbClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        limit(n: number): Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
}

/** The per-kind resolved source row (exactly the columns the matching builder consumes). */
export type ResolvedSourceRowFor<K extends SnapshotKind> = K extends "work_role"
  ? WorkRoleSourceRow
  : K extends "article"
    ? ArticleSourceRow
    : K extends "company_settings"
      ? CompanySettingsSourceRow
      : K extends "quote_terms"
        ? QuoteTermsSourceRow
        : never;

/**
 * The table + the SELECT column list per source kind. `kind` is a CLOSED union (never
 * client input), so the interpolated table/columns are safe — this is not a query built
 * from user text. Each column list is exactly what the matching pure builder reads.
 */
const SOURCE_QUERY: Record<
  SnapshotKind,
  { readonly table: string; readonly columns: string }
> = {
  work_role: {
    table: "work_roles",
    columns:
      "id, tenant_id, display_name, cost_rate_ore, sell_rate_ore, is_active, updated_at",
  },
  article: {
    table: "articles",
    columns:
      "id, tenant_id, name, sku, unit, unit_price_ore, is_active, updated_at",
  },
  company_settings: {
    table: "company_settings",
    columns:
      "id, tenant_id, company_name, vat_rate_bp, default_vat_display, updated_at",
  },
  quote_terms: {
    table: "quote_terms",
    columns: "id, tenant_id, terms_text, approved_at, approved_by, updated_at",
  },
};

export interface ResolveSnapshotSourceArgs<K extends SnapshotKind> {
  /** The per-request, cookie-bound RLS client (anon key — NEVER service-role). */
  readonly client: SnapshotSourceDbClient;
  /** The source kind (a closed union — selects the table + column list). */
  readonly kind: K;
  /** The client-supplied source id (verified via RLS, never trusted). */
  readonly sourceId: string;
}

/**
 * Resolve a snapshot source row by id under the caller's RLS scope.
 *
 * - own-tenant id → `ok(row)`, a row ready for the matching pure builder, whose
 *   `tenant_id` is the RESOLVED (caller's) tenant.
 * - foreign-tenant / non-existent id → `err("TENANT_ACCESS_DENIED", …)` (zero rows under
 *   RLS — no snapshot, no leaked existence signal).
 * - transient query error → `err("SERVER_ERROR", …)` (retryable; NOT masked as denial).
 */
export async function resolveSnapshotSource<K extends SnapshotKind>({
  client,
  kind,
  sourceId,
}: ResolveSnapshotSourceArgs<K>): Promise<
  Result<ResolvedSourceRowFor<K>, CommandErrorCode>
> {
  const { table, columns } = SOURCE_QUERY[kind];

  let data: unknown[] | null;
  let error: unknown;
  try {
    ({ data, error } = await client
      .from(table)
      .select(columns)
      .eq("id", sourceId)
      .limit(1));
  } catch {
    // An unexpected throw (client misuse, SDK reject) is a TRANSIENT infra fault — surface
    // it as a retryable SERVER_ERROR so a legitimately-owned source is never reported as
    // "no access" during an outage. No raw stack crosses the boundary.
    return err("SERVER_ERROR", COMMAND_MESSAGES.SERVER_ERROR);
  }

  // A DB/query error is a transient infra fault, NOT an authorization decision — mirror
  // the envelope's verifyOwnership semantics.
  if (error) {
    return err("SERVER_ERROR", COMMAND_MESSAGES.SERVER_ERROR);
  }

  // RLS narrows the visible rows to the caller's tenant: a target in ANOTHER tenant (or no
  // such row) returns zero rows → the source is not provably owned by the resolved tenant
  // → DENIED (R-004). The generic message never echoes the id or leaks existence.
  if (!data || data.length === 0) {
    return err("TENANT_ACCESS_DENIED", COMMAND_MESSAGES.TENANT_ACCESS_DENIED);
  }

  return ok(data[0] as ResolvedSourceRowFor<K>);
}
