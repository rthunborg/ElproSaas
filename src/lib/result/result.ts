/**
 * Minimal `Result` discriminated union for server-command control flow.
 *
 * Architecture §3 lists `src/lib/result/` as the home for this primitive; §5 and §22
 * require server commands to return stable, typed results with user-safe error codes
 * rather than throwing raw errors across the boundary. A thrown stack trace must never
 * reach the client — successes and failures are both data here.
 *
 * This is intentionally tiny: the first consumer is `resolveTenantContext` (Story 2.1).
 * Later command stories (Epic 2.3+) reuse and may extend it; keep it stable.
 */

export type Ok<T> = { readonly ok: true; readonly data: T };

/**
 * A failure carries a STABLE machine code plus a user-safe message. The code is the
 * contract tests assert on; the message is what a UI may show. Neither may leak
 * internal detail (stack traces, which tenant/user exists, SQL, etc.) — see §5/§22 and
 * ux-design-specification.md §11 (generic access message, no cross-tenant leakage).
 */
export type Err<C extends string> = {
  readonly ok: false;
  readonly code: C;
  readonly message: string;
};

export type Result<T, C extends string> = Ok<T> | Err<C>;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err<C extends string>(code: C, message: string): Err<C> {
  return { ok: false, code, message };
}
