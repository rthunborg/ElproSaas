"use client";

/**
 * Contact create/edit dialog (Story 3.2, Task 2.4 / 3) — wired to the 3.1
 * `createContact` / `updateContact` envelope commands via a server action.
 *
 * Requires `customer_id` + `name`; `facility_id` (optional — bind to a facility),
 * `email`/`phone`/`role_label` (optional), and `is_primary` (optional convenience flag,
 * NOT an enforced "exactly one primary" — owner 2026-06-18). Same accessible-dialog
 * shape: programmatic error association, input preserved on failure, focus returned to
 * the invoking control on close.
 */
import { useActionState, useEffect } from "react";
import { Dialog } from "./Dialog";
import { DialogActions } from "./CustomerDialog";
import {
  CheckboxField,
  FormErrorSummary,
  SelectField,
  TextField,
} from "./FormField";
import {
  createContactAction,
  updateContactAction,
} from "@/features/crm/actions";
import { CRM_ACTION_INITIAL } from "@/features/crm/action-state";

export interface ContactEditDefaults {
  readonly id: string;
  readonly name: string;
  readonly facility_id: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly role_label: string | null;
  readonly is_primary: boolean;
}

/** A facility option the contact may bind (id + display name). */
export interface FacilityOption {
  readonly id: string;
  readonly name: string;
}

export function ContactDialog({
  open,
  onClose,
  mode,
  customerId,
  facilities,
  defaults,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly mode: "create" | "edit";
  readonly customerId: string;
  readonly facilities: readonly FacilityOption[];
  readonly defaults?: ContactEditDefaults;
}) {
  const bodyKey = `${open ? "open" : "closed"}:${defaults?.id ?? "new"}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Ny kontakt" : "Redigera kontakt"}
    >
      <ContactDialogBody
        key={bodyKey}
        onClose={onClose}
        mode={mode}
        customerId={customerId}
        facilities={facilities}
        defaults={defaults}
      />
    </Dialog>
  );
}

function ContactDialogBody({
  onClose,
  mode,
  customerId,
  facilities,
  defaults,
}: {
  readonly onClose: () => void;
  readonly mode: "create" | "edit";
  readonly customerId: string;
  readonly facilities: readonly FacilityOption[];
  readonly defaults?: ContactEditDefaults;
}) {
  const action = mode === "create" ? createContactAction : updateContactAction;
  const [state, formAction, pending] = useActionState(action, CRM_ACTION_INITIAL);

  // Initial focus is owned by the shared `Dialog` (it focuses the first CONTENT field
  // on open); the body must NOT also focus, which would race the parent effect.
  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  const v = (field: string, fallback: string | null | undefined): string =>
    state.values[field] ?? fallback ?? "";

  const facilityOptions = [
    { value: "", label: "Ingen anläggning" },
    ...facilities.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormErrorSummary message={state.formError} />
      <input type="hidden" name="customer_id" value={customerId} />
      {mode === "edit" && defaults && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

      <TextField
        name="name"
        label="Namn"
        required
        defaultValue={v("name", defaults?.name)}
        error={state.fieldErrors.name}
      />
      {facilities.length > 0 && (
        <SelectField
          name="facility_id"
          label="Anläggning (valfritt)"
          options={facilityOptions}
          defaultValue={v("facility_id", defaults?.facility_id)}
        />
      )}
      <TextField
        name="role_label"
        label="Roll (valfritt)"
        defaultValue={v("role_label", defaults?.role_label)}
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
      <CheckboxField
        name="is_primary"
        label="Primär kontakt"
        defaultChecked={defaults?.is_primary ?? false}
      />

      <DialogActions onClose={onClose} pending={pending} />
    </form>
  );
}
