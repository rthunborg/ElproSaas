/**
 * `/customers/[customerId]` (Kund hub) — the customer detail (Story 3.2, Task 2).
 *
 * A SERVER component: it server-fetches the single customer (+ active facilities and
 * contacts) by id via the per-request RLS client (anon key — NEVER service-role). A
 * foreign/other-tenant id is invisible under RLS → zero rows → a GENERIC "not found / no
 * access" state that NEVER reveals whether the row exists in another tenant (no
 * cross-tenant leakage). A read error renders the generic failed state.
 *
 * `force-dynamic` because the route reads per-request auth/data; the `(app)` layout is
 * the auth boundary (this page adds no auth mechanism).
 */
import Link from "next/link";
import { CustomerDetail } from "@/components/crm/CustomerDetail";
import { EntityFilePanel } from "@/components/files/EntityFilePanel";
import { readCustomerDetail } from "@/features/crm/read";
import { readEntityFiles } from "@/features/files/read";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const { customer, facilities, contacts, error } =
    await readCustomerDetail(customerId);
  // Story 8.2 — the own-tenant linked files for the customer + each facility + each contact
  // (RLS-scoped; a cross-tenant id returns zero rows). Fetched in PARALLEL, only when we have
  // a customer to render the panels for.
  const [filesRead, facilityFiles, contactFiles] = customer
    ? await Promise.all([
        readEntityFiles({ ownerType: "customer", ownerId: customerId }),
        Promise.all(
          facilities.map(async (f) => ({
            id: f.id,
            name: f.name,
            read: await readEntityFiles({ ownerType: "facility", ownerId: f.id }),
          })),
        ),
        Promise.all(
          contacts.map(async (c) => ({
            id: c.id,
            name: c.name,
            read: await readEntityFiles({ ownerType: "contact", ownerId: c.id }),
          })),
        ),
      ])
    : [null, [], []];

  if (error) {
    return (
      <section className="mx-auto max-w-3xl">
        <div
          role="alert"
          data-testid="customer-detail-failed"
          className="rounded-lg border border-red-300 bg-red-50 p-6"
        >
          <p className="text-sm font-medium text-red-800">
            Kunden kunde inte läsas in.
          </p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <Link
            href="/customers"
            className="mt-4 inline-flex rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Tillbaka till kunder
          </Link>
        </div>
      </section>
    );
  }

  if (!customer) {
    // Invisible under RLS (or genuinely absent) → GENERIC not-found, no leakage.
    return (
      <section className="mx-auto max-w-3xl">
        <div
          data-testid="customer-not-found"
          className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center"
        >
          <p className="text-sm font-medium text-zinc-900">Kunden hittades inte</p>
          <p className="mt-1 text-sm text-zinc-600">
            Kunden finns inte eller så har du inte åtkomst till den.
          </p>
          <Link
            href="/customers"
            className="mt-4 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Tillbaka till kunder
          </Link>
        </div>
      </section>
    );
  }

  const customerRoute = `/customers/${customer.id}`;
  const facilityFilePanels: Record<string, React.ReactNode> = {};
  for (const f of facilityFiles) {
    facilityFilePanels[f.id] = (
      <EntityFilePanel
        ownerType="facility"
        ownerId={f.id}
        purpose="crm_document"
        ownerLabel={f.name}
        files={f.read.files}
        readError={f.read.error}
        revalidatePath={customerRoute}
        testIdSuffix={`facility-${f.id}`}
      />
    );
  }
  const contactFilePanels: Record<string, React.ReactNode> = {};
  for (const c of contactFiles) {
    contactFilePanels[c.id] = (
      <EntityFilePanel
        ownerType="contact"
        ownerId={c.id}
        purpose="crm_document"
        ownerLabel={c.name}
        files={c.read.files}
        readError={c.read.error}
        revalidatePath={customerRoute}
        testIdSuffix={`contact-${c.id}`}
      />
    );
  }

  return (
    <CustomerDetail
      customer={customer}
      facilities={facilities}
      contacts={contacts}
      filesPanel={
        <EntityFilePanel
          ownerType="customer"
          ownerId={customer.id}
          purpose="crm_document"
          ownerLabel={customer.display_name}
          files={filesRead?.files ?? []}
          readError={filesRead?.error ?? null}
        />
      }
      facilityFilePanels={facilityFilePanels}
      contactFilePanels={contactFilePanels}
    />
  );
}
