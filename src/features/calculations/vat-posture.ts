/**
 * PURE VAT-display posture resolution (Story 5.4, Task 2.1) — the inherited 5.2 [Med]
 * deferral OWNED by this story, extracted to a pure `.ts` module so the `node --test`
 * fast gate protects it (the same coverage-shape lesson as `totals.ts`/`source-options.ts`;
 * NEVER inline in a `"use client"` component).
 *
 * WHAT THIS FIXES: the 5.2 editor hard-coded `posture = customer_type === "private" ?
 * "private" : "company_togglable"` for EVERY non-private customer — it IGNORED the tenant's
 * configured `default_vat_display` (`company_togglable | company_excl`) and folded `brf` /
 * `public` into togglable with no basis. The displayed öre were always correct (the engine
 * re-derives from the same source öre); only the default VIEW label could contradict a
 * `company_excl` tenant.
 *
 * THE RESOLUTION (owner decision 2026-06-18, VAT-display defaults):
 *   - a `private` customer → the `"private"` INVARIANT (always incl-VAT / gross), regardless
 *     of the tenant setting (the Epic-4 presentation invariant `selectVatDisplay` honours);
 *   - a NON-private customer (`company` / `brf` / `public`) → the tenant's `default_vat_display`
 *     value (`company_togglable` OR `company_excl`) AS-IS — the engine consumes the posture
 *     verbatim, this helper does NOT re-decide the company-togglable default primary
 *     (Sign-Off Q2 owner-pending; the conservative build stands).
 *
 * PURE / I/O-free: it maps a customer-type string + a tenant-default enum to a
 * `VatDisplayPosture`. It reads NO DB, NO clock, NO PII — it takes a customer TYPE, never a
 * personnummer (R-516). An unknown customer type is treated as NON-private (the conservative
 * company path) rather than silently forcing `private` (which would wrongly hide the toggle).
 *
 * [Source: deferred-work.md#5-2 code review (Med — tenant default_vat_display ignored;
 *  brf/public folded in; OWNED by Story 5.4); src/lib/money#VatDisplayPosture/selectVatDisplay;
 *  src/features/settings/read.ts (readCompanySettings → default_vat_display); owner-decisions-
 *  applied-2026-06-18.md#Story 3.3 VAT display defaults (private always incl; company togglable)]
 */
import type { VatDisplayMode, VatDisplayPosture } from "@/lib/money";

/**
 * The tenant `default_vat_display` value a fresh (no settings row) tenant falls back to. A
 * settings-read fault or an absent row degrades to this conservative togglable default (a
 * "VAT posture unresolved" readiness WARNING is surfaced separately) — never a hard editor
 * failure (mirrors the 5.3 graceful-degradation posture for a pricing-read fault).
 */
export const DEFAULT_TENANT_VAT_DISPLAY: VatDisplayMode = "company_togglable";

/**
 * Resolve the presentation `VatDisplayPosture` from the customer type + the tenant's configured
 * `default_vat_display`.
 *
 *   - `private` customer → `"private"` INVARIANT (always incl-VAT), regardless of the tenant
 *     setting;
 *   - any NON-private customer (`company` / `brf` / `public`, or an unknown/absent type treated
 *     conservatively as non-private) → the tenant's `default_vat_display` AS-IS.
 *
 * The tenant default is consumed verbatim — a `company_excl` tenant resolves to `company_excl`
 * (primary = net) and a `company_togglable` tenant resolves to `company_togglable` (primary =
 * gross, togglable). This is the ONLY posture-resolution authority; the editor / totals-display /
 * readiness all read this single helper (no fork).
 */
export function resolveVatDisplayPosture(
  customerType: string | null | undefined,
  tenantDefaultVatDisplay: VatDisplayMode | null | undefined,
): VatDisplayPosture {
  if (customerType === "private") {
    return "private";
  }
  // A non-private (or unknown/absent) customer takes the tenant's configured default AS-IS.
  // An absent/invalid tenant default degrades to the conservative togglable default.
  return tenantDefaultVatDisplay ?? DEFAULT_TENANT_VAT_DISPLAY;
}
