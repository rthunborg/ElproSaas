/**
 * Quote-version command (Story 6.1, Task 3.2/3.3; architecture §5 command table, §11).
 *
 * `createQuoteVersionFromCalculation` — a `defineCommand` through the EXISTING envelope
 * (resolve user → resolve active tenant_admin → validate typed input → verify ownership
 * of the source calculation → in execute: RE-CAPTURE the FROZEN composite snapshot from the
 * CURRENT source rows via the SHARED `buildFreshQuoteSnapshot` helper, then call the narrow
 * atomic RPC on the RLS client → append-only audit → typed Result). No bespoke auth/error/
 * audit mechanism.
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for every
 *   `tenant_id`; a client-supplied tenant_id is NEVER read.
 * - Source-calc ownership: the envelope `ownership` verifies the source calc belongs to
 *   the resolved tenant (a Tenant-B calculation_id → invisible under A's RLS →
 *   TENANT_ACCESS_DENIED BEFORE execute). Every selected attachment file id is ALSO
 *   re-validated for ownership inside the shared helper.
 * - Signing/writing runs under the CALLER's request-bound RLS client (`ctx.db`) —
 *   NEVER a service-role key. The narrow SECURITY INVOKER RPC owns the transaction.
 * - The snapshot is built by the PURE `buildQuoteVersionSnapshot` — copy-by-value +
 *   deep Object.freeze + INJECTED capturedAt (the single command clock, never
 *   Date.now()); it CAPTURES state and computes nothing (R-505). Story 6.5's
 *   `createNewQuoteVersion` reuses the SAME `buildFreshQuoteSnapshot` helper so the two
 *   commands cannot DRIFT (ADR-A009 — a fork is the failure this prevents).
 * - Audit metadata carries NO PII/money/customer values: only `{ targetId }`.
 * - NO personnummer enters the snapshot or the RPC (display/posture only).
 */
import { defineCommand } from "../envelope";
import {
  asQuoteRpcClient,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  attachmentsToPayload,
  buildFreshQuoteSnapshot,
  linesToPayload,
  snapshotToPayload,
} from "./snapshot-build";
import {
  validateCreateQuoteVersionFromCalculation,
  type CreateQuoteVersionInput,
} from "./validation";

/** Result of `createQuoteVersionFromCalculation` — the new version id + quote id + number. */
export interface CreateQuoteVersionResult {
  readonly targetId: string;
  readonly quoteId: string;
  readonly quoteNumber: number;
}

export const createQuoteVersionFromCalculation = defineCommand<
  CreateQuoteVersionInput,
  CreateQuoteVersionResult
>({
  command: "quote.version.create",
  auditable: true,
  eventType: "quote.version.created",
  targetType: "quote_version",
  validateInput: validateCreateQuoteVersionFromCalculation,
  // Envelope ownership: the SOURCE calculation must be visible under the caller's RLS
  // (own tenant). A foreign / non-existent calc id → zero rows → TENANT_ACCESS_DENIED,
  // BEFORE execute.
  ownership: (input) => ({ table: "calculations", id: input.calculation_id }),
  execute: async (ctx): Promise<CreateQuoteVersionResult> => {
    const db = ctx.db;
    const tenantId = ctx.tenantContext.tenantId;
    const capturedAt = ctx.clock.now().toISOString();

    // ── RE-CAPTURE the FROZEN composite snapshot from the CURRENT source rows (shared helper). ──
    const { snapshot, customerId, facilityId, contactId } =
      await buildFreshQuoteSnapshot(db, {
        calculationId: ctx.input.calculation_id,
        attachmentFileIds: ctx.input.attachment_file_ids,
        capturedAt,
      });

    // ── Call the narrow atomic RPC on the RLS client (never service-role). ──
    const rpc = asQuoteRpcClient(db);
    const { data, error } = await rpc.rpc(
      "create_quote_version_from_calculation",
      {
        p_tenant_id: tenantId, // resolved tenant, never client id
        p_calculation_id: ctx.input.calculation_id,
        p_captured_at: capturedAt,
        p_customer_id: customerId,
        p_facility_id: facilityId,
        p_contact_id: contactId,
        p_snapshot: snapshotToPayload(snapshot),
        p_lines: linesToPayload(snapshot),
        p_attachments: attachmentsToPayload(snapshot),
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
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
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
