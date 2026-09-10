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
 * tenant → consume the review authority + write the version/event/audit atomically). No bespoke
 * auth/error/audit path.
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
  asQuoteReviewAuthorizationRpcClient,
  extractQuoteReviewAuthorizationId,
  loadEligibleCalculationAttachmentFileIds,
  loadVisibleAttachmentFileId,
  loadQuoteVersionAttachmentSnapshots,
  loadQuoteVersionParent,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  attachmentsToPayload,
  buildFreshQuoteSnapshot,
  buildFreshQuoteSnapshotFromCustomerVisibleSource,
  linesToPayload,
  snapshotToPayload,
} from "./snapshot-build";
import { loadQuoteSuccessorCustomerVisibleSource } from "./quote-successor-source-db";
import {
  validateCreateNewQuoteVersion,
  type CreateNewQuoteVersionInput,
} from "./validation";

/** Result of `createNewQuoteVersion` — the NEW draft version id + its version number. */
export interface CreateNewQuoteVersionResult {
  readonly targetId: string;
  readonly versionNumber: number;
}

/**
 * A pre-V2 draft cannot be edited or sent safely because it has no complete frozen tax answer.
 * It gets one narrow recovery path: create a fresh V2 version while preserving the legacy row.
 */
export function isRecoverableLegacyDraftParent(
  status: string,
  snapshotSchemaVersion: number | null,
): boolean {
  return status === "draft" && snapshotSchemaVersion === null;
}

/**
 * Resolve the attachment ids for a successor snapshot without trusting the predecessor's frozen
 * bytes. An absent selection requests the eligible predecessor default; an explicit empty array
 * is a deliberate "copy none" choice. In every case retain only currently eligible calculation
 * attachments and preserve the first requested occurrence, so the RPC can never insert duplicate
 * snapshot attachment rows.
 */
export function resolveCarryForwardAttachmentFileIds(
  requestedAttachmentFileIds: readonly string[] | undefined,
  predecessorAttachmentFileIds: readonly string[],
  eligibleCalculationAttachmentFileIds: readonly string[],
): string[] {
  const requestedIds = requestedAttachmentFileIds ?? predecessorAttachmentFileIds;
  const eligibleIds = new Set(eligibleCalculationAttachmentFileIds);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const fileId of requestedIds) {
    if (!eligibleIds.has(fileId) || seen.has(fileId)) continue;
    seen.add(fileId);
    result.push(fileId);
  }
  return result;
}

export const createNewQuoteVersion = defineCommand<
  CreateNewQuoteVersionInput,
  CreateNewQuoteVersionResult
>({
  command: "quote.version.new",
  auditable: false,
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
    const roles = ctx.tenantContext.roles ?? [ctx.tenantContext.role];
    const sellerOnly = roles.includes("saljare")
      && !roles.includes("tenant_admin")
      && !roles.includes("projektledare");

    // ── LOAD the parent version (ownership proved it visible; null = race → deny). ──
    const parent = await loadQuoteVersionParent(db, ctx.input.quote_version_id);
    if (parent === null) throw new CommandError("TENANT_ACCESS_DENIED");

    // A current V2 draft remains the editable version, so branching from it is a no-op. A literal
    // V1/null-schema draft is the deliberate exception: it is read-only and may be re-captured as a
    // fresh V2 draft without mutating the historical row.
    if (
      parent.status === "draft" &&
      !isRecoverableLegacyDraftParent(parent.status, parent.snapshot_schema_version)
    ) {
      throw new CommandError("VALIDATION_FAILED");
    }
    // ── ACCEPTED-PARENT GATE (Story 7.2, Task 5 / architecture §12) — new-version is scoped to
    // ── draft/sent, NEVER `accepted`. An accepted version is a terminal customer commitment (7.4
    // ── hardens the full immutability); it does not spawn a new version. 7.2 makes `accepted`
    // ── reachable, so it owns closing this command-side gap. Reject with a generic VALIDATION_FAILED.
    if (parent.status === "accepted") throw new CommandError("VALIDATION_FAILED");

    // A Säljare may create quotes but deliberately has no direct calculation-row RLS.
    // The checked projection recomputes this same fresh snapshot from current source facts;
    // it never clones the predecessor or grants a reusable calculations/files reader.
    const built = sellerOnly
      ? await (async () => {
          const projected = await loadQuoteSuccessorCustomerVisibleSource(db, {
            p_tenant_id: tenantId,
            p_source_quote_version_id: parent.id,
            p_requested_attachment_ids: ctx.input.attachment_file_ids ?? null,
            p_actor_user_id: ctx.tenantContext.userId,
          });
          return buildFreshQuoteSnapshotFromCustomerVisibleSource(projected.source, {
            calculationId: parent.calculation_id,
            capturedAt,
          });
        })()
      : await (async () => {
          // Carry-forward defaults to the intersection of predecessor attachments and
          // currently eligible calculation files. An explicit selection is authoritative:
          // preserve its order, and reject duplicate, foreign, missing, or ineligible ids.
          const [predecessorAttachments, currentCalculationAttachmentIds] = await Promise.all([
            loadQuoteVersionAttachmentSnapshots(db, parent.id),
            loadEligibleCalculationAttachmentFileIds(db, parent.calculation_id),
          ]);
          if (ctx.input.attachment_file_ids !== undefined) {
            const requested = ctx.input.attachment_file_ids;
            if (new Set(requested).size !== requested.length) {
              throw new CommandError("VALIDATION_FAILED");
            }
            const visible = await Promise.all(
              requested.map((fileId) => loadVisibleAttachmentFileId(db, fileId)),
            );
            if (visible.some((fileId) => fileId === null)) {
              throw new CommandError("TENANT_ACCESS_DENIED");
            }
            const eligible = new Set(currentCalculationAttachmentIds);
            if (requested.some((fileId) => !eligible.has(fileId))) {
              throw new CommandError("VALIDATION_FAILED");
            }
          }
          const attachmentFileIds = resolveCarryForwardAttachmentFileIds(
            ctx.input.attachment_file_ids,
            predecessorAttachments.map((attachment) => attachment.file_id),
            currentCalculationAttachmentIds,
          );
          return buildFreshQuoteSnapshot(db, {
            calculationId: parent.calculation_id,
            attachmentFileIds,
            capturedAt,
          });
        })();
    const { snapshot, customerId, facilityId, contactId } = built;

    const snapshotPayload = snapshotToPayload(snapshot);
    const linesPayload = linesToPayload(snapshot);
    const attachmentsPayload = attachmentsToPayload(snapshot);
    const authorityRpc = asQuoteReviewAuthorizationRpcClient(db);
    const authorization = await authorityRpc.rpc("authorize_quote_successor_review", {
      p_tenant_id: tenantId,
      p_quote_id: parent.quote_id,
      p_source_quote_version_id: parent.id,
      p_calculation_id: parent.calculation_id,
      p_captured_at: capturedAt,
      p_customer_id: customerId,
      p_facility_id: facilityId,
      p_contact_id: contactId,
      p_snapshot: snapshotPayload,
      p_lines: linesPayload,
      p_attachments: attachmentsPayload,
      p_supersede_prior: true,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    if (authorization.error) throwMappedQuoteWriteError(authorization.error);
    const authorizationId = extractQuoteReviewAuthorizationId(authorization.data);
    if (authorizationId === null) {
      throw new Error("authorizeQuoteSuccessorReview: RPC returned no authorization id");
    }

    // Consume the one-time authorization in the same transaction as the successor rows/event/audit.
    const rpc = asNewQuoteVersionRpcClient(db);
    const { data, error } = await rpc.rpc("create_new_quote_version", {
      p_tenant_id: tenantId, // resolved tenant, never a client id
      p_authorization_id: authorizationId,
      p_captured_at: capturedAt,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    if (error) throwMappedQuoteWriteError(error);

    const parsed = extractNewVersionResult(data);
    if (parsed === null) {
      throw new Error("createNewQuoteVersion: RPC returned no result");
    }
    return { targetId: parsed.quoteVersionId, versionNumber: parsed.versionNumber };
  },
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
