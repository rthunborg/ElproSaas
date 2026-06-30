"use client";

/**
 * Customer create/edit dialog (Story 3.2, Task 3) — accessible form wired to the 3.1
 * `createCustomer` / `updateCustomer` envelope commands via a server action.
 *
 * CREATE: `customer_type` (one of four) drives the identifier field (private ⇒
 * personnummer; non-private ⇒ org_nr). EDIT: NO type switch (the 3.1 update validator
 * edits within-type fields only) — the type is shown read-only and the identifier stays
 * consistent with it. A non-blocking duplicate-like warning surfaces when the typed name
 * matches an existing active customer (advisory only — never blocks submit).
 *
 * Validation feedback is programmatically associated (aria-invalid/aria-describedby +
 * an aria-live blocking summary), input is preserved on failure, and focus returns to
 * the invoking control on close (the shared `Dialog`).
 */
import { useActionState, useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import {
  FormErrorSummary,
  FormWarning,
  SelectField,
  TextField,
} from "./FormField";
import {
  CUSTOMER_TYPE_LABELS,
  findDuplicateLikeNames,
  type CustomerListItem,
} from "./customer-presentation";
import {
  createCustomerAction,
  updateCustomerAction,
} from "@/features/crm/actions";
import { CRM_ACTION_INITIAL } from "@/features/crm/action-state";
import type { CustomerType } from "@/server/commands/crm/validation";

/** The editable customer fields the edit dialog hydrates from (detail-fetched). */
export interface CustomerEditDefaults {
  readonly id: string;
  readonly customer_type: CustomerType;
  readonly display_name: string;
  readonly org_nr: string | null;
  readonly personnummer: string | null;
  readonly contact_name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address_line1: string | null;
  readonly address_line2: string | null;
  readonly postal_code: string | null;
  readonly city: string | null;
}

const TYPE_OPTIONS = (
  Object.entries(CUSTOMER_TYPE_LABELS) as [CustomerType, string][]
).map(([value, label]) => ({ value, label }));

export function CustomerDialog({
  open,
  onClose,
  mode,
  defaults,
  existingCustomers,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly mode: "create" | "edit";
  readonly defaults?: CustomerEditDefaults;
  /** Active customers in the tenant — used for the non-blocking duplicate-like check. */
  readonly existingCustomers: readonly CustomerListItem[];
}) {
  // The body holds the form state (selected type, watched name, action state). Keying it
  // by `open` + the edited id remounts a CLEAN body each time the dialog opens, so a
  // reopened create form is pristine and a reopened edit form re-hydrates from defaults —
  // WITHOUT a reset-on-open effect (no synchronous setState in an effect body).
  const bodyKey = `${open ? "open" : "closed"}:${defaults?.id ?? "new"}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Ny kund" : "Redigera kund"}
    >
      <CustomerDialogBody
        key={bodyKey}
        onClose={onClose}
        mode={mode}
        defaults={defaults}
        existingCustomers={existingCustomers}
      />
    </Dialog>
  );
}

function CustomerDialogBody({
  onClose,
  mode,
  defaults,
  existingCustomers,
}: {
  readonly onClose: () => void;
  readonly mode: "create" | "edit";
  readonly defaults?: CustomerEditDefaults;
  readonly existingCustomers: readonly CustomerListItem[];
}) {
  const action = mode === "create" ? createCustomerAction : updateCustomerAction;
  const [state, formAction, pending] = useActionState(action, CRM_ACTION_INITIAL);

  // The selected type drives which identifier field renders. On create it is a live
  // select; on edit it is fixed to the existing type (no type switch). Seeded once from
  // defaults at mount — the keyed remount handles re-open re-hydration.
  const [type, setType] = useState<CustomerType>(
    defaults?.customer_type ?? "private",
  );
  const [name, setName] = useState(defaults?.display_name ?? "");

  // Initial focus is owned by the shared `Dialog` (it focuses the first CONTENT field
  // on open — the body must NOT also focus, which would race the parent effect).

  // On a successful submit, close the dialog (the page revalidated server-side). Only
  // the parent callback runs here — no local setState in the effect body.
  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const dupNames =
    mode === "create" ? findDuplicateLikeNames(name, existingCustomers) : [];
  const duplicateWarning =
    dupNames.length > 0
      ? `En aktiv kund med namnet "${dupNames[0]}" finns redan. Du kan ändå spara om detta är en annan kund.`
      : null;

  // Echo-back values from a failed submit take precedence over the initial defaults.
  const v = (field: string, fallback: string | null | undefined): string =>
    state.values[field] ?? fallback ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormErrorSummary message={state.formError} />

      {mode === "edit" && defaults && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

        {mode === "create" ? (
          <SelectField
            name="customer_type"
            label="Kundtyp"
            required
            options={TYPE_OPTIONS}
            defaultValue={type}
            onChange={(val) => setType(val as CustomerType)}
            error={state.fieldErrors.customer_type}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-800">Kundtyp</span>
            <p className="text-sm text-zinc-700">
              {CUSTOMER_TYPE_LABELS[type]}
              <span className="ml-2 text-xs text-zinc-500">
                (kundtyp kan inte ändras)
              </span>
            </p>
          </div>
        )}

        <DisplayNameField
          defaultValue={v("display_name", defaults?.display_name)}
          error={state.fieldErrors.display_name}
          // Watch the value live (create only) so the duplicate-like advisory updates.
          onChange={mode === "create" ? setName : undefined}
        />

        {duplicateWarning && <FormWarning message={duplicateWarning} />}

        {type === "private" ? (
          <TextField
            name="personnummer"
            label="Personnummer"
            required={mode === "create"}
            defaultValue={v("personnummer", defaults?.personnummer)}
            error={state.fieldErrors.personnummer}
            autoComplete="off"
          />
        ) : (
          <TextField
            name="org_nr"
            label="Organisationsnummer"
            required={mode === "create"}
            defaultValue={v("org_nr", defaults?.org_nr)}
            error={state.fieldErrors.org_nr}
          />
        )}

        <TextField
          name="contact_name"
          label="Kontaktperson"
          defaultValue={v("contact_name", defaults?.contact_name)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            name="email"
            label="E-post"
            type="email"
            defaultValue={v("email", defaults?.email)}
            error={state.fieldErrors.email}
          />
          <TextField
            name="phone"
            label="Telefon"
            defaultValue={v("phone", defaults?.phone)}
            error={state.fieldErrors.phone}
          />
        </div>
        <TextField
          name="address_line1"
          label="Adress"
          defaultValue={v("address_line1", defaults?.address_line1)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            name="postal_code"
            label="Postnummer"
            defaultValue={v("postal_code", defaults?.postal_code)}
          />
          <TextField
            name="city"
            label="Ort"
            defaultValue={v("city", defaults?.city)}
          />
        </div>

        <DialogActions onClose={onClose} pending={pending} />
    </form>
  );
}

/**
 * The display-name field, with an optional live `onChange` so the parent can run the
 * duplicate-like advisory as the user types. It is `defaultValue`-seeded (uncontrolled
 * for form submission / input preservation), but emits its value on each input event.
 */
function DisplayNameField({
  defaultValue,
  error,
  onChange,
}: {
  readonly defaultValue: string;
  readonly error?: string | null;
  readonly onChange?: (value: string) => void;
}) {
  return (
    <div onInput={(e) => onChange?.((e.target as HTMLInputElement).value)}>
      <TextField
        name="display_name"
        label="Visningsnamn"
        required
        defaultValue={defaultValue}
        error={error}
      />
    </div>
  );
}

export function DialogActions({
  onClose,
  pending,
}: {
  readonly onClose: () => void;
  readonly pending: boolean;
}) {
  return (
    <div className="mt-2 flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        Avbryt
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
      >
        {pending ? "Sparar…" : "Spara"}
      </button>
    </div>
  );
}
