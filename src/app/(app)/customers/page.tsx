/**
 * `/customers` (Kunder) — the CRM customer list (Story 3.2, Task 1).
 *
 * A SERVER component over the RLS-scoped list projection: it reads the active customer
 * list on the per-request cookie-bound RLS client (anon key — NEVER service-role), and
 * hands the rows to the client `CustomerList` island for search/filter + the lifecycle
 * states. The projection OMITS personnummer entirely (private-data posture).
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is
 * the auth boundary; only the `build` gate catches a missing one). The auth/authorization
 * decision is made server-side in the `(app)` layout — this page adds no auth mechanism.
 */
import { CustomerList } from "@/components/crm/CustomerList";
import { readCustomerList } from "@/features/crm/read";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { rows, error } = await readCustomerList();
  return <CustomerList rows={rows} loadError={error} />;
}
