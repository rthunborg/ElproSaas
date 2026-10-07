export function BookingConflictChip({ count }: { readonly count: number }) {
  return <span data-testid="booking-open-conflict-count" aria-label={`${count} öppna konflikter`} className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900">Konflikter ({count})</span>;
}
