// SERVER-ONLY. This opt-in exists solely for the guarded local E2E retry scenario.
// It is intentionally not a NEXT_PUBLIC value and defaults to disabled.
export const RESOURCE_E2E_SAVE_FAILURE_ENV = "E2E_RESOURCE_SAVE_FAILURE_ENABLED";

export function isResourceE2eSaveFailureEnabled(
  runtimeFlag: string | undefined = process.env[RESOURCE_E2E_SAVE_FAILURE_ENV],
): boolean {
  return runtimeFlag === "true";
}

export function shouldInjectResourceE2eSaveFailure({
  runtimeFlag,
  requested,
  attempt,
}: {
  readonly runtimeFlag?: string;
  readonly requested: FormDataEntryValue | null;
  readonly attempt: FormDataEntryValue | null;
}): boolean {
  return isResourceE2eSaveFailureEnabled(runtimeFlag) && requested === "true" && attempt !== "retry";
}
