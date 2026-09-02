export interface ReviewedQuoteProof {
  readonly digest: string;
  readonly quoteCaptureDate: string;
}

/** Swedish civil date at the quote/version business boundary. */
export function stockholmBusinessDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isQuoteCaptureDateExpired(
  quoteCaptureDate: string,
  now: Date = new Date(),
): boolean {
  return quoteCaptureDate !== stockholmBusinessDate(now);
}

export function isReviewedQuoteProofStale(
  proof: ReviewedQuoteProof | null,
  currentDigest: string,
  currentQuoteCaptureDate: string,
): boolean {
  return (
    proof !== null &&
    (proof.digest !== currentDigest ||
      proof.quoteCaptureDate !== currentQuoteCaptureDate)
  );
}
