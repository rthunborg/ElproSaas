"use client";

/**
 * Customer detail hub (Story 3.2, Task 2) — the `/customers/[customerId]` Kund hub.
 *
 * Renders the customer summary (identity/address/contact), the access-controlled
 * personnummer (MASKED, reveal-on-click) for a `private` customer ONLY, the Facilities
 * (Anläggningar) and Contacts (Kontakter) sub-sections with add/edit/archive wired to
 * the 3.1 commands via dialogs, and HONEST "not yet built" affordances for the Phase-A
 * areas whose owning story does not exist yet (calculations/quotes/jobs/files/events).
 *
 * NO deferred-module section, route, or placeholder appears anywhere (AC2/AC6). All
 * mutations go through the server actions → 3.1 envelope commands; this component is
 * presentation + interaction only, never the security boundary.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerDialog, type CustomerEditDefaults } from "./CustomerDialog";
import { CustomerTypeBadge } from "./CustomerTypeBadge";
import { FacilityDialog, type FacilityEditDefaults } from "./FacilityDialog";
import {
  ContactDialog,
  type ContactEditDefaults,
  type FacilityOption,
} from "./ContactDialog";
import { ArchiveButton } from "./ArchiveButton";
import { maskPersonnummer } from "./customer-presentation";
import type {
  ContactRow,
  CustomerDetailRow,
  FacilityRow,
} from "@/features/crm/read";

/** The Phase-A related areas whose owning story does not exist yet (honest empties). */
const NOT_YET_BUILT_AREAS: ReadonlyArray<{ label: string; note: string }> = [
  { label: "Kalkyler", note: "Byggs i Epic 5 (kalkyler)." },
  { label: "Offerter", note: "Byggs i Epic 6 (offerter)." },
  { label: "Jobb/Order", note: "Byggs i Epic 7 (jobb/order)." },
  { label: "Filer", note: "Byggs i Epic 8 (filer)." },
  { label: "Händelsehistorik", note: "Byggs i en senare story." },
];

export function CustomerDetail({
  customer,
  facilities,
  contacts,
}: {
  readonly customer: CustomerDetailRow;
  readonly facilities: readonly FacilityRow[];
  readonly contacts: readonly ContactRow[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [revealPnr, setRevealPnr] = useState(false);

  const isPrivate = customer.customer_type === "private";

  const editDefaults: CustomerEditDefaults = {
    id: customer.id,
    customer_type: (customer.customer_type as CustomerEditDefaults["customer_type"]) ?? "company",
    display_name: customer.display_name,
    org_nr: customer.org_nr,
    personnummer: customer.personnummer,
    contact_name: customer.contact_name,
    email: customer.email,
    phone: customer.phone,
    address_line1: customer.address_line1,
    address_line2: customer.address_line2,
    postal_code: customer.postal_code,
    city: customer.city,
  };

  const facilityOptions: FacilityOption[] = facilities.map((f) => ({
    id: f.id,
    name: f.name,
  }));

  return (
    <section className="mx-auto max-w-4xl">
      {/* Header: name + type badge + edit. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {customer.display_name}
          </h1>
          <CustomerTypeBadge type={customer.customer_type} />
          {customer.archived_at && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              Arkiverad
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            data-testid="edit-customer-button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Redigera
          </button>
          {!customer.archived_at && (
            <ArchiveButton
              kind="customer"
              id={customer.id}
              label="Arkivera kund"
              confirmMessage="Arkivera den här kunden? Den tas bort från den aktiva listan."
              onArchived={() => router.push("/customers")}
            />
          )}
        </div>
      </div>

      {/* Summary card. */}
      <dl className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 bg-white p-6 sm:grid-cols-2">
        {isPrivate ? (
          <Field label="Personnummer">
            <span className="flex items-center gap-2">
              <span data-testid="customer-personnummer">
                {revealPnr
                  ? customer.personnummer ?? "—"
                  : maskPersonnummer(customer.personnummer)}
              </span>
              {customer.personnummer && (
                <button
                  type="button"
                  onClick={() => setRevealPnr((r) => !r)}
                  className="text-xs font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {revealPnr ? "Dölj" : "Visa"}
                </button>
              )}
            </span>
          </Field>
        ) : (
          <Field label="Organisationsnummer">{customer.org_nr ?? "—"}</Field>
        )}
        <Field label="Kontaktperson">{customer.contact_name ?? "—"}</Field>
        <Field label="E-post">{customer.email ?? "—"}</Field>
        <Field label="Telefon">{customer.phone ?? "—"}</Field>
        <Field label="Adress">
          {[customer.address_line1, customer.address_line2]
            .filter(Boolean)
            .join(", ") || "—"}
        </Field>
        <Field label="Ort">
          {[customer.postal_code, customer.city].filter(Boolean).join(" ") || "—"}
        </Field>
      </dl>

      {/* Facilities (Anläggningar). */}
      <FacilitiesSection customerId={customer.id} facilities={facilities} />

      {/* Contacts (Kontakter). */}
      <ContactsSection
        customerId={customer.id}
        contacts={contacts}
        facilities={facilities}
        facilityOptions={facilityOptions}
      />

      {/* Honest "not yet built" related areas — never a deferred module. */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Relaterat</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NOT_YET_BUILT_AREAS.map((area) => (
            <div
              key={area.label}
              data-testid="not-built-area"
              className="rounded-lg border border-dashed border-zinc-300 bg-white p-4"
            >
              <p className="text-sm font-medium text-zinc-700">{area.label}</p>
              <p className="mt-1 text-xs text-zinc-500">{area.note}</p>
            </div>
          ))}
        </div>
      </section>

      <CustomerDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        defaults={editDefaults}
        existingCustomers={[]}
      />
    </section>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{children}</dd>
    </div>
  );
}

function FacilitiesSection({
  customerId,
  facilities,
}: {
  readonly customerId: string;
  readonly facilities: readonly FacilityRow[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<FacilityEditDefaults | null>(null);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Anläggningar</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          data-testid="new-facility-button"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Ny anläggning
        </button>
      </div>

      {facilities.length === 0 ? (
        <p
          data-testid="facilities-empty"
          className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600"
        >
          Inga anläggningar ännu. En kund kan ha noll eller flera anläggningar.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {facilities.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{f.name}</p>
                <p className="text-xs text-zinc-500">
                  {[f.address_line1, f.postal_code, f.city].filter(Boolean).join(" ") ||
                    "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: f.id,
                      name: f.name,
                      address_line1: f.address_line1,
                      address_line2: f.address_line2,
                      postal_code: f.postal_code,
                      city: f.city,
                    })
                  }
                  className="text-sm font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Redigera
                </button>
                <ArchiveButton
                  kind="facility"
                  id={f.id}
                  customerId={customerId}
                  label={`Arkivera anläggning ${f.name}`}
                  confirmMessage="Arkivera den här anläggningen?"
                  onArchived={() => router.refresh()}
                  compact
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <FacilityDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        customerId={customerId}
      />
      <FacilityDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        mode="edit"
        customerId={customerId}
        defaults={editing ?? undefined}
      />
    </section>
  );
}

function ContactsSection({
  customerId,
  contacts,
  facilities,
  facilityOptions,
}: {
  readonly customerId: string;
  readonly contacts: readonly ContactRow[];
  readonly facilities: readonly FacilityRow[];
  readonly facilityOptions: readonly FacilityOption[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ContactEditDefaults | null>(null);

  const facilityName = (id: string | null): string | null => {
    if (!id) return null;
    return facilities.find((f) => f.id === id)?.name ?? null;
  };

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">Kontakter</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          data-testid="new-contact-button"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Ny kontakt
        </button>
      </div>

      {contacts.length === 0 ? (
        <p
          data-testid="contacts-empty"
          className="mt-3 rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-600"
        >
          Inga kontakter ännu.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                  {c.name}
                  {c.is_primary && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-200">
                      Primär
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {[c.role_label, c.email, c.phone, facilityName(c.facility_id)]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: c.id,
                      name: c.name,
                      facility_id: c.facility_id,
                      email: c.email,
                      phone: c.phone,
                      role_label: c.role_label,
                      is_primary: c.is_primary,
                    })
                  }
                  className="text-sm font-medium text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Redigera
                </button>
                <ArchiveButton
                  kind="contact"
                  id={c.id}
                  customerId={customerId}
                  label={`Arkivera kontakt ${c.name}`}
                  confirmMessage="Arkivera den här kontakten?"
                  onArchived={() => router.refresh()}
                  compact
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ContactDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        customerId={customerId}
        facilities={facilityOptions}
      />
      <ContactDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        mode="edit"
        customerId={customerId}
        facilities={facilityOptions}
        defaults={editing ?? undefined}
      />
    </section>
  );
}
