/** Maximum number of explicit, ordered PII-free allowance holders in one tax input. */
export const MAX_PERSON_ALLOWANCE_SLOTS = 50;

/**
 * Compatibility shape accepted by the editor. Historical rows may carry a non-canonical slot id;
 * the id is deliberately retained only as opaque source data and is never used as UI text, a DOM
 * name, or a React key. Saving the form canonicalizes the array order to PERSON_1..PERSON_50.
 */
export interface AllowanceEditorValues {
  readonly remainingAllowanceOre?: number;
  readonly remainingRotAllowanceOre?: number;
  readonly remainingCombinedRotRutAllowanceOre?: number;
  readonly remainingGreenAllowanceOre?: number;
}

export interface AllowanceEditorSource extends AllowanceEditorValues {
  readonly slot: string;
}

export interface AllowanceEditorSlot {
  /** Opaque UI identity, intentionally unrelated to the persisted legacy slot identifier. */
  readonly key: string;
  readonly source?: AllowanceEditorValues;
}

/** Initialize by persisted ARRAY ORDER and keep two editable rows available for a fresh form. */
export function initializeAllowanceEditorSlots(
  sources: readonly AllowanceEditorSource[],
): readonly AllowanceEditorSlot[] {
  const slots: AllowanceEditorSlot[] = sources
    .slice(0, MAX_PERSON_ALLOWANCE_SLOTS)
    .map((source, index) => ({
      key: `persisted-${index + 1}`,
      // Copy only monetary values. A legacy identifier may contain PII and must not survive into
      // editor state, React keys, labels, field names, or form submission.
      source: {
        ...(source.remainingAllowanceOre === undefined
          ? {}
          : { remainingAllowanceOre: source.remainingAllowanceOre }),
        ...(source.remainingRotAllowanceOre === undefined
          ? {}
          : { remainingRotAllowanceOre: source.remainingRotAllowanceOre }),
        ...(source.remainingCombinedRotRutAllowanceOre === undefined
          ? {}
          : { remainingCombinedRotRutAllowanceOre: source.remainingCombinedRotRutAllowanceOre }),
        ...(source.remainingGreenAllowanceOre === undefined
          ? {}
          : { remainingGreenAllowanceOre: source.remainingGreenAllowanceOre }),
      },
    }));
  while (slots.length < 2) {
    slots.push({ key: `empty-${slots.length + 1}` });
  }
  return slots;
}

/** Add one keyboard-authored person row, refusing duplicates and a fifty-first slot. */
export function addAllowanceEditorSlot(
  slots: readonly AllowanceEditorSlot[],
  key: string,
): readonly AllowanceEditorSlot[] {
  if (
    slots.length >= MAX_PERSON_ALLOWANCE_SLOTS ||
    key.length === 0 ||
    slots.some((slot) => slot.key === key)
  ) {
    return slots;
  }
  return [...slots, { key }];
}

/** Remove a row while retaining the editor's two-row minimum and every other row's identity. */
export function removeAllowanceEditorSlot(
  slots: readonly AllowanceEditorSlot[],
  key: string,
): readonly AllowanceEditorSlot[] {
  if (slots.length <= 2 || !slots.some((slot) => slot.key === key)) return slots;
  return slots.filter((slot) => slot.key !== key);
}
