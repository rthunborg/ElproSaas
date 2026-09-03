/**
 * The loss action completes a carried follow-up before its terminal transition.
 * A failed terminal transition must retry without resubmitting that completed row.
 */
export function followUpIdForLossAttempt(
  value: FormDataEntryValue | null,
  followUpAlreadyCompleted: boolean,
): string | null {
  if (followUpAlreadyCompleted || typeof value !== "string" || value.length === 0) return null;
  return value;
}

/** Whether the Mark Lost form should carry its optional follow-up input this attempt. */
export function shouldCarryFollowUpId(
  followUpId: string | undefined,
  followUpAlreadyCompleted: boolean,
): boolean {
  return typeof followUpId === "string" && followUpId.length > 0 && !followUpAlreadyCompleted;
}
