import { createHash } from "node:crypto";

const entry = { id: "standard-se", version: 1, locale: "sv-SE", timeZone: "Europe/Stockholm", currency: "SEK", displayDefaults: "conservative", termsPlaceholder: true } as const;

/**
 * The immutable provisioning catalogue hashes this compact, recursively
 * key-sorted JSON form. `public.provisioning_baseline_canonical_json` mirrors
 * it exactly; do not replace this with ordinary JSON.stringify().
 */
export function canonicalProvisioningBaselineContent(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalProvisioningBaselineContent).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalProvisioningBaselineContent(record[key])}`).join(",")}}`;
  }
  throw new TypeError("provisioning baseline content must be JSON");
}

export function provisioningBaselineContentHash(value: unknown): string {
  return createHash("sha256").update(canonicalProvisioningBaselineContent(value)).digest("hex");
}

export const TENANT_PROVISIONING_BASELINES = [{ ...entry, contentHash: provisioningBaselineContentHash(entry) }] as const;
export function findProvisioningBaseline(id: string, version: number) { return TENANT_PROVISIONING_BASELINES.find((baseline) => baseline.id === id && baseline.version === version); }
