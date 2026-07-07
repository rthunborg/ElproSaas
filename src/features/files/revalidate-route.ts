/**
 * PURE server-side revalidation-route derivation for the file actions (Story 8.5 —
 * epic-8 review finding: client-supplied `revalidate_path`).
 *
 * SECURITY BOUNDARY (why this exists): the upload/archive server actions must refresh the
 * entity route a file lives on after a successful write. The ORIGINAL implementation read a
 * hidden `revalidate_path` FORM field and passed it straight to Next's `revalidatePath()`
 * gated only by `startsWith("/")`. That let a tampered/mistargeted client force revalidation
 * of an ARBITRARY in-app route (e.g. `revalidate_path=/` busting the whole router cache).
 * There is NO reason to trust a client path here: the action already resolves the owner
 * (`owner_type`/`owner_id`) and the panels always know the owning entity's ids. So we DERIVE
 * the route ENTIRELY SERVER-SIDE from a CLOSED owner-route allow-list — a crafted client can
 * at most select a LEGITIMATE route TEMPLATE with a UUID-shaped id slotted in (never `/`,
 * never an arbitrary path). The free-form `revalidate_path` field is IGNORED (removed).
 *
 * The only client-supplied values that reach this module are ids, and each is UUID-validated
 * (`isUuid`) before it can enter a server-owned template — so the derived route is always one
 * of `/customers/{uuid}`, `/calculations/{uuid}`, `/jobs/{uuid}`, or
 * `/quotes/{uuid}/versions/{uuid}`. A non-UUID id → `null` (no revalidation), never a smuggled
 * path segment. This module is I/O-free so it is unit-testable in the fast `node --test` gate.
 */
import { isUuid } from "@/server/commands/correlation";

/**
 * The structured, server-derivable owner-route descriptor. Each variant carries ONLY the
 * ids needed to build a server-owned route template — NEVER a free-form path. `facility` and
 * `contact` render inside the parent customer hub, so they revalidate the CUSTOMER route
 * (keyed by the parent `customerId`, not the facility/contact id). `quote_acceptance` and
 * `quote_version` render inside the quote version subroute (keyed by `quoteId`+`versionId`).
 */
export type RevalidateOwnerRef =
  | { readonly kind: "customer"; readonly customerId: string }
  | { readonly kind: "calculation"; readonly calculationId: string }
  | { readonly kind: "job"; readonly jobId: string }
  | { readonly kind: "quote_version_subroute"; readonly quoteId: string; readonly versionId: string };

/**
 * Derive the in-app route to revalidate from a structured owner reference, applying a CLOSED
 * template allow-list. Every id is UUID-validated before it enters a template; a non-UUID id
 * (or an unknown kind) yields `null` (the action then skips revalidation — never a crafted
 * path). This is the ONLY place a file action route is computed; the client-supplied
 * `revalidate_path` is never consulted.
 */
export function ownerRoute(ref: RevalidateOwnerRef): string | null {
  switch (ref.kind) {
    case "customer":
      return isUuid(ref.customerId) ? `/customers/${ref.customerId}` : null;
    case "calculation":
      return isUuid(ref.calculationId) ? `/calculations/${ref.calculationId}` : null;
    case "job":
      return isUuid(ref.jobId) ? `/jobs/${ref.jobId}` : null;
    case "quote_version_subroute":
      return isUuid(ref.quoteId) && isUuid(ref.versionId)
        ? `/quotes/${ref.quoteId}/versions/${ref.versionId}`
        : null;
    default:
      return assertNeverRef(ref);
  }
}

/** Compile-time exhaustiveness guard for {@link ownerRoute}. */
function assertNeverRef(ref: never): never {
  throw new Error(`ownerRoute: no route for ref ${JSON.stringify(ref)}`);
}

/**
 * Build the {@link RevalidateOwnerRef} for a file action from the resolved `ownerType` +
 * `ownerId` and the STRUCTURED parent-context id fields the panel submits
 * (`revalidate_customer_id`, `revalidate_quote_id`, `revalidate_version_id`) — NEVER a
 * free-form path. Returns `null` when no legitimate route can be derived (an unknown owner
 * type, or a nested owner missing its parent ids) — the action then skips revalidation.
 *
 *   - customer                  → `/customers/{ownerId}`
 *   - calculation               → `/calculations/{ownerId}`
 *   - job                       → `/jobs/{ownerId}`
 *   - facility / contact        → the PARENT customer route (`revalidate_customer_id`)
 *   - quote_acceptance /
 *     quote_version             → the quote version subroute (`revalidate_quote_id` +
 *                                 `revalidate_version_id`)
 *
 * The owner ids are the SERVER-VALIDATED owner_type/owner_id; the parent ids are UUID-gated
 * inside {@link ownerRoute}. A crafted client value can only select a known template, not `/`.
 */
export function resolveRevalidateRoute(args: {
  readonly ownerType: string | null;
  readonly ownerId: string | null;
  readonly parentCustomerId: string | null;
  readonly parentQuoteId: string | null;
  readonly parentVersionId: string | null;
}): string | null {
  const { ownerType, ownerId, parentCustomerId, parentQuoteId, parentVersionId } = args;
  switch (ownerType) {
    case "customer":
      return ownerId ? ownerRoute({ kind: "customer", customerId: ownerId }) : null;
    case "calculation":
      return ownerId ? ownerRoute({ kind: "calculation", calculationId: ownerId }) : null;
    case "job":
      return ownerId ? ownerRoute({ kind: "job", jobId: ownerId }) : null;
    case "facility":
    case "contact":
      // Rendered inside the parent customer hub → revalidate the CUSTOMER route.
      return parentCustomerId
        ? ownerRoute({ kind: "customer", customerId: parentCustomerId })
        : null;
    case "quote_acceptance":
    case "quote_version":
      // Rendered inside the quote version subroute → revalidate that subroute.
      return parentQuoteId && parentVersionId
        ? ownerRoute({
            kind: "quote_version_subroute",
            quoteId: parentQuoteId,
            versionId: parentVersionId,
          })
        : null;
    default:
      return null;
  }
}
