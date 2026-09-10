/**
 * Quote-version command (Story 6.1, Task 3.2/3.3; architecture §5 command table, §11).
 *
 * `createQuoteVersionFromCalculation` — a `defineCommand` through the EXISTING envelope
 * (resolve user → resolve active tenant_admin → validate typed input → verify ownership
 * of the source calculation → in execute: RE-CAPTURE the FROZEN composite snapshot from the
 * CURRENT source rows via the SHARED `buildFreshQuoteSnapshot` helper, then call the narrow
 * authority issuance + atomic mutation/audit RPC on the RLS client → typed Result). No bespoke auth/error/
 * audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for every
 *   `tenant_id`; a client-supplied tenant_id is NEVER read.
 * - Source-calc ownership: the envelope `ownership` verifies the source calc belongs to
 *   the resolved tenant (a Tenant-B calculation_id → invisible under A's RLS →
 *   TENANT_ACCESS_DENIED BEFORE execute). Every selected attachment file id is ALSO
 *   re-validated for ownership inside the shared helper.
 * - Issuance/writing runs through the CALLER's request-bound RLS client (`ctx.db`) —
 *   NEVER a service-role key. The checked SECURITY DEFINER RPC owns mutation, one-time authority
 *   consumption, lifecycle event, and audit in one transaction.
 * - The snapshot is built by the PURE `buildQuoteVersionSnapshot` — copy-by-value +
 *   deep Object.freeze + INJECTED capturedAt (the single command clock, never
 *   Date.now()); it CAPTURES state and computes nothing (R-505). Story 6.5's
 *   `createNewQuoteVersion` reuses the SAME `buildFreshQuoteSnapshot` helper so the two
 *   commands cannot DRIFT (ADR-A009 — a fork is the failure this prevents).
 * - Audit metadata carries NO PII/money/customer values: only `{ targetId }`.
 * - NO personnummer enters the snapshot or the RPC (display/posture only).
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  asQuoteReviewAuthorizationRpcClient,
  asQuoteRpcClient,
  extractQuoteReviewAuthorizationId,
  throwMappedQuoteWriteError,
  loadCalcHeader,
} from "./quote-db";
import {
  attachmentsToPayload,
  buildFreshQuoteSnapshot,
  buildFreshQuoteSnapshotFromCustomerVisibleSource,
  linesToPayload,
  snapshotToPayload,
} from "./snapshot-build";
import {
  asQuoteInitialCustomerVisibleAuthorizationRpcClient,
  buildQuoteInitialCustomerVisibleReviewDigest,
  loadQuoteInitialCustomerVisibleSource,
} from "./quote-initial-source-db";
import {
  validateCreateReviewedQuoteVersionFromCalculation,
  type CreateReviewedQuoteVersionInput,
} from "./validation";

/** Result of `createQuoteVersionFromCalculation` — the new version id + quote id + number. */
export interface CreateQuoteVersionResult {
  readonly targetId: string;
  readonly quoteId: string;
  readonly quoteNumber: number;
}

export const createQuoteVersionFromCalculation = defineCommand<
  CreateReviewedQuoteVersionInput,
  CreateQuoteVersionResult
>({
  command: "quote.version.create",
  auditable: false,
  eventType: "quote.version.created",
  targetType: "quote_version",
  validateInput: validateCreateReviewedQuoteVersionFromCalculation,
  execute: async (ctx): Promise<CreateQuoteVersionResult> => {
    const db = ctx.db;
    const tenantId = ctx.tenantContext.tenantId;
    const capturedAt = ctx.clock.now().toISOString();
    const roles = ctx.tenantContext.roles ?? [ctx.tenantContext.role];
    const sellerOnly = roles.includes("saljare")
      && !roles.includes("tenant_admin")
      && !roles.includes("projektledare");

    // The generic envelope cannot branch ownership on resolved roles. Admin/PM
    // retain the identical caller-RLS preflight before the established snapshot read.
    if (!sellerOnly && await loadCalcHeader(db, ctx.input.calculation_id) === null) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }

    // ── RE-CAPTURE the FROZEN composite snapshot from the CURRENT source rows (shared helper). ──
    const built = sellerOnly
      ? await (async () => {
          const projected = await loadQuoteInitialCustomerVisibleSource(db, {
            p_tenant_id: tenantId,
            p_calculation_id: ctx.input.calculation_id,
            p_requested_attachment_ids: ctx.input.attachment_file_ids,
            p_actor_user_id: ctx.tenantContext.userId,
          });
          const built = buildFreshQuoteSnapshotFromCustomerVisibleSource(projected.source, {
            calculationId: ctx.input.calculation_id,
            capturedAt,
          });
          if (ctx.input.reviewed_quote_capture_date !== built.quoteCaptureDate || ctx.input.reviewed_snapshot_digest !== buildQuoteInitialCustomerVisibleReviewDigest(projected.source, built)) {
            throw new CommandError("VALIDATION_FAILED", "Kalkylen har ändrats – öppna och granska en ny förhandsvisning.");
          }
          return built;
        })()
      : await buildFreshQuoteSnapshot(db, {
          calculationId: ctx.input.calculation_id,
          attachmentFileIds: ctx.input.attachment_file_ids,
          capturedAt,
          reviewedSnapshotDigest: ctx.input.reviewed_snapshot_digest,
          reviewedQuoteCaptureDate: ctx.input.reviewed_quote_capture_date,
        });
    const {
      snapshot,
      customerId,
      facilityId,
      contactId,
      reviewedReadinessRows,
      reviewedCalculationStatus,
    } = built;

    // ── Call the narrow atomic RPC on the RLS client (never service-role). ──
    const snapshotPayload = snapshotToPayload(snapshot);
    const linesPayload = linesToPayload(snapshot);
    const attachmentsPayload = attachmentsToPayload(snapshot);
    const authorization = sellerOnly
      ? await asQuoteInitialCustomerVisibleAuthorizationRpcClient(db).rpc("authorize_quote_initial_customer_visible_review", {
          p_tenant_id: tenantId,
          p_calculation_id: ctx.input.calculation_id,
          p_captured_at: capturedAt,
          p_customer_id: customerId,
          p_facility_id: facilityId,
          p_contact_id: contactId,
          p_snapshot: snapshotPayload,
          p_lines: linesPayload,
          p_attachments: attachmentsPayload,
          p_reviewed_quote_capture_date: ctx.input.reviewed_quote_capture_date,
          p_reviewed_calculation_status: reviewedCalculationStatus,
          p_actor_user_id: ctx.tenantContext.userId,
          p_correlation_id: ctx.correlationId,
        })
      : await asQuoteReviewAuthorizationRpcClient(db).rpc("authorize_quote_initial_review", {
      p_tenant_id: tenantId,
      p_calculation_id: ctx.input.calculation_id,
      p_captured_at: capturedAt,
      p_customer_id: customerId,
      p_facility_id: facilityId,
      p_contact_id: contactId,
      p_snapshot: snapshotPayload,
      p_lines: linesPayload,
      p_attachments: attachmentsPayload,
      p_reviewed_quote_capture_date: ctx.input.reviewed_quote_capture_date,
      p_reviewed_calculation_status: reviewedCalculationStatus,
      p_reviewed_readiness_rows: reviewedReadinessRows,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
        });
    if (authorization.error) throwMappedQuoteWriteError(authorization.error);
    const authorizationId = extractQuoteReviewAuthorizationId(authorization.data);
    if (authorizationId === null) {
      throw new Error("authorizeQuoteInitialReview: RPC returned no authorization id");
    }

    const rpc = asQuoteRpcClient(db);
    const { data, error } = await rpc.rpc(
      "create_quote_version_from_calculation",
      {
        p_tenant_id: tenantId, // resolved tenant, never client id
        p_authorization_id: authorizationId,
        p_captured_at: capturedAt,
        p_actor_user_id: ctx.tenantContext.userId,
        p_correlation_id: ctx.correlationId,
      },
    );
    if (error) throwMappedQuoteWriteError(error);

    const parsed = extractRpcResult(data);
    if (parsed === null) {
      throw new Error("createQuoteVersionFromCalculation: RPC returned no result");
    }
    return {
      targetId: parsed.quoteVersionId,
      quoteId: parsed.quoteId,
      quoteNumber: parsed.quoteNumber,
    };
  },
});

/** Extract the RPC result (row array or single object) into a typed shape. */
function extractRpcResult(
  data: unknown,
): { quoteId: string; quoteVersionId: string; quoteNumber: number } | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as {
    quote_id?: unknown;
    quote_version_id?: unknown;
    quote_number?: unknown;
  };
  if (typeof r.quote_id !== "string" || typeof r.quote_version_id !== "string") {
    return null;
  }
  // Raw pg / PostgREST can return a bigint as a string — coerce defensively.
  const num = Number(r.quote_number);
  if (!Number.isFinite(num)) return null;
  return {
    quoteId: r.quote_id,
    quoteVersionId: r.quote_version_id,
    quoteNumber: num,
  };
}
