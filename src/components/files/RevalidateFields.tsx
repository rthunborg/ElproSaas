/**
 * Shared hidden STRUCTURED revalidation fields for the file upload/archive forms (epic-8
 * review finding: client-supplied `revalidate_path`).
 *
 * These emit ONLY typed parent-context ids (`revalidate_customer_id` / `revalidate_quote_id`
 * / `revalidate_version_id`) — NEVER a free-form path. The server action (`resolveRevalidateRoute`)
 * slots them into a CLOSED route-template allow-list after UUID-validating each, so a crafted
 * client can at most select a legitimate route template with a UUID id (never `/`, never an
 * arbitrary route). A customer/calculation/job panel needs none (its owner id IS the route id).
 */
export interface RevalidateFieldsProps {
  readonly parentCustomerId?: string;
  readonly parentQuoteId?: string;
  readonly parentVersionId?: string;
}

export function RevalidateFields({
  parentCustomerId,
  parentQuoteId,
  parentVersionId,
}: RevalidateFieldsProps) {
  return (
    <>
      {parentCustomerId ? (
        <input type="hidden" name="revalidate_customer_id" value={parentCustomerId} />
      ) : null}
      {parentQuoteId ? (
        <input type="hidden" name="revalidate_quote_id" value={parentQuoteId} />
      ) : null}
      {parentVersionId ? (
        <input type="hidden" name="revalidate_version_id" value={parentVersionId} />
      ) : null}
    </>
  );
}
