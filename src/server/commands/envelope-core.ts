/**
 * PURE decision core for the server command envelope (Story 2.3; architecture §5
 * steps 1-9). Mirrors `resolve-tenant-context-core.ts`: NO I/O, NO Supabase SDK —
 * it receives already-resolved inputs (the tenant-context Result, the validators,
 * the ownership checker, the execute body, the audit sink) and decides the typed
 * `Result` in the EXACT §5 gate order. Keeping it pure makes the gate ordering and
 * stable-code mapping exhaustively unit-testable WITHOUT a database.
 *
 * Gate order (short-circuits at the FIRST failing gate — deterministic, not
 * last-writer-wins):
 *   1. tenant context (auth + membership) — reuses `resolveTenantContext`'s Result.
 *      A failure code (UNAUTHENTICATED | TENANT_MEMBERSHIP_REQUIRED | SERVER_ERROR)
 *      is surfaced verbatim.
 *   2. validate typed input (step 4)            -> VALIDATION_FAILED
 *   3. verify tenant ownership of targets (5)   -> TENANT_ACCESS_DENIED
 *   4. execute the command body (6-7). A THROW here is a TRANSIENT infra fault ->
 *      SERVER_ERROR (never a raw throw/stack across the boundary).
 *   5. write the append-only audit row (8) IFF the command is auditable AND
 *      execute succeeded — exactly ONCE, with the single command timestamp.
 *   6. return ok(execute result) (9).
 *
 * The single command timestamp (H1): `clock.now()` is captured ONCE here and
 * threaded into the execute context AND the audit row's `created_at`, so they
 * share one instant (no `Date.now()` drift; tests assert it with a fixed clock).
 *
 * No audit row is written on ANY failed gate (AC2), and a failure Result carries no
 * `data` and no internal detail (stack/SQL/tenant-or-user-existence signal).
 */
import { err, ok, type Result } from "@/lib/result/result";
import {
  COMMAND_MESSAGES,
  type CommandErrorCode,
} from "./command-errors";
import { systemClock, type CommandClock } from "./clock";
import type { TenantContext } from "@/server/auth/tenant-context";

/** Outcome of the input validator (step 4). Generic on the validated value. */
export type ValidationResult<I> =
  | { readonly ok: true; readonly data: I }
  | { readonly ok: false; readonly code: "VALIDATION_FAILED" };

/** Outcome of the tenant-ownership check (step 5). */
export type OwnershipResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "TENANT_ACCESS_DENIED" };

/**
 * The context handed to `execute` (steps 6-7). Carries the resolved tenant
 * authority, the validated input, the single command clock + correlation id, and
 * (in the I/O orchestrator) the request-bound db client.
 */
export type CommandExecuteContext<I, DB = unknown> = {
  readonly tenantContext: TenantContext;
  readonly input: I;
  readonly clock: CommandClock;
  readonly correlationId: string;
  readonly db: DB;
};

/** The append-only audit row the core emits on a successful auditable command. */
export type AuditRow = {
  readonly tenant_id: string;
  readonly actor_user_id: string;
  readonly command: string;
  readonly event_type: string;
  readonly target_type: string;
  readonly target_id: string | null;
  readonly correlation_id: string;
  readonly metadata: Record<string, unknown>;
  /** ISO string of the single captured command timestamp (H1). */
  readonly created_at: string;
};

/**
 * The pre-resolved tenant-context Result the core consumes (mirrors
 * `resolveTenantContext`'s return). Decoupled from the resolver's exact error union
 * so the core can re-emit any failure code on the shared envelope message map.
 */
export type TenantContextResultLike =
  | { readonly ok: true; readonly data: TenantContext }
  | { readonly ok: false; readonly code: CommandErrorCode; readonly message?: string };

export type RunCommandCoreInput<I, R, DB = unknown> = {
  /** Step 1-3: the resolved auth+membership Result (reuses resolveTenantContext). */
  readonly tenantContextResult: TenantContextResultLike;
  /** Step 4: typed input validator. */
  readonly validate: (raw: unknown) => ValidationResult<I>;
  /** The raw, untrusted command input. */
  readonly rawInput: unknown;
  /** Step 5: tenant-ownership verification for any target ids. */
  readonly verifyOwnership: (
    ctx: CommandExecuteContext<I, DB>,
  ) => Promise<OwnershipResult> | OwnershipResult;
  /** Steps 6-7: the command body. A throw is a transient fault → SERVER_ERROR. */
  readonly execute: (ctx: CommandExecuteContext<I, DB>) => Promise<R> | R;
  /** Step 8: derive the audit metadata + target for the row (sanitized upstream). */
  readonly buildAuditFields?: (
    ctx: CommandExecuteContext<I, DB>,
    result: R,
  ) => {
    readonly targetType: string;
    readonly targetId: string | null;
    readonly metadata: Record<string, unknown>;
  };
  /** Step 8: the audit sink (writes ONE row). Called only on success + auditable. */
  readonly recordAudit: (row: AuditRow) => Promise<void> | void;
  /** Whether this command writes an audit row on success. */
  readonly auditable: boolean;
  /** The command name (audit `command`). */
  readonly command: string;
  /** The lifecycle event type (audit `event_type`). */
  readonly eventType: string;
  /** Default target_type when `buildAuditFields` is not supplied. */
  readonly targetType?: string;
  /** The single command clock (defaults to the real systemClock). */
  readonly clock?: CommandClock;
  /** The per-command correlation id (defaults to a fresh uuid). */
  readonly correlationId?: string;
  /** The request-bound db client threaded into the execute context. */
  readonly db?: DB;
};

export type RunCommandResult<R> = Result<R, CommandErrorCode>;

/**
 * Run the envelope decision core over already-resolved inputs. See the file header
 * for the gate order and the single-timestamp discipline.
 */
export async function runCommandCore<I, R, DB = unknown>(
  input: RunCommandCoreInput<I, R, DB>,
): Promise<RunCommandResult<R>> {
  const {
    tenantContextResult,
    validate,
    rawInput,
    verifyOwnership,
    execute,
    buildAuditFields,
    recordAudit,
    auditable,
    command,
    eventType,
    targetType,
    clock = systemClock,
    correlationId = crypto.randomUUID(),
    db,
  } = input;

  // ── Gate 1-3: auth + membership (reused tenant-context Result). ──────────────
  if (!tenantContextResult.ok) {
    const code = tenantContextResult.code;
    return err(code, COMMAND_MESSAGES[code]);
  }
  const tenantContext = tenantContextResult.data;

  // ── Gate 4: typed input validation. Generic message — NEVER echo the raw value. ─
  const validated = validate(rawInput);
  if (!validated.ok) {
    return err("VALIDATION_FAILED", COMMAND_MESSAGES.VALIDATION_FAILED);
  }

  // Capture the SINGLE command timestamp ONCE (H1). Threaded into execute + audit.
  const commandInstant = clock.now();
  const fixedClock: CommandClock = { now: () => commandInstant };
  const execCtx: CommandExecuteContext<I, DB> = {
    tenantContext,
    input: validated.data,
    clock: fixedClock,
    correlationId,
    db: db as DB,
  };

  // ── Gate 5: tenant-ownership of any target ids. ──────────────────────────────
  const ownership = await verifyOwnership(execCtx);
  if (!ownership.ok) {
    return err("TENANT_ACCESS_DENIED", COMMAND_MESSAGES.TENANT_ACCESS_DENIED);
  }

  // ── Step 6-7: execute. A throw is a TRANSIENT infra fault → SERVER_ERROR. No
  //    raw throw/stack/SQL crosses the boundary; no audit row on this failure. ──
  let result: R;
  try {
    result = await execute(execCtx);
  } catch {
    return err("SERVER_ERROR", COMMAND_MESSAGES.SERVER_ERROR);
  }

  // ── Step 8: append-only audit (only on success AND auditable; exactly once). ──
  if (auditable) {
    const fields = buildAuditFields?.(execCtx, result) ?? {
      targetType: targetType ?? "",
      targetId: null,
      metadata: {},
    };
    const row: AuditRow = {
      tenant_id: tenantContext.tenantId,
      actor_user_id: tenantContext.userId,
      command,
      event_type: eventType,
      target_type: fields.targetType,
      target_id: fields.targetId,
      correlation_id: correlationId,
      metadata: fields.metadata,
      created_at: commandInstant.toISOString(),
    };
    // The audit write itself failing is a transient infra fault → SERVER_ERROR
    // (fail closed; do NOT return ok while the audit row was not persisted).
    try {
      await recordAudit(row);
    } catch {
      return err("SERVER_ERROR", COMMAND_MESSAGES.SERVER_ERROR);
    }
  }

  // ── Step 9: typed ok. ────────────────────────────────────────────────────────
  return ok(result);
}
