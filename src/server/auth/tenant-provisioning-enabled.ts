/** Server-only runtime gate. Never export through Next config or a client module. */
export function isTenantProvisioningEnabled(): boolean {
  const configured = process.env.TENANT_PROVISIONING_ENABLED;
  // Preserve the local/unit default, but any explicit value must be exactly true.
  // A production build (including preview) always fails closed when unset.
  return configured === "true" || (configured === undefined && process.env.NODE_ENV !== "production");
}
