const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Interpret a browser `datetime-local` value in the user's local timezone and
 * return the explicit UTC instant required by the acceptance command. The
 * component round-trip rejects calendar overflow and DST-gap normalization.
 */
export function localAcceptanceTimeToIso(value: string): string | null {
  const match = LOCAL_DATE_TIME.exec(value);
  if (match === null) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");
  const instant = new Date(year, month - 1, day, hour, minute, second, 0);

  if (
    !Number.isFinite(instant.getTime()) ||
    instant.getFullYear() !== year ||
    instant.getMonth() !== month - 1 ||
    instant.getDate() !== day ||
    instant.getHours() !== hour ||
    instant.getMinutes() !== minute ||
    instant.getSeconds() !== second
  ) {
    return null;
  }

  return instant.toISOString();
}
