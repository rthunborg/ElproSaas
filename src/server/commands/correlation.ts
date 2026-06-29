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
 * Resolve the correlation id for a command invocation.
 *
 * - If a caller supplies an inbound id (e.g. a route handler forwarding a request
 *   id), it is used as-is so the client request and the command share one id.
 * - Otherwise a fresh UUID is generated.
 *
 * The supplied id is NOT trusted for any authority decision — it is purely a
 * tracing/audit value.
 */
export function resolveCorrelationId(inbound?: string | null): CorrelationId {
  if (typeof inbound === "string" && inbound.length > 0) {
    return inbound;
  }
  return crypto.randomUUID();
}
