/**
 * `createNewQuoteVersion` — the Story 6.5 new-version FLOW command (architecture §5, §11; ADR-A009;
 * R-609/R-602). When a SENT (or any non-draft) quote version needs customer-visible changes, this
 * command spawns a NEW DRAFT version on the SAME parent quote while PRESERVING every prior version
 * (a version is the commitment; a change spawns a version, it does NOT overwrite one).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the PARENT version is own-tenant-visible →
 * in execute: LOAD the parent version [quote_id / calculation_id / status] on the RLS client →
 * OPTIONALLY guard against a draft parent → RE-CAPTURE the FRESH composite snapshot from the CURRENT
 * source calc via the SHARED `buildFreshQuoteSnapshot` helper [source (a) — the mutation surface for
 * customer-visible changes is the calc/settings/terms the admin already edited] → call the narrow
 * atomic `create_new_quote_version` RPC on the RLS client with the INJECTED clock + the resolved
 * tenant → append-only audit `{ targetId: <new version id> }`). No bespoke auth/error/audit path.
 *
 * ── PRIOR-VERSION PRESERVATION IS THE HEADLINE PROPERTY (R-609) ────────────────────────────────
 * Creating v2 mutates NOTHING on v1 — the RPC inserts a NEW row + (optionally) flips ONLY v1's
 * exempt `status` column to `superseded` (the sanctioned forward transition the 6.4 sent-lock
 * trigger allows). v1's snapshot / lines / attachments / PDF metadata / events / status history stay
 * byte-unchanged (the 6.4 sent-lock + append-only triggers are the below-command backstops).
 *
 * ── THE NEW VERSION SHARES THE PARENT'S quote_number; ONLY version_number INCREMENTS ───────────
 * The RPC reads the SHARED per-quote quote_number off the parent's versions and computes
 * version_number = max+1 under the parent-quote row lock (no tenant_counters increment). The
 * resolved `ctx.tenantContext.tenantId` is the ONLY tenant authority; a client tenant id is never
 * read. Every write runs on the caller's RLS client (anon key — NEVER service-role).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  asNewQuoteVersionRpcClient,
  loadQuoteVersionParent,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  attachmentsToPayload,
  buildFreshQuoteSnapshot,
  linesToPayload,
  snapshotToPayload,
} from "./snapshot-build";
import {
  validateCreateNewQuoteVersion,
  type CreateNewQuoteVersionInput,
} from "./validation";

/** Result of `createNewQuoteVersion` — the NEW draft version id + its version number. */
export interface CreateNewQuoteVersionResult {
  readonly targetId: string;
  readonly versionNumber: number;
}

export const createNewQuoteVersion = defineCommand<
  CreateNewQuoteVersionInput,
  CreateNewQuoteVersionResult
>({
  command: "quote.version.new",
  auditable: true,
  eventType: "quote.version.created",
  targetType: "quote_version",
  validateInput: validateCreateNewQuoteVersion,
  // Ownership: the PARENT version must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent parent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (nothing is created).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<CreateNewQuoteVersionResult> => {
    const db = ctx.db;
    const tenantId = ctx.tenantContext.tenantId;
    const capturedAt = ctx.clock.now().toISOString();

    // ── LOAD the parent version (ownership proved it visible; null = race → deny). ──
    const parent = await loadQuoteVersionParent(db, ctx.input.quote_version_id);
    if (parent === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // ── OPTIONAL guard (Task 3.1.b): a new version is meaningful from a NON-draft parent. Creating a
    // ── new version off a draft is a no-op (the draft IS the editable version) → VALIDATION_FAILED.
    if (parent.status === "draft") throw new CommandError("VALIDATION_FAILED");
    // ── ACCEPTED-PARENT GATE (Story 7.2, Task 5 / architecture §12) — new-version is scoped to
    // ── draft/sent, NEVER `accepted`. An accepted version is a terminal customer commitment (7.4
    // ── hardens the full immutability); it does not spawn a new version. 7.2 makes `accepted`
    // ── reachable, so it owns closing this command-side gap. Reject with a generic VALIDATION_FAILED.
    if (parent.status === "accepted") throw new CommandError("VALIDATION_FAILED");

    // ── RE-CAPTURE the FRESH composite snapshot from the CURRENT source calc (source (a)). The
    // ── shared helper re-validates each selected attachment file own-tenant (a foreign id → denied).
    const { snapshot, customerId, facilityId, contactId } =
      await buildFreshQuoteSnapshot(db, {
        calculationId: parent.calculation_id,
        attachmentFileIds: ctx.input.attachment_file_ids,
        capturedAt,
      });

    // ── Call the narrow atomic new-version RPC on the RLS client (never service-role). The parent's
    // ── existing SENT commitment is superseded (p_supersede_prior=true) so the timeline never shows
    // ── two live sent commitments (AC2) — the RPC only supersedes a `sent` prior version.
    const rpc = asNewQuoteVersionRpcClient(db);
    const { data, error } = await rpc.rpc("create_new_quote_version", {
      p_tenant_id: tenantId, // resolved tenant, never a client id
      p_quote_id: parent.quote_id,
      p_calculation_id: parent.calculation_id,
      p_captured_at: capturedAt,
      p_customer_id: customerId,
      p_facility_id: facilityId,
      p_contact_id: contactId,
      p_snapshot: snapshotToPayload(snapshot),
      p_lines: linesToPayload(snapshot),
      p_attachments: attachmentsToPayload(snapshot),
      p_supersede_prior: true,
    });
    if (error) throwMappedQuoteWriteError(error);

    const parsed = extractNewVersionResult(data);
    if (parsed === null) {
      throw new Error("createNewQuoteVersion: RPC returned no result");
    }
    return { targetId: parsed.quoteVersionId, versionNumber: parsed.versionNumber };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

/**
 * Extract the new-version RPC result (row array or single object) into a typed shape.
 *
 * Exported for the fast-gate unit suite: the raw pg / PostgREST layer can return
 * `version_number` (a bigint) as a STRING and the result as either a single object or a
 * one-row array, so this coercion/normalization is pure branch logic worth pinning WITHOUT a
 * database (the DB-backed INT suite skips when the local stack is unreachable).
 */
export function extractNewVersionResult(
  data: unknown,
): { quoteVersionId: string; versionNumber: number } | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as { quote_version_id?: unknown; version_number?: unknown };
  if (typeof r.quote_version_id !== "string") return null;
  // Raw pg / PostgREST can return a bigint (version_number) as a string — coerce defensively.
  const num = Number(r.version_number);
  if (!Number.isFinite(num)) return null;
  return { quoteVersionId: r.quote_version_id, versionNumber: num };
}
