export function BuyerVatNumberFact({
  value,
  testId,
  className = "text-xs text-zinc-700",
}: {
  readonly value: string | null;
  readonly testId: string;
  readonly className?: string;
}) {
  if (value === null) return null;

  return (
    <p data-testid={testId} className={className}>
      Köparens momsregistreringsnummer: <span className="font-medium">{value}</span>
    </p>
  );
}
