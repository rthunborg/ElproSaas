import { createHash } from "node:crypto";

const entry = { id: "standard-se", version: 1, locale: "sv-SE", timeZone: "Europe/Stockholm", currency: "SEK", displayDefaults: "conservative", termsPlaceholder: true } as const;
export const TENANT_PROVISIONING_BASELINES = [{ ...entry, contentHash: createHash("sha256").update(JSON.stringify(entry)).digest("hex") }] as const;
export function findProvisioningBaseline(id: string, version: number) { return TENANT_PROVISIONING_BASELINES.find((baseline) => baseline.id === id && baseline.version === version); }
