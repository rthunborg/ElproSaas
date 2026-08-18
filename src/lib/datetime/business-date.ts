/**
 * Resolve an injected instant to the legal/business calendar day in Europe/Stockholm.
 * The formatter is explicit and assembled from parts so neither the host time zone nor a
 * locale-specific separator can change the canonical YYYY-MM-DD result.
 */
export function stockholmBusinessDate(instant: Date | string): string {
  const value = typeof instant === "string" ? new Date(instant) : instant;
  if (!Number.isFinite(value.getTime())) {
    throw new RangeError("Invalid instant for Stockholm business date");
  }
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new RangeError("Unable to resolve Stockholm business date");
  }
  return result;
}
