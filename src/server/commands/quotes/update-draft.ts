/**
 * `updateDraftQuoteVersion` — the Story 6.2 DRAFT-edit command (architecture §5; R-605/R-616).
 *
 * A `defineCommand` through the EXISTING envelope (resolve user → resolve active tenant_admin →
 * validate typed input → envelope `ownership` verifies the quote_version id is own-tenant-visible
 * → in execute LOAD the version and RE-ASSERT `status === 'draft'` → call the narrow checked RPC
 * with ONLY the allowed customer-visible PRESENTATIONAL patch + actor/correlation). The RPC owns
 * the update and append-only audit atomically; authenticated direct quote-version DML is revoked.
 *
 * ── THE LOAD-BEARING ENFORCEMENT (a UI-only lock is a STOP CONDITION) ─────────────────────
 * The `status === 'draft'` re-assert runs SERVER-SIDE against the REAL row BEFORE any write.
 * A sent/accepted/rejected/expired/superseded version is rejected with the stable typed
 * `QUOTE_VERSION_NOT_DRAFT` — even if a crafted request submits its id. The UI read-only state
 * is a convenience, NOT the guarantee. (The full sent-immutability DB trigger + the
 * `QUOTE_VERSION_LOCKED` mark-sent lock are Story 6.4 — 6.2 owns the draft-only edit scope,
 * and does NOT introduce/borrow `QUOTE_VERSION_LOCKED`.)
 *
 * ── SCOPE (conservative) ──────────────────────────────────────────────────────────────────
 * A draft edit touches ONLY presentational fields (intro text, customer-visible notes, validity
 * date, display mode). It does NOT re-read/re-freeze the source calc and NEVER touches lines /
 * price / VAT / ROT — a change to the customer-commitment TOTALS/lines is a NEW version via the
 * Story 6.5 RPC, surfaced as the "Create new version" affordance instead. tenant_id/status/
 * totals are never accepted from the client.
 *
 * The resolved `ctx.tenantContext.tenantId` is the ONLY tenant authority; the request-bound
 * authenticated client invokes a checked SECURITY DEFINER function (NEVER service-role). An id-only edit short-circuits to a
 * no-op returning the id (the empty-patch guard) so it does not produce a false
 * TENANT_ACCESS_DENIED on an owned, visible draft.
 */
import { defineCommand } from "../envelope";
import { CommandError } from "../command-errors";
import {
  asUpdateDraftQuoteVersionRpcClient,
  loadQuoteVersionStatus,
  throwMappedQuoteWriteError,
} from "./quote-db";
import {
  validateUpdateDraftQuoteVersion,
  type UpdateDraftQuoteVersionInput,
} from "./validation";

/** Result of the draft-edit command — the edited version id under `targetId`. */
export interface UpdateDraftQuoteVersionResult {
  readonly targetId: string;
}

/** Build the UPDATE patch (only the supplied presentational fields; snake_case DB columns). */
function buildDraftPatch(
  input: UpdateDraftQuoteVersionInput,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.intro_text !== undefined) patch.intro_text = input.intro_text;
  if (input.customer_notes !== undefined) patch.customer_notes = input.customer_notes;
  if (input.valid_until !== undefined) patch.valid_until = input.valid_until;
  if (input.display_mode !== undefined) patch.display_mode = input.display_mode;
  return patch;
}

export const updateDraftQuoteVersion = defineCommand<
  UpdateDraftQuoteVersionInput,
  UpdateDraftQuoteVersionResult
>({
  command: "quote.version.update_draft",
  auditable: false,
  eventType: "quote.version.draft_updated",
  targetType: "quote_version",
  validateInput: validateUpdateDraftQuoteVersion,
  // Ownership: the target version must be visible under the caller's RLS (own tenant). A
  // foreign / non-existent id → zero rows → TENANT_ACCESS_DENIED BEFORE execute.
  ownership: (input) => ({ table: "quote_versions", id: input.quote_version_id }),
  execute: async (ctx): Promise<UpdateDraftQuoteVersionResult> => {
    // ── RE-ASSERT DRAFT (the load-bearing guard). Ownership proved visibility; now load the ──
    // ── REAL current status and reject anything but a draft.                                  ──
    const status = await loadQuoteVersionStatus(ctx.db, ctx.input.quote_version_id);
    // Visible under ownership but gone now (race) → deny rather than 500.
    if (status === null) throw new CommandError("TENANT_ACCESS_DENIED");
    if (status !== "draft") throw new CommandError("QUOTE_VERSION_NOT_DRAFT");

    const patch = buildDraftPatch(ctx.input);
    // Empty-patch guard: an id-only edit is a no-op — do NOT issue `.update({})` (PostgREST can
    // map it to zero rows → a false TENANT_ACCESS_DENIED on an owned, visible draft).
    if (Object.keys(patch).length === 0) {
      return { targetId: ctx.input.quote_version_id };
    }

    const db = asUpdateDraftQuoteVersionRpcClient(ctx.db);
    const { error } = await db.rpc("update_draft_quote_version", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_quote_version_id: ctx.input.quote_version_id,
      p_patch: patch,
      p_occurred_at: ctx.clock.now().toISOString(),
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
    });
    if (error) throwMappedQuoteWriteError(error);
    return { targetId: ctx.input.quote_version_id };
  },
});
