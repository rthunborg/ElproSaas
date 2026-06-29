/**
 * Stable typed error codes + user-safe messages for the server command envelope
 * (Story 2.3; architecture §5 stable-code list, §22).
 *
 * Mirrors the established `tenant-context.ts` code+message discipline: each code is
 * a STABLE machine contract tests assert on; each message is generic and user-safe
 * (no stack trace, no SQL, no tenant/user-existence signal, no echoed input). The
 * envelope returns these via the shared `Result`/`ok`/`err` primitive — it does NOT
 * invent a new error mechanism.
 *
 * The union EXTENDS the existing tenant-context codes (`UNAUTHENTICATED`,
 * `TENANT_MEMBERSHIP_REQUIRED`, `SERVER_ERROR`) with the new envelope codes
 * (`VALIDATION_FAILED`, `TENANT_ACCESS_DENIED`) plus `COMMAND_CONFLICT` (RESERVED
 * for idempotent/retry-able commands — the literal is defined so the contract is
 * stable, but no idempotency machinery is built in this story; it is unused until a
 * retry-able command lands, Epic 6/7).
 */
import {
  TENANT_CONTEXT_MESSAGES,
  type TenantContextErrorCode,
} from "@/server/auth/tenant-context";

/**
 * The envelope's stable error-code union (architecture §5).
 *
 * - `UNAUTHENTICATED`            — no re-validated user (reused from §5 step 1).
 * - `TENANT_MEMBERSHIP_REQUIRED` — authenticated, but no active tenant_admin.
 * - `VALIDATION_FAILED`          — typed input schema rejected (NEW). The message
 *   is generic — the raw invalid value is NEVER echoed.
 * - `TENANT_ACCESS_DENIED`       — a target id resolves to a different tenant, OR a
 *   client-submitted tenant id mismatches the resolved tenant (NEW; R-004).
 * - `COMMAND_CONFLICT`           — RESERVED for idempotent/retry-able commands; not
 *   yet emitted by any command this story builds.
 * - `SERVER_ERROR`              — a TRANSIENT infra failure during the command
 *   (reused from Story 2.2). Generic + retryable; leaks nothing internal.
 */
export type CommandErrorCode =
  | TenantContextErrorCode // UNAUTHENTICATED | TENANT_MEMBERSHIP_REQUIRED | SERVER_ERROR
  | "VALIDATION_FAILED"
  | "TENANT_ACCESS_DENIED"
  | "COMMAND_CONFLICT";

/**
 * User-safe Swedish messages (deliberately generic — no cross-tenant leakage, no
 * stack/SQL, no echoed input). Reuses the tenant-context messages verbatim for the
 * shared codes so the boundary speaks with one voice.
 */
export const COMMAND_MESSAGES: Record<CommandErrorCode, string> = {
  // Reused, identical to the tenant-context boundary messages.
  UNAUTHENTICATED: TENANT_CONTEXT_MESSAGES.UNAUTHENTICATED,
  TENANT_MEMBERSHIP_REQUIRED: TENANT_CONTEXT_MESSAGES.TENANT_MEMBERSHIP_REQUIRED,
  SERVER_ERROR: TENANT_CONTEXT_MESSAGES.SERVER_ERROR,
  // New envelope codes.
  VALIDATION_FAILED:
    "Begäran kunde inte behandlas eftersom indata var ogiltiga. Kontrollera och försök igen.",
  TENANT_ACCESS_DENIED:
    "Du har inte behörighet till den begärda resursen.",
  // Reserved for idempotent/retry-able commands (unused until one lands).
  COMMAND_CONFLICT:
    "Åtgärden kunde inte slutföras på grund av en konflikt. Försök igen.",
};
