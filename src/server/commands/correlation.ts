/**
 * Correlation / request id primitive (Story 2.3; architecture §15, §5).
 *
 * One correlation id per command invocation, written to
 * `audit_events.correlation_id` and available to logs for tracing a request
 * across rows. A future route handler can pass an inbound request id straight
 * through (so a single client request and its server command share an id);
 * otherwise a fresh UUID is generated.
 *
 * This is intentionally a PLAIN VALUE helper — Phase A has no logging framework
 * and this story does NOT introduce one. UUIDs use the built-in Web Crypto
 * `crypto.randomUUID()` (Node >=20 / the runtime already uses it).
 */

/** A correlation id is a UUID string. */
export type CorrelationId = string;

/**
 * RFC-4122 UUID shape. `audit_events.correlation_id` (and `p_correlation_id`) are
 * `uuid not null`, so a non-UUID inbound id would make the DB cast throw `22P02`
 * AFTER `execute` already ran, collapsing a forwarded request id into an opaque
 * `SERVER_ERROR`. We therefore only accept a UUID-shaped inbound id; anything else
 * (and anything over-long) falls back to a freshly generated UUID. Accepts any UUID
 * version/variant Postgres' `uuid` type accepts (not just v4). [Review][Patch][High]
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A UUID string is 36 chars; bound defensively so an unbounded header never flows on. */
const MAX_CORRELATION_ID_LENGTH = 36;

/** True iff `value` is shaped like a UUID Postgres' `uuid` type will accept. */
export function isUuid(value: string): boolean {
  return value.length <= MAX_CORRELATION_ID_LENGTH && UUID_RE.test(value);
}

/**
 * Resolve the correlation id for a command invocation.
 *
 * - If a caller supplies an inbound id (e.g. a route handler forwarding a request
 *   id) AND it is UUID-shaped, it is used so the client request and the command
 *   share one id.
 * - Otherwise (missing, empty, over-long, or not UUID-shaped) a fresh UUID is
 *   generated. The destination column is `uuid not null`, so a non-UUID id can
 *   NEVER flow through — preventing an opaque `22P02`→`SERVER_ERROR` after execute.
 *
 * The supplied id is NOT trusted for any authority decision — it is purely a
 * tracing/audit value.
 */
export function resolveCorrelationId(inbound?: string | null): CorrelationId {
  if (typeof inbound === "string" && isUuid(inbound)) {
    return inbound;
  }
  return crypto.randomUUID();
}
