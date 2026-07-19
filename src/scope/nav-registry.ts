/**
 * The nav registry (Story 10.1, architecture §15.1) — derivation 2 of the four §5.3 guardrail
 * derivations. `EXPECTED_NAV_ROUTES` is the set of nav routes derived from the manifest's `active`
 * modules' nav items — the guardrail-expected nav route set that the shell renders.
 *
 * SCOPE (10.1): §15.1's full derivation is `manifest (active navItems) × permission matrix
 * (requiredCapability) → the grouped sidebar model`. The `× permission matrix` half lands at Story
 * 11.1 (RBAC); at 10.1 we derive from the MANIFEST ALONE (routes only) — Phase A is admin-only so
 * there is no matrix to intersect yet. Icons/labels stay AUTHORED in
 * `src/components/app-shell/nav-items.ts` (the rendered source of truth); this registry derives only
 * the ROUTE expectation, proven byte-equal to the authored hrefs (non-circular grounding, Task 5.2).
 *
 * [Source: architecture-phase-b.md §15.1 (nav registry), §5.3 (derivation 2); story 10.1 AC3, Task
 *  5; Dev Notes (circular-derivation trap — derive routes, ground against the authored hrefs).]
 */
import { SCOPE_MANIFEST } from "./manifest";
import { navRoutesFromManifest } from "./manifest-schema";

/**
 * The manifest-derived expected nav route set (the `active` modules' nav routes). Grounded
 * non-circularly against the still-authored `nav-items.ts` hrefs and a pinned literal of the seven
 * Phase-A routes (`/dashboard`, `/customers`, `/calculations`, `/quotes`, `/jobs`, `/files`,
 * `/settings`) in `tests/unit/scope/manifest-derivations.test.ts`.
 */
export const EXPECTED_NAV_ROUTES: readonly string[] =
  navRoutesFromManifest(SCOPE_MANIFEST);
