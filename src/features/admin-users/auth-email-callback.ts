/**
 * Select a same-origin destination after the browser has consumed an Auth email
 * callback. The callback route never forwards an arbitrary `next` URL.
 */
export function resolveAuthEmailCallbackDestination(input: {
  type: string | null;
  membershipId: string | null;
  attempt: string | null;
}): string {
  if (input.type === "recovery") return "/password/update";

  const target = new URL("/invite/accept", "http://elpro.local");
  if (input.membershipId) target.searchParams.set("membershipId", input.membershipId);
  if (input.attempt) target.searchParams.set("attempt", input.attempt);
  return `${target.pathname}${target.search}`;
}

/** A deployment-owned origin prevents a request Host header from receiving an email fragment. */
export function resolveTrustedAuthEmailCallbackOrigin(
  configuredAppUrl: string | undefined,
  requestOrigin: string,
  isProduction: boolean,
): string | null {
  if (configuredAppUrl) {
    try {
      const configured = new URL(configuredAppUrl);
      if (configured.protocol === "http:" || configured.protocol === "https:") return configured.origin;
    } catch {
      // Production must fail closed below; non-production retains the request
      // origin for the documented local callback runner.
    }
  }
  return isProduction ? null : requestOrigin;
}
