/**
 * Injectable command clock (Story 2.3, H1 / R-011; architecture §5 Time discipline).
 *
 * A single `clock.now()` is captured ONCE at the start of a command and threaded
 * into every lifecycle field, every event-type derivation, and the audit
 * `created_at` — so they ALL share the ONE deterministic command timestamp. Tests
 * inject a fixed clock and assert on the deterministic value WITHOUT sleeps; no
 * `Date.now()` is read mid-command (which would drift across fields).
 *
 * Forward seam (Epic 6/7, ADR-A009): where a transactional RPC lands later, the
 * RPC accepts the captured timestamp as an explicit parameter (exactly as
 * `record_audit_event(p_created_at)` already does). We note that seam here but do
 * NOT build an RPC for it in this story.
 */

/** The minimal clock contract the envelope captures once per command. */
export type CommandClock = {
  /** Returns the current instant. The envelope calls this EXACTLY once per command. */
  now(): Date;
};

/**
 * The default real clock (wall time). Production commands use this; tests inject a
 * fixed clock instead. It is a frozen singleton — there is no per-call state.
 */
export const systemClock: CommandClock = {
  now(): Date {
    return new Date();
  },
};
