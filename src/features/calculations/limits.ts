/** Shared application mirror of the quote persistence contract. */
export const MAX_CALCULATION_ROWS = 500;

export function canAddCalculationRow(activeRowCount: number): boolean {
  return (
    Number.isInteger(activeRowCount) &&
    activeRowCount >= 0 &&
    activeRowCount < MAX_CALCULATION_ROWS
  );
}

export function exceedsCalculationRowLimit(activeRowCount: number): boolean {
  return (
    Number.isInteger(activeRowCount) &&
    activeRowCount > MAX_CALCULATION_ROWS
  );
}
