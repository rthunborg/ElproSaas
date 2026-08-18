import type { TaxDeductionChoice } from "@/lib/money";

export const REVERSE_CHARGE_DEDUCTION_CONFLICT_MESSAGE =
  "Omvänd betalningsskyldighet kan inte kombineras med ROT eller grön teknik. Välj standardmoms eller inget skatteavdrag.";

/** Cross-field posture guard shared by the interactive panel and form parsing. */
export function hasReverseChargeDeductionConflict(
  documentVatType: string,
  deductionChoice: TaxDeductionChoice | string,
): boolean {
  return (
    documentVatType === "REVERSE_CHARGE_CONSTRUCTION" &&
    deductionChoice !== "NONE"
  );
}
