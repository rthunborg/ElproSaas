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

type CommandCapability = NonNullable<CommandConfig<unknown, unknown>["capability"]>;

/**
 * The Phase A command declaration bridge. Commands retain their local business
 * names for audit compatibility while this closed map gives every exported
 * mutation a matrix capability before validation, ownership lookup, execution,
 * or audit. New commands must be added here or remain fail-closed.
 */
/**
 * Closed command-to-capability metadata, exported for the authorization harness.
 * It remains server-only and is validated against the active matrix by tests.
 */
export const COMMAND_CAPABILITIES: Readonly<Record<string, CommandCapability>> = {
  "customer.create": { module: "crm", capability: "Customers.Create" },
  "customer.update": { module: "crm", capability: "Customers.Edit" },
  "customer.archive": { module: "crm", capability: "Customers.Delete" },
  "facility.create": { module: "crm", capability: "Customers.Create" },
  "facility.update": { module: "crm", capability: "Customers.Edit" },
  "facility.archive": { module: "crm", capability: "Customers.Delete" },
  "contact.create": { module: "crm", capability: "Customers.Create" },
  "contact.update": { module: "crm", capability: "Customers.Edit" },
  "contact.archive": { module: "crm", capability: "Customers.Delete" },
  "company_settings.update": { module: "settings", capability: "CompanySettings.Edit" },
  "quote_terms.update": { module: "settings", capability: "CompanySettings.Edit" },
  "quote_terms.approve": { module: "settings", capability: "CompanySettings.Edit" },
  "work_role.upsert": { module: "settings", capability: "Pricing.Edit" },
  "work_role.archive": { module: "settings", capability: "Pricing.Edit" },
  "work_role.reactivate": { module: "settings", capability: "Pricing.Edit" },
  "article.upsert": { module: "settings", capability: "Pricing.Edit" },
  "article.archive": { module: "settings", capability: "Pricing.Edit" },
  "article.reactivate": { module: "settings", capability: "Pricing.Edit" },
  "calculation.create": { module: "calculations", capability: "Calculations.Create" },
  "calculation.update": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.archive": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.section.create": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.section.update": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.section.archive": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.row.create": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.row.update": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.row.archive": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.rows.reorder": { module: "calculations", capability: "Calculations.Edit" },
  "calculation.sections.reorder": { module: "calculations", capability: "Calculations.Edit" },
  "quote.version.create": { module: "quotes", capability: "Quotes.Create" },
  "quote.version.new": { module: "quotes", capability: "Quotes.Create" },
  "quote.version.update_draft": { module: "quotes", capability: "Quotes.Edit" },
  "quote.version.mark_sent": { module: "quotes", capability: "Quotes.Send" },
  "quote.delivery.correct_recipient": { module: "quotes", capability: "Quotes.Send" },
  "quote.version.lifecycle": { module: "quotes", capability: "Quotes.Edit" },
  "quote.version.lost": { module: "quotes", capability: "Quotes.Edit" },
  "quote.acceptance.capture": { module: "quotes", capability: "Quotes.Approve" },
  "quote.acceptance.accept_and_create_job": { module: "quotes", capability: "Quotes.Approve" },
  "quote.follow_up.plan": { module: "quotes", capability: "Quotes.Edit" },
  "quote.follow_up.complete": { module: "quotes", capability: "Quotes.Edit" },
  "quote.follow_up.annotate": { module: "quotes", capability: "Quotes.Edit" },
  "quote.pdf.generate": { module: "quotes", capability: "Quotes.Export" },
  "quote.pdf.signedAccess.create": { module: "quotes", capability: "Quotes.Export" },
  "job.create": { module: "jobs", capability: "Jobs.Create" },
  "job.update": { module: "jobs", capability: "Jobs.Edit" },
  "file.signedAccess.create": { module: "files", capability: "Files.View" },
  "file.link.create": { module: "files", capability: "Files.Create" },
  "file.upload": { module: "files", capability: "Files.Create" },
  "file.archive": { module: "files", capability: "Files.Edit" },
};

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
  /** Explicit server-only capability gate, evaluated before validation/ownership/audit. */
  readonly capability?: { readonly module: string; readonly capability: string };
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
  const enrolled = COMMAND_CAPABILITIES[config.command];
  if (!enrolled && !config.capability) {
    throw new Error(`command capability enrollment missing: ${config.command}`);
  }
  if (enrolled && config.capability && (config.capability.module !== enrolled.module || config.capability.capability !== enrolled.capability)) {
    throw new Error(`command capability enrollment missing: ${config.command}`);
  }
  if (!enrolled) return { config };
  return { config: { ...config, capability: enrolled } };
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
      capability: config.capability,
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
      // Thread the ALREADY-RESOLVED execute context (real tenantContext + validated
      // input + single-instant clock + correlation id) straight into the write —
      // never reconstruct synthetic authority fields from the serialized AuditRow.
      // The `row` still carries the derived audit fields (event/target/metadata).
      // [Review][Patch][Med]
      recordAudit: async (row, execCtx) => {
        await writeAuditEvent(execCtx, row.command, {
          eventType: row.event_type,
          targetType: row.target_type,
          targetId: row.target_id,
          metadata: row.metadata,
        });
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
 * A tenant-scoped SELECT under RLS. Commands with no ownership target pass through.
 *
 * Fail-closed on BOTH branches, but with the CORRECT semantics ([Review][Decision]):
 *   - a transient DB/query ERROR (timeout, connection reset) → SERVER_ERROR
 *     (retryable; correct observability) — NOT masked as a permanent access denial;
 *   - a genuine zero-rows result (target in another tenant, or no such row under the
 *     caller's RLS scope) → TENANT_ACCESS_DENIED (R-004).
 * Neither branch executes the command or writes an audit row.
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

  // A DB/query error is a transient infra fault, NOT an authorization decision —
  // surface it as SERVER_ERROR so a legitimately-owned target is not reported as
  // "no access" during an outage (and the caller can retry). Fail closed: still no
  // execute, no audit.
  if (error) {
    return { ok: false, code: "SERVER_ERROR" };
  }
  // RLS narrows the visible rows to the caller's tenant: a target in ANOTHER tenant
  // (or no such row) returns zero rows → the target is not provably owned by the
  // resolved tenant → DENIED (R-004).
  if (!data || data.length === 0) {
    return { ok: false, code: "TENANT_ACCESS_DENIED" };
  }
  return { ok: true };
}
