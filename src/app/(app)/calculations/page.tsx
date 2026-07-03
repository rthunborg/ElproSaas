/**
 * `/calculations` (Kalkyler) — the calculation list (Story 5.2, Task 1.3; architecture §4).
 *
 * A SERVER component over the RLS-scoped list read: it reads the tenant's ACTIVE
 * calculations on the per-request cookie-bound RLS client (anon key — NEVER service-role)
 * and hands the rows to the client `CalculationList` island (which owns the `Ny kalkyl`
 * create affordance). Each row links to `/calculations/[calculationId]` — the editor is the
 * heart of this story; this list is a thin index.
 *
 * `force-dynamic` because this route reads per-request auth/data (the `(app)` layout is the
 * auth boundary; only the `build` gate catches a missing one). This page adds NO auth
 * mechanism and NO new nav item — Kalkyler already exists in the seven-item shell nav.
 */
import { CalculationList } from "@/components/calculations/CalculationList";
import { readCalculationList } from "@/features/calculations/read";
import { readCustomerList } from "@/features/crm/read";

export const dynamic = "force-dynamic";

export default async function CalculationsPage() {
  // The list + the active-customer options for the `Ny kalkyl` create affordance (a calc
  // always needs a customer). Both reads run on the per-request RLS client.
  const [{ rows, error }, { rows: customers }] = await Promise.all([
    readCalculationList(),
    readCustomerList(),
  ]);
  const customerOptions = customers.map((c) => ({
    id: c.id,
    label: c.display_name,
  }));
  return (
    <CalculationList
      rows={rows}
      loadError={error}
      customerOptions={customerOptions}
    />
  );
}
