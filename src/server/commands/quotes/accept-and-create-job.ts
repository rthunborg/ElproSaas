/**
 * `acceptQuoteAndCreateJob` — the Story 7.2 idempotent, transactional accept-and-create-job command
 * (architecture §5, §13; ADR-A009; R-702/R-703/R-705/R-706/R-707/R-710/R-715). The LIVE acceptance
 * path from here on: a capture on a SENT version now ACCEPTS the version AND creates the job in ONE
 * atomic call (superseding 7.1's capture-only `captureQuoteAcceptance` at the acceptance UI).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible →
 * in execute: LOAD the version's real status + parent quote + frozen source sent total on the RLS
 * client → re-assert `status='sent'` (reject a non-sent with VALIDATION_FAILED) → compute the
 * adjusted-price delta via the PURE 7.1 module and re-validate the reason/evidence gate server-side →
 * re-validate an evidence file id own-tenant → call the narrow atomic `accept_quote_and_create_job`
 * RPC with the INJECTED clock, resolved tenant, actor, and correlation id; the database writes ONE
 * append-only audit row in the same transaction IFF it produced a FRESH accept). Fuses
 * `mark-sent.ts`'s command→narrow-RPC shape with `accept.ts`'s 7.1 sent-state + adjusted-price +
 * evidence-ownership gates.
 *
 * ── THE TRANSACTION IS ONE RPC (ADR-A009 / §13 steps 1-10) ────────────────────────────────────────
 * The acceptance INSERT + `sent → accepted` lifecycle flip + job INSERT + quote/job events + the
 * evidence file_links row and audit are ALL inside the narrow `accept_quote_and_create_job` RPC
 * (checked SECURITY DEFINER: request-bound actor + active tenant-admin, fixed empty search path,
 * authenticated only, NO service-role app path). The RPC row-locks the
 * version + parent quote, returns the EXISTING (acceptance, job) idempotently on a retry / concurrent
 * loser (the DB uniqueness constraints are the backstop), and rolls the whole txn back on any
 * failure. The acceptance write MOVED into the RPC (7.2 Decision (a)) so the multi-record write is
 * atomic — an acceptance-then-job two-step would violate NFR20.
 *
 * ── IDEMPOTENT AUDIT (R-710) ──────────────────────────────────────────────────────────────────────
 * A FRESH accept (`was_existing = false`) writes exactly ONE append-only audit row (`{ targetId }`
 * only — NO accepted price / channel / customer / evidence PII). An idempotent RE-ENTRY
 * (`was_existing = true`) produced NO state change, so it writes NO audit row (the command is NOT
 * envelope-auditable; the RPC writes the row itself only on a fresh accept). Both paths still return ok
 * with the same (acceptanceId, jobId) — the retry is a success, not an error (AC2's primary behavior).
 *
 * ── DETERMINISM (H1, R-715) ───────────────────────────────────────────────────────────────────────
 * The RPC takes the EXPLICIT `p_accepted_at` (the accepted moment — a business fact) + the injected
 * command instant; it never reads a wall-clock for the accepted instant. `buildAcceptAndCreateJobRpcArgs`
 * is the PURE, unit-pinned arg adapter (7.2-UNIT-01) — the tenant id is threaded from ctx in execute,
 * NEVER read from the input.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import { evaluateAcceptancePriceGate } from "@/features/quotes/acceptance-price";
import {
  asAcceptAndCreateJobRpcClient,
  extractAcceptAndCreateJobResult,
  loadQuoteVersionAcceptanceSource,
  throwMappedQuoteWriteError,
  type AcceptAndCreateJobRpcArgs,
} from "./quote-db";
import { ownerRecordVisible } from "../files/file-db";
import {
  validateAcceptQuoteAndCreateJob,
  type AcceptQuoteAndCreateJobInput,
} from "./validation";

/** Result of the accept-and-create-job command — the acceptance id (`targetId`) + the job id. */
export interface AcceptQuoteAndCreateJobResult {
  /** The acceptance id (the audit target). Same as `acceptanceId`. */
  readonly targetId: string;
  /** The created (or existing, on an idempotent re-entry) acceptance id. */
  readonly acceptanceId: string;
  /** The created (or existing) job id. */
  readonly jobId: string;
}

/** The audit event type for a fresh accept-and-create-job (allow-listed `{ targetId }` metadata). */
const ACCEPT_EVENT_TYPE = "quote.acceptance.accepted_and_job_created";
const ACCEPT_COMMAND = "quote.acceptance.accept_and_create_job";
const ACCEPT_TARGET_TYPE = "quote_acceptance";

/**
 * PURE arg adapter (7.2-UNIT-01, H1): build the RPC args (minus `p_tenant_id`, which execute threads
 * from `ctx.tenantContext` — NEVER from the input) from the validated input.
 * `p_accepted_at` is the EXPLICIT `input.accepted_at` (the accepted moment — a business fact, not
 * "now"). Exposed as a pure, testable seam mirroring how mark-sent's timestamp is unit-pinned. The
 * `p_source_sent_total_ore` is passed by execute (loaded server-side from the frozen version row), so
 * it is threaded in via the override rather than read from the input (which never carries it).
 *
 * DETERMINISM (H1, R-715): every persisted instant derives from the EXPLICIT `p_accepted_at` — the
 * acceptance row's `accepted_at`, and the `quote_events`/`job_events` `occurred_at` all use it inside
 * the RPC — while the audit row's timing comes from the injected `ctx.clock` via `writeAuditEvent`.
 * The RPC therefore takes NO command-timestamp param (there is no wall-clock read anywhere in the
 * transaction), so the adapter passes none either — no dead arg implying an end-to-end wiring that
 * does not exist.
 */
export function buildAcceptAndCreateJobRpcArgs(
  input: AcceptQuoteAndCreateJobInput,
  overrides?: { readonly sourceSentTotalOre?: number },
): Omit<AcceptAndCreateJobRpcArgs, "p_tenant_id"> {
  return {
    p_quote_version_id: input.quote_version_id,
    p_accepted_at: input.accepted_at, // the EXPLICIT accepted moment (H1), NOT a wall clock
    p_accepted_price_ore: input.accepted_price_ore,
    p_source_sent_total_ore: overrides?.sourceSentTotalOre ?? input.accepted_price_ore,
    p_channel: input.channel ?? null,
    p_adjustment_reason: input.adjustment_reason ?? null,
    p_evidence_file_id: input.evidence_file_id ?? null,
    p_evidence_reference: input.evidence_reference ?? null,
    p_notes: input.notes ?? null,
    p_planned_start_date: input.planned_start_date ?? null,
    p_planned_end_date: input.planned_end_date ?? null,
    p_title: input.title ?? null,
    p_fault_inject: input.__faultInject ?? null,
  };
}

export const acceptQuoteAndCreateJob = defineCommand<
  AcceptQuoteAndCreateJobInput,
  AcceptQuoteAndCreateJobResult
>({
  command: ACCEPT_COMMAND,
  // NOT envelope-auditable: the RPC writes the audit row atomically, and ONLY on a fresh accept —
  // an idempotent re-entry (was_existing) produced no state change and writes NO audit row (R-710).
  auditable: false,
  eventType: ACCEPT_EVENT_TYPE,
  targetType: ACCEPT_TARGET_TYPE,
  validateInput: validateAcceptQuoteAndCreateJob,
  // Ownership: the target version must be visible under the caller's RLS (own tenant). A foreign /
  // non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute (no existence disclosure).
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<AcceptQuoteAndCreateJobResult> => {
    const db = ctx.db;
    const input = ctx.input;
    const versionId = input.quote_version_id;

    // ── THE SENT-STATE GATE (AC4) — load the version's REAL status + parent quote + frozen source
    // ── sent total. Ownership proved visibility; a null here is a race → deny.
    const source = await loadQuoteVersionAcceptanceSource(db, versionId);
    if (source === null) throw new CommandError("TENANT_ACCESS_DENIED");
    // Acceptance is legal ONLY on a SENT version — a generic VALIDATION_FAILED (no leaked status;
    // NOT QUOTE_VERSION_LOCKED — a different meaning). An `accepted` version is the IDEMPOTENT
    // RE-ENTRY case (AC2): the transaction already ran, so we let it flow to the RPC, whose
    // existing-record short-circuit returns the existing (acceptance, job) with was_existing=true
    // WITHOUT any write (it runs BEFORE the RPC's own sent re-assert). Every OTHER non-sent state
    // (draft/rejected/expired/superseded) is a genuine lifecycle rejection. The RPC re-asserts the
    // sent precondition under the row lock for a fresh accept.
    if (source.status !== "sent" && source.status !== "accepted") {
      throw new CommandError("VALIDATION_FAILED");
    }

    // Story 10.6: for snapshotSchemaVersion=2, loadQuoteVersionAcceptanceSource normalizes the
    // frozen payableOre into source_sent_total_ore; V1 rows still fall back to acceptedPriceOre.
    // ── THE ADJUSTED-PRICE GATE (AC5) — the SINGLE authority `evaluateAcceptancePriceGate` (the 7.1
    // ── engine) folds the PURE delta computation, the REASON_REQUIRED rule, and the `hasReason`
    // ── (reason OR evidence) presence into one OK/typed-failure the command RE-VALIDATES server-side
    // ── (the client cannot bypass by omitting a reason). The öre values persist AS GIVEN in the RPC
    // ── (no SQL money math). An INVALID öre input OR a missing-reason failure ⇒ VALIDATION_FAILED.
    const gate = evaluateAcceptancePriceGate({
      acceptedPriceOre: input.accepted_price_ore,
      sourceSentTotalOre: source.source_sent_total_ore,
      hasReason:
        (typeof input.adjustment_reason === "string" &&
          input.adjustment_reason.trim().length > 0) ||
        (typeof input.evidence_reference === "string" &&
          input.evidence_reference.trim().length > 0) ||
        (typeof input.evidence_file_id === "string" &&
          input.evidence_file_id.length > 0),
    });
    if (!gate.ok) throw new CommandError("VALIDATION_FAILED");

    // ── EVIDENCE OWNERSHIP (AC5, R-709) — when an evidence file id is supplied, re-validate it is
    // ── own-tenant-visible BEFORE the RPC (a foreign file id ⇒ TENANT_ACCESS_DENIED; the composite
    // ── same-tenant FK re-enforces it at the acceptance INSERT). Reuse 7.1's evidence pattern.
    if (typeof input.evidence_file_id === "string" && input.evidence_file_id.length > 0) {
      const visible = await ownerRecordVisible(db, "files", input.evidence_file_id);
      if (!visible) throw new CommandError("TENANT_ACCESS_DENIED");
    }

    // ── THE NARROW ATOMIC TRANSACTION (ADR-A009 / §13) on the RLS client (never service-role). The
    // ── accepted moment is the EXPLICIT input (H1); the resolved tenant is the ONLY tenant authority.
    // ── The RPC row-locks + idempotently returns the existing records on a retry / concurrent loser.
    const args = buildAcceptAndCreateJobRpcArgs(input, {
      sourceSentTotalOre: source.source_sent_total_ore,
    });
    const rpc = asAcceptAndCreateJobRpcClient(db);
    const { data, error } = await rpc.rpc("accept_quote_and_create_job", {
      p_tenant_id: ctx.tenantContext.tenantId, // resolved tenant, never a client id
      p_quote_version_id: args.p_quote_version_id,
      p_accepted_at: args.p_accepted_at,
      p_accepted_price_ore: args.p_accepted_price_ore,
      p_source_sent_total_ore: args.p_source_sent_total_ore,
      p_channel: args.p_channel,
      p_adjustment_reason: args.p_adjustment_reason,
      p_evidence_file_id: args.p_evidence_file_id,
      p_evidence_reference: args.p_evidence_reference,
      p_notes: args.p_notes,
      p_planned_start_date: args.p_planned_start_date,
      p_planned_end_date: args.p_planned_end_date,
      p_title: args.p_title,
      p_fault_inject: args.p_fault_inject,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    // Map the RPC error. The 7.2 transaction's row lock + existing-record short-circuit resolves a
    // concurrent accept into an idempotent RETURN (AC2's primary behavior), so a raced 23505 on the
    // one-acceptance-per-version backstop should essentially never reach here — but IF it does (the
    // genuinely-unresolvable race), surface the dedicated `ACCEPTANCE_ALREADY_RECORDED` code (Task
    // 3.2) rather than the generic VALIDATION_FAILED, so the caller can present the "already
    // accepted, refresh to see it" message. Every OTHER code (QV409 / 23503 / 42501 / 23514 / 22P02 /
    // QV703 injected fault) delegates to the shared quote-write mapper unchanged.
    if (error) {
      if (
        error.code === "23505" &&
        typeof error.message === "string" &&
        error.message.includes("quote_acceptances_version_unique")
      ) {
        throw new CommandError("ACCEPTANCE_ALREADY_RECORDED");
      }
      throwMappedQuoteWriteError(error);
    }

    const result = extractAcceptAndCreateJobResult(data);
    if (result === null) {
      throw new Error("acceptQuoteAndCreateJob: RPC returned no result");
    }

    return {
      targetId: result.acceptanceId,
      acceptanceId: result.acceptanceId,
      jobId: result.jobId,
    };
  },
  // No envelope auditFields: the command owns its (conditional) audit write above.
});
