type QuoteSendTrackEnvironment = {
  readonly KOPPLAS_QUOTE_SEND_TRACK?: string;
  readonly ELPRO_QUOTE_SEND_TRACK?: string;
};

/**
 * Exact demo opt-in only. Legacy-only deployments remain supported until all consumers
 * migrate (ADR-B013); a conflict or any malformed setting retains the tax safety gate.
 */
export function quoteSendCustomerDataTrack(
  env: QuoteSendTrackEnvironment = {
    KOPPLAS_QUOTE_SEND_TRACK: process.env.KOPPLAS_QUOTE_SEND_TRACK,
    ELPRO_QUOTE_SEND_TRACK: process.env.ELPRO_QUOTE_SEND_TRACK,
  },
): "demo" | "real_customer" {
  const current = env.KOPPLAS_QUOTE_SEND_TRACK;
  const legacy = env.ELPRO_QUOTE_SEND_TRACK;
  if (current !== undefined && legacy !== undefined && current !== legacy) {
    return "real_customer";
  }
  const value = current ?? legacy;
  return value === "demo" ? "demo" : "real_customer";
}
