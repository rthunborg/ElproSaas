/**
 * The reusable SERVER COMMAND ENVELOPE (Story 2.3; architecture §5 steps 1-9).
 *
 * This is `resolveTenantContext` GENERALIZED to the full command shape:
 *   resolve user (cookies) → resolve membership → validate typed input →
 *   verify tenant ownership of targets → execute → append-only audit → typed Result.
 *
 * It is the AUTHORITY SURFACE every later sensitive mutation (Epics 3-8) plugs into:
 * a command declares its input validator, its name/auditable flag/event type, and an
 * `execute(ctx)` body — the envelope runs the §5 gates BEFORE `execute` and writes
 * the audit row AFTER it succeeds, returning a stable typed `Result`. No raw throw,
 * stack, SQL, or tenant/user-existence signal crosses the boundary.
 *
 * Reuses the established primitives — `Result`/`ok`/`err`, `resolveTenantContext`
 * (the getClaims()-backed auth + membership authority), the pure `runCommandCore`
 * gate logic, `writeAuditEvent` (the DEFINER-RPC append-only write), and the stable
 * `CommandErrorCode` union. It does NOT invent a new error mechanism or duplicate the
 * auth/membership logic.
 */
import { err, type Result } from "@/lib/result/result";
import {
  COMMAND_MESSAGES,
  type CommandErrorCode,
} from "./command-errors";
import { systemClock, type CommandClock } from "./clock";
import { resolveCorrelationId } from "./correlation";
import {
  runCommandCore,
  type CommandExecuteContext,
  type OwnershipResult,
  type ValidationResult,
} from "./envelope-core";
import { writeAuditEvent, type AuditDbClient } from "./audit";
import type {
  resolveTenantContext,
  ResolveTenantContextOptions,
} from "@/server/auth/resolve-tenant-context";

/**
 * The minimal Supabase client surface the envelope drives: the auth+membership
 * resolver client (`getClaims()` + `.from(...)`), the ownership SELECT, and the
 * audit-write `.rpc(...)`. The real `@supabase/ssr` server client and the test
 * anon-key client both satisfy this structurally.
 */
export type CommandDbClient = AuditDbClient & {
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
};

/** An ownership target the envelope verifies belongs to the resolved tenant. */
export type OwnershipTarget = {
  /** The table holding the target row (RLS-scoped to the caller's tenant). */
  readonly table: string;
  /** The target row id (client-supplied — verified, never trusted). */
  readonly id: string;
};

/** The declarative command definition (`defineCommand` input). */
export type CommandConfig<I, R> = {
  /** Stable command name (audit `command`). */
  readonly command: string;
  /** Whether a successful run writes an audit row. */
  readonly auditable: boolean;
  /** Lifecycle event type (audit `event_type`). */
  readonly eventType: string;
  /** The kind of target row (audit `target_type`). */
  readonly targetType: string;
  /** Typed input validator (step 4). Returns the validated value or VALIDATION_FAILED. */
  readonly validateInput: (raw: unknown) => ValidationResult<I>;
  /**
   * Optional ownership target derivation (step 5). When present, the envelope
   * verifies the target row belongs to the resolved tenant (a tenant-scoped SELECT
   * under RLS → zero rows ⇒ TENANT_ACCESS_DENIED) BEFORE calling `execute`.
   */
  readonly ownership?: (input: I) => OwnershipTarget | null;
  /** The command body (steps 6-7). */
  readonly execute: (
    ctx: CommandExecuteContext<I, CommandDbClient>,
  ) => Promise<R> | R;
  /**
   * Optional derivation of the audit row's target id + metadata from the result.
   * Defaults: `target_id` = `result.targetId` if it is a string, else null;
   * metadata = `result.metadata` if present (always sanitized downstream), else {}.
   */
  readonly auditFields?: (
    ctx: CommandExecuteContext<I, CommandDbClient>,
    result: R,
  ) => { readonly targetId: string | null; readonly metadata?: unknown };
};

/** An opaque, type-carrying command handle produced by `defineCommand`. */
export type Command<I, R> = {
  readonly config: CommandConfig<I, R>;
};

/** Options for a single `runCommand` invocation. */
export type RunCommandOptions = {
  /** The request-bound Supabase client (authed server client / test client). */
  readonly client: CommandDbClient;
  /** The raw, untrusted command input. */
  readonly input: unknown;
  /** The single command clock (defaults to the real systemClock). */
  readonly clock?: CommandClock;
  /** The per-command correlation id (a fresh uuid when omitted). */
  readonly correlationId?: string | null;
};

/** Declare a reusable command. Pure — performs no I/O until `runCommand`. */
export function defineCommand<I, R>(config: CommandConfig<I, R>): Command<I, R> {
  return { config };
}

/**
 * Run a declared command through the full §5 envelope against `client`.
 *
 * Steps 1-3 reuse `resolveTenantContext` with the injected client (getClaims()-backed
 * auth + active-tenant_admin membership — NEVER getSession, NEVER a client-supplied
 * tenant id as authority). The pure `runCommandCore` then enforces validate →
 * ownership → execute → audit → typed Result.
 */
export async function runCommand<I, R>(
  command: Command<I, R>,
  options: RunCommandOptions,
): Promise<Result<R, CommandErrorCode>> {
  const { config } = command;
  const { client, input, clock = systemClock } = options;
  const correlationId = resolveCorrelationId(options.correlationId ?? undefined);

  // Steps 1-3: resolve auth + membership via the established authority. Lazy import
  // keeps `next/headers` out of test bundles that inject their own client. The
  // resolver wraps its own I/O and returns a typed Result (never throws across).
  const { resolveTenantContext: resolve } = (await import(
    "@/server/auth/resolve-tenant-context"
  )) as { resolveTenantContext: typeof resolveTenantContext };

  // Wrap the whole orchestration so an unexpected throw (client misuse, SDK reject)
  // maps to SERVER_ERROR — no raw stack crosses the boundary.
  try {
    const tenantContextResult = await resolve({
      client: client as unknown as ResolveTenantContextOptions["client"],
    });

    return await runCommandCore<I, R, CommandDbClient>({
      tenantContextResult: tenantContextResult as never,
      validate: config.validateInput,
      rawInput: input,
      verifyOwnership: (ctx) => verifyOwnership(config, ctx),
      execute: config.execute,
      auditable: config.auditable,
      command: config.command,
      eventType: config.eventType,
      targetType: config.targetType,
      clock,
      correlationId,
      db: client,
      buildAuditFields: (ctx, result) => {
        const derived = config.auditFields?.(ctx, result);
        const targetId =
          derived?.targetId ?? defaultTargetId(result);
        const metadata = derived?.metadata;
        return {
          targetType: config.targetType,
          targetId,
          // Sanitization happens in writeAuditEvent; pass through raw here so the
          // core just carries it. The actual persisted row is written by recordAudit.
          metadata: (metadata ?? {}) as Record<string, unknown>,
        };
      },
      recordAudit: async (row) => {
        await writeAuditEvent(
          {
            tenantContext: {
              tenantId: row.tenant_id,
              userId: row.actor_user_id,
              role: "tenant_admin",
              status: "active",
              userEmail: null,
              tenantName: null,
            },
            input: input as I,
            clock: { now: () => new Date(row.created_at) },
            correlationId: row.correlation_id,
            db: client,
          },
          row.command,
          {
            eventType: row.event_type,
            targetType: row.target_type,
            targetId: row.target_id,
            metadata: row.metadata,
          },
        );
      },
    });
  } catch {
    return err("SERVER_ERROR", COMMAND_MESSAGES.SERVER_ERROR);
  }
}

/** Best-effort default target id from a command result carrying `{ targetId }`. */
function defaultTargetId(result: unknown): string | null {
  if (result && typeof result === "object" && "targetId" in result) {
    const id = (result as { targetId: unknown }).targetId;
    if (typeof id === "string") return id;
  }
  return null;
}

/**
 * Step 5: verify the command's ownership target belongs to the resolved tenant.
 * A tenant-scoped SELECT under RLS — zero rows (or an error) ⇒ TENANT_ACCESS_DENIED.
 * Commands with no ownership target pass through.
 */
async function verifyOwnership<I, R>(
  config: CommandConfig<I, R>,
  ctx: CommandExecuteContext<I, CommandDbClient>,
): Promise<OwnershipResult> {
  const target = config.ownership?.(ctx.input);
  if (!target) return { ok: true };

  const { data, error } = await ctx.db
    .from(target.table)
    .select("id")
    .eq("id", target.id)
    .limit(1);

  // RLS narrows the visible rows to the caller's tenant: a target in ANOTHER tenant
  // returns zero rows. A permission/query error also denies (fail closed). Either
  // way the target is not provably owned by the resolved tenant → DENIED (R-004).
  if (error || !data || data.length === 0) {
    return { ok: false, code: "TENANT_ACCESS_DENIED" };
  }
  return { ok: true };
}
