/**
 * Stable public facade for local Supabase test factories.
 *
 * Domain modules remain below the test-file size ceiling while existing test
 * imports continue to use `tests/factories/tenants`.
 */
export * from "./tenants/core";
export * from "./tenants/crm";
export * from "./tenants/calculations";
export * from "./tenants/files";
export * from "./tenants/quotes";
export * from "./tenants/lifecycle";
export * from "./tenants/storage";