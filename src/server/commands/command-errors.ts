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
 * - `FILE_ACCESS_DENIED`         — a file-specific denial on an OWNED, visible file:
 *   the LIFECYCLE gate (archived/deleted) refused signing, or storage signing failed
 *   (Story 8.1). Cross-tenant / not-found file failures still use TENANT_ACCESS_DENIED
 *   with the SAME shape — no existence disclosure (R-809).
 * - `COMMAND_CONFLICT`           — RESERVED for idempotent/retry-able commands; not
 *   yet emitted by any command this story builds.
 * - `ACCEPTANCE_ALREADY_RECORDED` — the Story 7.2 idempotency conflict surface: a
 *   raced `accept_quote_and_create_job` lost the `unique (quote_version_id)` race
 *   (23505 on `quote_acceptances_version_unique`) AND the RPC could not resolve it
 *   into an idempotent existing-record return (the genuinely-unresolvable concurrent
 *   loser). The PRIMARY AC2 behavior is the idempotent RETURN of the existing records
 *   (not an error); this code surfaces ONLY the exceptional raced-insert case. Generic
 *   + user-safe (no row/status leak). Co-exists with `COMMAND_CONFLICT` /
 *   `QUOTE_VERSION_LOCKED` / `QUOTE_VERSION_NOT_DRAFT` — never merge or rename them.
 * - `QUOTE_VERSION_NOT_DRAFT`    — a draft-scoped edit (Story 6.2) targeted a quote
 *   version whose status is NOT `draft` (sent/accepted/rejected/expired/superseded).
 *   The load-bearing draft-only edit-scope guard: a sent/accepted version is never
 *   mutable through the 6.2 draft-edit path even if a crafted request submits its id.
 *   Distinct from Story 6.4's `QUOTE_VERSION_LOCKED` (the sent-immutability DB lock) —
 *   6.2 does NOT introduce or borrow that code.
 * - `QUOTE_VERSION_LOCKED`       — the Story 6.4 SENT-IMMUTABILITY lock: a customer-
 *   visible / commitment mutation (or the mark-sent RPC's own not-draft assertion)
 *   targeted a SENT (or any non-draft) quote version. Enforced at BOTH layers — the
 *   mark-sent command re-asserts `status='draft'` (command guard) AND a DB trigger
 *   RAISES (SQLSTATE `QV409`) on a direct own-tenant authenticated UPDATE of a locked
 *   column below the command (architecture §9). DISTINCT from 6.2's
 *   `QUOTE_VERSION_NOT_DRAFT`: that is the draft-only EDIT-scope rejection; this is the
 *   post-send IMMUTABILITY lock. Both codes co-exist — never merge or rename them.
 * - `ACCEPTED_RECORD_LOCKED`     — the Story 7.4 ACCEPTED-IMMUTABILITY lock: a
 *   commitment mutation targeted an ACCEPTED record — a `quote_acceptances` row (version
 *   ref / evidence / accepted price / accepted timestamp / channel / source sent total /
 *   …) or a `jobs` immutable source ref (quote_acceptance_id / quote_version_id /
 *   customer_id). Enforced at BOTH layers — the 7.3 `updateJob` command unknown-field-
 *   rejects a smuggled immutable field (VALIDATION_FAILED at the command) AND a DB trigger
 *   RAISES (SQLSTATE `AR704`) on a DIRECT own-tenant authenticated UPDATE of a locked
 *   column below the command (architecture §9; the load-bearing proof). This is the
 *   Epic-7 accepted-immutability lock, DISTINCT from 6.4's `QUOTE_VERSION_LOCKED` (the
 *   sent-version lock) and 6.2's `QUOTE_VERSION_NOT_DRAFT` — all co-exist, NEVER merge or
 *   rename them. `AR704` → `ACCEPTED_RECORD_LOCKED` is a DISTINCT-but-related SIBLING of
 *   6.4's `QV409` → `QUOTE_VERSION_LOCKED` (the "one model, three scopes, shared lock-code
 *   FAMILY not a fork" retro constraint: a family means related-but-distinct codes with a
 *   shared trigger shape, not one reused code and not a divergent mechanism — Epic 6
 *   sent-freeze R-605, Epic 7 accepted-lock R-704, Epic 8.4 locked-evidence-file).
 * - `SERVER_ERROR`              — a TRANSIENT infra failure during the command
 *   (reused from Story 2.2). Generic + retryable; leaks nothing internal.
 */
export type CommandErrorCode =
  | TenantContextErrorCode // UNAUTHENTICATED | TENANT_MEMBERSHIP_REQUIRED | SERVER_ERROR
  | "VALIDATION_FAILED"
  | "TENANT_ACCESS_DENIED"
  | "FILE_ACCESS_DENIED"
  | "COMMAND_CONFLICT"
  | "ACCEPTANCE_ALREADY_RECORDED"
  | "QUOTE_VERSION_NOT_DRAFT"
  | "QUOTE_VERSION_LOCKED"
  | "ACCEPTED_RECORD_LOCKED";

/**
 * A SANCTIONED typed-error escape for a command `execute` body (Story 3.1).
 *
 * The envelope maps ANY plain throw from `execute` to the transient `SERVER_ERROR`
 * (a raw stack must never cross the boundary). But some legitimate, DETERMINISTIC
 * outcomes only become visible at the DB layer DURING execute — e.g. a composite
 * same-tenant FK rejecting a cross-tenant parent link (`23503`), which is an
 * authorization outcome (`TENANT_ACCESS_DENIED`), NOT a transient infra fault. A
 * command may throw a `CommandError(code)` to surface that STABLE code through the
 * envelope instead of an opaque `SERVER_ERROR`.
 *
 * This is a SHARED primitive (not a per-command mechanism): the envelope-core
 * recognizes it, maps it to its `COMMAND_MESSAGES[code]`, and — like every other
 * failed gate — writes NO audit row. A plain `Error` still maps to `SERVER_ERROR`,
 * so the existing transient-fault behavior is unchanged.
 */
export class CommandError extends Error {
  readonly code: CommandErrorCode;
  constructor(code: CommandErrorCode) {
    super(code);
    this.name = "CommandError";
    this.code = code;
  }
}

/** True iff `e` is a `CommandError` carrying a stable `CommandErrorCode`. */
export function isCommandError(e: unknown): e is CommandError {
  return (
    e instanceof CommandError ||
    (typeof e === "object" &&
      e !== null &&
      (e as { name?: unknown }).name === "CommandError" &&
      typeof (e as { code?: unknown }).code === "string")
  );
}

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
  // File-specific denial (lifecycle-ineligible / signing failed) on an OWNED file.
  // Deliberately generic + user-safe — no "file exists but archived" style disclosure.
  FILE_ACCESS_DENIED:
    "Filen kan inte kommas åt just nu.",
  // Reserved for idempotent/retry-able commands (unused until one lands).
  COMMAND_CONFLICT:
    "Åtgärden kunde inte slutföras på grund av en konflikt. Försök igen.",
  // Story 7.2 idempotency conflict: a raced accept lost the one-acceptance-per-version
  // race and could not resolve into an idempotent return. Generic + user-safe (no leak).
  ACCEPTANCE_ALREADY_RECORDED:
    "Den här offertversionen har redan accepterats. Uppdatera sidan för att se den registrerade acceptansen.",
  // A draft-scoped edit targeted a non-draft version (sent/accepted/…): once a version is
  // sent its customer-visible content is immutable — changes require a new version.
  QUOTE_VERSION_NOT_DRAFT:
    "Den här versionen är inte ett utkast och kan inte redigeras. Skapa en ny version för att göra ändringar.",
  // The Story 6.4 sent-immutability lock: a sent (or any non-draft) version's customer-visible
  // content is locked — changes require a new version. Generic + user-safe (no row/status leak).
  QUOTE_VERSION_LOCKED:
    "Den här versionen är skickad och är låst. Skapa en ny version för att göra ändringar.",
  // The Story 7.4 accepted-immutability lock: an accepted record's commitment data (accepted
  // price, source total, evidence, source version, acceptance timestamp/channel, job source refs)
  // is locked — a correction requires an approved audited workflow, NOT a silent edit. Generic +
  // user-safe (no row/status/PII leak). Distinct from QUOTE_VERSION_LOCKED (co-exist, never merge).
  ACCEPTED_RECORD_LOCKED:
    "Den accepterade posten är låst. Korrigeringar kräver ett godkänt granskat arbetsflöde.",
};
