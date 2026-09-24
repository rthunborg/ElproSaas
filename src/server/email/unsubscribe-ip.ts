import { isIP } from "node:net";

/** Vercel preserves this header across an upstream proxy; arbitrary forwarded headers are untrusted. */
export function trustedUnsubscribeIp(value: string | null): string {
  const candidate = value?.trim() ?? "";
  return candidate.length <= 64 && isIP(candidate) !== 0 ? candidate : "unknown";
}
