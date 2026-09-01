const LOCAL_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export type TimezoneOffsetProvider = (instantMs: number) => number;

const systemTimezoneOffset: TimezoneOffsetProvider = (instantMs) =>
  new Date(instantMs).getTimezoneOffset();

/**
 * Enumerate the UTC instants represented by a browser `datetime-local` value in
 * the user's timezone. Calendar overflow and DST gaps return none; a fall-back
 * overlap returns both occurrences so the UI can require an explicit choice.
 */
export function localAcceptanceTimeCandidates(
  value: string,
  timezoneOffset: TimezoneOffsetProvider = systemTimezoneOffset,
): readonly string[] {
  const match = LOCAL_DATE_TIME.exec(value);
  if (match === null) return [];

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");
  const localWallTime = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  const normalized = new Date(localWallTime);

  if (
    !Number.isFinite(localWallTime) ||
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day ||
    normalized.getUTCHours() !== hour ||
    normalized.getUTCMinutes() !== minute ||
    normalized.getUTCSeconds() !== second
  ) {
    return [];
  }

  // Sample both sides of the wall time so a transition exposes every offset that could map to it.
  // Candidate validation below rejects offsets that are not active at the resulting instant.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 1) {
    const offset = timezoneOffset(localWallTime + hours * 60 * 60 * 1000);
    if (Number.isFinite(offset)) offsets.add(offset);
  }

  const candidates = [...offsets]
    .map((offset) => localWallTime + offset * 60 * 1000)
    .filter((instantMs) => {
      const activeOffset = timezoneOffset(instantMs);
      return instantMs - activeOffset * 60 * 1000 === localWallTime;
    })
    .sort((left, right) => left - right)
    .map((instantMs) => new Date(instantMs).toISOString());

  return [...new Set(candidates)];
}

/** A local wall time is submit-ready only when it maps to exactly one instant. */
export function localAcceptanceTimeToIso(
  value: string,
  timezoneOffset: TimezoneOffsetProvider = systemTimezoneOffset,
): string | null {
  const candidates = localAcceptanceTimeCandidates(value, timezoneOffset);
  return candidates.length === 1 ? candidates[0]! : null;
}
