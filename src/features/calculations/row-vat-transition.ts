import {
  TAX_POLICY_2026,
  isCoherentVatTypeRate,
  isVatRateBp,
  isVatType,
  type VatType,
} from "@/lib/money";

export interface PersistedRowVatState {
  readonly vatType: VatType | null;
  readonly vatRateBp: number | null;
}

export interface RowVatUpdate {
  readonly vatType?: VatType;
  readonly vatRateBp?: number;
}

/** Validate a partial write as the effective persisted `(VatType, rateBp)` pair. */
export function isEffectiveRowVatPairCoherent(
  update: RowVatUpdate,
  persisted: PersistedRowVatState,
): boolean {
  const vatType = update.vatType ?? persisted.vatType;
  const vatRateBp = update.vatRateBp ?? persisted.vatRateBp;
  return (
    isVatType(vatType) &&
    isVatRateBp(vatRateBp) &&
    isCoherentVatTypeRate(
      vatType,
      vatRateBp,
      TAX_POLICY_2026.vat.standardRateBp,
    )
  );
}
