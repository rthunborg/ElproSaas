export interface PersistedRowOptionState {
  readonly isOptional: boolean;
  readonly isSelected: boolean | null;
  readonly includedInInvoiceTotal: boolean;
}

export interface RowOptionUpdate {
  readonly isOptional?: boolean;
  readonly isSelected?: boolean;
  readonly includedInInvoiceTotal?: boolean;
}

/**
 * Preserve selection/inclusion as independent facts except for the settled option affordance: an
 * actual selection transition on an effective optional row carries the same intent to inclusion.
 * Unrelated saves, inclusion-only edits, and unchanged hidden-companion values return undefined.
 */
export function invoiceInclusionForOptionSelectionTransition(
  update: RowOptionUpdate,
  persisted: PersistedRowOptionState,
): boolean | undefined {
  const effectiveOptional = update.isOptional ?? persisted.isOptional;
  if (
    !effectiveOptional ||
    update.isSelected === undefined ||
    update.isSelected === persisted.isSelected
  ) {
    return undefined;
  }
  return update.isSelected;
}
