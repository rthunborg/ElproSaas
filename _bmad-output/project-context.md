---
title: ElPro BMAD Project Context
status: active
baseline_plan: docs/planning/saas-rebuild-phased-plan-2026-06-07.md
phase: A - Internal Pilot MVP
project_name: ElproSaas
user_name: Rasmus
last_updated: 2026-06-29
sections_completed:
  ['product_boundary', 'architecture_rules', 'money_tax_rules', 'lovable_oracle', 'technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'security_harness_rules', 'quality_rules', 'workflow_rules', 'anti_patterns', 'bmad_output_discipline']
optimized_for_llm: true
---

# Project Context For BMAD Agents

_Critical rules and patterns AI agents must follow when planning, implementing, or reviewing code in this project. Focuses on unobvious details agents might otherwise miss. Read this before writing any code; when in doubt prefer the more restrictive option._

The durable governance rules (Product Boundary, Architecture, Money/Tax/Quote, Lovable Oracle) are evergreen and phase-scoped. The implementation sections (Technology Stack onward) reflect the conventions established through **Epic 2 close** — the multi-tenant foundation now exists in code: tenant-admin login + server-side tenant-context resolution, the `tenants`/`tenant_memberships` schema with RLS helpers and two-tenant fixtures, the reusable server command envelope + append-only `audit_events`, and the security regression harness (cross-tenant RLS negatives, the H4 table-inventory gate, and source + built-bundle service-role containment checks).

## Product Boundary

BMAD agents must plan and review only the Phase A Internal Pilot MVP unless the user explicitly approves a later-phase epic. Phase A is a small internal rebuild for the current company, not the full commercial SaaS.

In Phase A:

- Implement admin-only `tenant_admin` access.
- Preserve pooled multi-tenant architecture from day one.
- Build only the workflow CRM/settings/pricing -> calculations -> quote versions/PDF/acceptance -> basic job/order creation -> required files.
- Include migration/coexistence planning and golden-master comparisons against the current Lovable app.

Do not plan implementation for Fortnox, field-worker UX, supplier APIs, AI jobs, HR, rentals, assets, DoU automation, tender/FKU RAG, or full RBAC unless the user explicitly promotes that scope.

## Architecture Rules

- Default tenant model is pooled multi-tenant, not one Supabase project per customer.
- Use dev, staging, and prod Supabase projects. Production contains many tenant companies.
- **Every tenant-owned business table must carry tenant scoping and be protected by RLS — RLS-by-default, no exceptions.** Phase A convention is a direct `tenant_id` column (the `tenants` root is the exception: its own `id` IS the tenant id). Enable AND `force` RLS on the table.
- **RLS narrows; GRANTs expose.** This stack does NOT auto-expose new `public` tables to Data API roles, and RLS only narrows an already-granted role. Every new tenant-owned table needs explicit GRANTs ALONGSIDE its policies: `authenticated -> SELECT` (+ whatever the app path needs), `service_role -> DML` (for tests/admin paths), `anon -> none`. Treat a per-table GRANT+RLS pair as a single checklist item — a missing GRANT surfaces as a `42501 permission denied` app-path failure (a stronger denial than RLS zero-rows), and a missing RLS policy is a tenant-isolation leak.
- **Authorization is computed via SECURITY DEFINER RLS-helper predicates** (`public.is_active_tenant_member(tenant_id)`, `public.is_tenant_admin(tenant_id)`). They are DEFINER on purpose (an INVOKER helper reading the RLS-protected membership table inside that table's own policy infinite-recurses, Postgres `42P17`). Every DEFINER function MUST pin `set search_path = ''` (empty) and schema-qualify EVERY reference (`public.x`, `auth.uid()`), be marked `STABLE`, and be revoked from `PUBLIC` — an unpinned search_path is a function-hijack / privilege-bypass vector. This is proven by a standing negative test; reuse this exact shape for any future DEFINER function.
- Phase A schema should contain only the v0 tables required by the baseline plan. Current tenant-owned set is EXACTLY `{tenants, tenant_memberships, audit_events}` (architecture §7).
- Do not create placeholder production tables for deferred modules.
- No service-role key may be reachable from browser/client paths. No unauthenticated privileged functions are allowed.
- **Prefer the server command envelope for sensitive mutations.** The reusable envelope (`src/server/commands/envelope.ts`, `defineCommand`/`runCommand`) is the authority surface every later sensitive mutation plugs into: it runs the architecture-§5 gates (resolve user from cookies -> resolve active membership -> validate typed input -> verify tenant ownership of targets -> execute -> append-only audit) and returns a stable typed `Result`. No raw throw, stack, SQL, or tenant/user-existence signal may cross the boundary. New commands REUSE this — they do not invent a new auth/error/audit mechanism.
- **Critical commands must be auditable, tenant-scoped, validated, and tested.** Audit rows are written via the append-only `writeAuditEvent` DEFINER-RPC path (`record_audit_event`) into `audit_events`; metadata is allow-listed and run through the sanitizer (`sanitizeAuditMetadata`) — never persist raw caller input or secrets. The `audit_events` table is append-only (a trigger blocks UPDATE/DELETE) and own-tenant-SELECT only.

## Money, Tax, And Quote Rules

- Represent SEK money as integer öre. (No money code lands until ~Epic 4; this discipline is mandatory when it does.)
- Snapshot VAT rate, VAT amount, tax assumptions, work-role prices, article prices, and customer-visible quote content.
- A sent quote version is immutable.
- An accepted quote version and acceptance evidence are immutable except for explicit admin correction workflows.
- Changes to customer-visible price, terms, tax, attachments, or content after send require a new quote version.
- ROT and grön teknik assumptions require owner/accounting sign-off before production use.

## Lovable Oracle Policy

The existing Lovable app is a reference implementation and behavioral oracle only.

Allowed:

- Inspect screens, schema, and existing behavior.
- Extract anonymized fixtures.
- Compare calculations, quote outputs, PDFs, and accepted-job transitions.
- Cite exact source files/functions as candidates for tested reuse.

Not allowed by default:

- Copy coupled React/Supabase code into the new repo.
- Import generated architecture.
- Reuse weakly typed functions without tests and review.
- Port Edge Function service-role/auth patterns.

## Technology Stack & Versions

Versions are pinned exactly (no caret ranges) — match them; do not silently bump. Adding or upgrading any dependency is a gated action requiring explicit approval (see Workflow Rules).

- **Package manager:** pnpm `10.24.0`, pinned via `package.json` `packageManager` and provisioned through Corepack. pnpm is the ONLY package manager — never use or reference `npm`, `yarn`, or `bun` in code, docs, scripts, or CI. A `verify:lockfiles` guard enforces a single lockfile.
- **Runtime:** Node `>=20.9.0`, version pinned in `.nvmrc` (CI reads it via `node-version-file`).
- **Framework:** Next.js `16.2.9` (App Router, `src/app/`), React `19.2.4`, React DOM `19.2.4`.
- **Language:** TypeScript `5.9.3`, `strict: true`, `moduleResolution: bundler`, path alias `@/* -> ./src/*`.
- **Styling:** Tailwind CSS v4 (`tailwindcss` + `@tailwindcss/postcss` `4.3.1`), configured via `@theme` in `src/app/globals.css` + `postcss.config.mjs`. No `tailwind.config.js`. Fonts via `next/font/google` (Geist), mapped to `--font-sans` and applied with the `font-sans` utility on `<body>`.
- **Lint:** ESLint `9.39.4` flat config (`eslint.config.mjs`) with `eslint-config-next`. Run as bare `eslint`.
- **Backend / data:** Supabase via `@supabase/ssr` `0.12.0` + `@supabase/supabase-js` `2.108.2`. Server-side access uses a per-request cookie-bound `@supabase/ssr` client (`src/server/db/supabase-server-client.ts`); the browser client (`supabase-browser-client.ts`) is anon-key only. Local dev/test runs the Supabase CLI stack (`supabase start` + `supabase db reset`); migrations live in `supabase/migrations/**`.
- **Test stack:** Vitest `4.1.9` (+ Vite `8.1.0`) for the DB-backed integration/RLS suites; the bespoke `pg` `8.22.0` superuser pool (+ `@types/pg` `8.20.0`) drives loopback-gated test admin SQL. Pure-logic units run on the dependency-free `node --test` runner. (Versions pinned in `devDependencies`.)

> These forward-dated version pins (Next 16, React 19, TS 5.9, Tailwind 4) are REAL and intentional. Do not "correct" them down based on stale training knowledge — a past adversarial review wrongly flagged them as non-existent.

## Critical Implementation Rules

### Language-Specific Rules

- TypeScript `strict` is on. No implicit `any`; type everything. Prefer `readonly` and `as const` for fixed data (see `nav-items.ts`).
- Use the `@/*` alias for intra-`src` imports; avoid deep relative `../../..` chains.
- `isolatedModules` is on — use `import type` for type-only imports.
- **Errors cross boundaries as a typed `Result`, not thrown exceptions.** Server auth/commands return `Result<T, ErrorCode>` (`@/lib/result/result`, `ok`/`err`) over a stable code union (`TenantContextErrorCode`, `CommandErrorCode`). Map thrown I/O failures to a generic retryable `SERVER_ERROR` — fail closed, but do NOT conflate "infrastructure is down" with "you are not authorized" (a transient DB/RLS error must NOT present as a permanent no-access denial). Never leak internal detail, stack, SQL, or tenant/user-existence through an error message; user-facing messages are generic Swedish.
- When selecting among multiple candidate rows (e.g. memberships), choose EXPLICITLY in pure code (`active`-first, stable tiebreak) — never rely on lexicographic `.order()` over an enum, which silently mis-selects when a new enum value sorts before the intended one.
- Node helper scripts live in `scripts/**` as ESM `.mjs` (included in `tsconfig`); keep them dependency-free where possible (the verify guards run on bare Node, no test runner).
- **Multi-step npm scripts use a bare-Node orchestrator (`scripts/run-tests.mjs`), NOT chained `pnpm run X && pnpm run Y`.** Chained-pnpm package.json scripts fail on Windows (the script shell can't resolve pnpm on PATH). Reuse the orchestrator pattern for any future multi-step script.

### Framework-Specific Rules

- App Router only, under `src/app/`. Route groups organize the app: the authenticated shell lives in `src/app/(app)/` with its own `layout.tsx`, which is now a SERVER layout that resolves tenant context server-side (the auth boundary) and passes plain props into the client `AppShell` nav island.
- **Protected `(app)` routes that read per-request auth/cookies MUST set `export const dynamic = "force-dynamic"`.** Adding a server auth boundary silently converts previously-static pages to needing per-request env/cookies, and ONLY the `build` gate (not typecheck/lint/test) catches a missing `force-dynamic`. Set it on every protected route.
- **Auth/authorization is decided server-side from the re-validated JWT.** Resolve the caller via the cookie-bound server client's `getClaims()`/`getUser()` (which re-validate the JWT), NEVER from `getSession()`. The `(app)` server layout enforces: `UNAUTHENTICATED -> redirect("/login")`; no active membership -> render the no-access screen. Tenant context (`resolveTenantContext`) is the single authority; values shown in the UI (tenant name, user email) are presentational only.
- Create the `@supabase/ssr` server client FRESH per request via Next's async `cookies()` (Next 16: `cookies()` returns a Promise — await it). Never share a server client across requests. Use the v0.6+ `getAll`/`setAll` cookie API. Anon key only on any client/SSR path.
- **Navigation is data-driven from a single source of truth:** `src/components/app-shell/nav-items.ts`. It contains EXACTLY the seven IN-scope Phase A modules (Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Inställningar) in that order. Swedish UI labels map to English lowercase route paths.
- **Never** add a deferred module — as a nav item, a route, or a placeholder. Specifically excluded: "Pilotstöd/Migrering" and all deferred modules (Fortnox, field-worker, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, analytics). Do not add feature-flag scaffolding for them either (avoid gold-plating). No audit-history dashboard/route/nav item yet — `audit_events` is substrate only; the read UI lands per-entity in its owning Epic 3-8 story.
- **Icons:** inline SVG `path` `d` strings on a shared 24×24 stroke viewBox (`NavIcon`). No icon library (AR28).
- The Phase A shell is intentionally hardcoded-light (`bg-zinc-50`/`bg-white`/`text-zinc-900`); there is deliberately no dark-mode / `forced-colors` theming yet. Do not reintroduce `@media (prefers-color-scheme: dark)` scaffolding.
- `AppShell` remains a client island (it owns `usePathname` + drawer state). When the shell grows, prefer splitting more static chrome into server components rather than enlarging the client island.

### Testing Rules

- **Two deliberately-separated runners (the TEA `testarch-framework` decision):**
  - `node --test` (dependency-free) runs PURE-LOGIC units under `tests/unit/**` — `pnpm run test:unit`. The `tests/support/register.mjs`/alias hook serves this runner only (extensionless + `@/*` import handling).
  - **Vitest** runs the DB-backed integration + RLS-negative suites under `tests/integration/**` — `pnpm run test:int`. Vitest resolves `@/*` natively (Vite 8 `resolve.tsconfigPaths`); config in `vitest.config.ts`.
  - `pnpm test` runs BOTH via `scripts/run-tests.mjs`. Do not invent a third ad-hoc runner.
- **DB-backed suites run against the LOCAL Supabase CLI stack ONLY — never a shared dev/staging/prod project** (architecture §18). The caller owns `supabase db reset` (the runner only probes stack reachability, so it never wipes a dev DB unexpectedly). When the local stack is unreachable the int suites skip cleanly so a Docker-less dev still gets a green unit run; `SUPABASE_TEST_REQUIRED=1` (set in CI) makes a missing stack a HARD failure so the gate can never silently false-green.
- **Test fixtures are loopback-gated and use the universal Supabase local-demo keys** (not real secrets), provisioned via `tests/support/test-env.ts`. The two-tenant fixture (`tests/factories/**`) provisions a UNIQUE tenant pair per test (data-isolation by unique ids, not separate DBs) so cross-file parallelism is safe. Any test asserting a row count MUST seed a per-run unique id (e.g. `crypto.randomUUID()`) — hardcoded correlation/ids accumulate across repeated non-reset local runs and fail the count.
- **`tests/e2e/**` (browser/Playwright) is still gated and excluded from `tsconfig` typecheck** — no browser runner is configured yet. The `(app)` layout redirect / no-access E2E enforcement assertion rides on this. Owner: a later E2E-enablement task.
- Phase A minimum gates (now live): clean install, typecheck, lint, unit tests, build; migration reset from an empty DB, DB-backed integration tests for core commands, cross-tenant RLS negative tests, the H4 RLS table-inventory gate, and source + built-bundle service-role containment. Money/tax/quote-lifecycle unit suites and golden-master comparisons activate in their owning epics.

### Security Regression Harness Rules (Epic 2 — standing contracts)

These are AUTOMATED, fail-closed gates that protect every later tenant-owned table and command. Treat their absence/weakening as a release blocker, not a story-level nicety.

- **Cross-tenant negative suite + H4 inventory gate are a single enrollment contract.** The tenant-table inventory `tests/integration/rls/tenant-table-inventory.ts` (`TENANT_TABLES` + per-table spoof/filter/mutation metadata, and the anon-path helpers) is the ONE place a tenant-owned table enrolls. The cross-tenant suite (`cross-tenant-isolation.rls.test.ts`), the anon-path suite (`anon-path-isolation.rls.test.ts`), AND the H4 gate (`rls-inventory-gate.int.test.ts`) all read it. **STANDING CONTRACT (Epics 3-9): any PR that adds or touches a tenant-owned table MUST enroll it in `TENANT_TABLES` (with metadata) BEFORE merge.** The H4 gate introspects the live schema (direct `tenant_id`, FK-to-`tenants` regardless of column name, partitioned parents, non-system schemas, plus the literal `tenants` root) and FAILS CI with a named "table not covered" message when a tenant-owned table is unenrolled — automated enforcement, not reviewer diligence.
- **The metadata model is compile-exhaustive on purpose.** Per-table helpers use `switch(table)` + `assertNever` so a future enrollee missing its metadata is a TYPECHECK error, not a silently mis-shaped (false-green) negative. Preserve this — broadening a fail-closed gate without an exhaustive type model creates false completeness.
- **Service-role containment is enforced at two layers, the bundle layer being authoritative.** Source guard `scripts/verify/check-service-role-containment.mjs` (`verify:service-role-containment`, in CI before build) flags `NEXT_PUBLIC_*SERVICE_ROLE*` names and `SUPABASE_SERVICE_ROLE_KEY` / the `LOCAL_SUPABASE_SERVICE_ROLE_KEY` re-export symbol referenced from a `"use client"` path. The AUTHORITATIVE built-bundle grep `scripts/verify/check-bundle-containment.mjs` (`verify:bundle-containment`, in CI AFTER `pnpm build` — order is load-bearing) scans the produced `.next` payload for any `*SERVICE_ROLE*` token, the JWT-shaped `"role":"service_role"` value, and `NEXT_PUBLIC_*SERVICE_ROLE*` names, and FAILS LOUD if `.next` is absent (never false-greens). This app uses NO service-role key (anon + RLS); a clean build yields zero hits.
- **`audit_events` is append-only and own-tenant-read.** A `BEFORE UPDATE OR DELETE` trigger blocks mutation; SELECT is own-tenant only. Note the trigger also blocks tenant on-delete-cascade of audit rows — privileged test cleanup must delete audit rows before the tenant. Audit metadata is allow-listed + sanitized; never persist raw input.

### Code Quality & Style Rules

- Code style is enforced by ESLint flat config (`eslint-config-next`) — there is no separate Prettier config; match existing formatting.
- File/dir conventions: route segments and most files are kebab-case/lowercase; React components are PascalCase (`AppShell.tsx`, `NavIcon.tsx`); shared data/util modules are kebab-case (`nav-items.ts`, `tenant-table-inventory.ts`). Migrations are timestamp-prefixed snake_case under `supabase/migrations/**`.
- **DB column/object names are a production contract — do not rename.** The live resolver queries exact snake_case names (`tenant_id`, `user_id`, `role`, `status`, `created_at`, `tenants(name)`); changing a column name breaks production. New migrations are additive.
- Keep "single source of truth" modules authoritative — do not duplicate the nav list, the tenant-table inventory, env-var names, or version pins; reference the canonical file.
- In evergreen committed docs, reference architecture sections (e.g. "architecture §6"), NOT plan positions like "Epic 8 / Story 2.2". Hardcoding plan numbers into durable docs is a known staleness risk flagged in Epic 1.

### Development Workflow Rules

- **Operating modes:** before editing, state whether you are in read-only, docs/config-only, or implementation mode. Implementation mode requires an approved Phase A story or ADR-backed task.
- **Branch types:** `docs/<topic>`, `chore/<topic>`, `feature/<approved-story-id>`, `fix/<approved-issue-id>`, `spike/<topic>`. Feature branches require an approved story.
- **Gated actions (require explicit approval before running):** dependency installs/upgrades, edits to `.env*`, database migrations, edits to product code (`app/**`, `src/**`, `components/**`, `supabase/migrations/**`, `package.json`, `pnpm-lock.yaml`), and network/destructive/prod commands. Do not run `git` operations on behalf of an orchestrated workflow — the orchestrator owns git/PR.
- **CI quality gate (`.github/workflows/ci.yml`):** a `verify` job — `pnpm install --frozen-lockfile` -> `verify:lockfiles` -> `verify:service-role-containment` -> `typecheck` -> `lint` -> `test:unit` -> `build` -> `verify:bundle-containment` (AFTER build, load-bearing order) — and a `db` job (gated behind `verify`) — `supabase start` -> `supabase db reset` (empty DB -> migrate -> seed) -> `test:int` (DB-backed integration + RLS negatives + H4 gate) against the LOCAL stack only. Never weaken, skip, or reorder. docs/config-only PRs must state which product gates were skipped.
- **PR requirements:** scope statement + phase, link to approved story/ADR/process task, changed-files list, tests/checks run, security/RLS impact statement, data-migration impact statement, deferred-scope confirmation. Accepted RLS design deferrals (e.g. Phase A co-member own-tenant audit/membership read) are DISCLOSED in the PR Security/RLS impact statement, not buried in a code comment.
- Deeper governance: `AGENTS.md` (shared source of truth), `CLAUDE.md`, and `docs/process`, `docs/quality`, `docs/security`, `docs/decisions`. Local dev setup: `docs/process/local-setup.md`.

### Critical Don't-Miss Rules

- **Service-role key is SERVER-ONLY.** It bypasses RLS. Never prefix it `NEXT_PUBLIC_`, never import it (or any re-export symbol like `LOCAL_SUPABASE_SERVICE_ROLE_KEY`) into a browser/client path. Any server-side use must be documented (file + purpose) and test-covered. This app currently uses NO service-role key on app paths (anon + RLS); the source + built-bundle containment guards enforce it in CI.
- **RLS-by-default + GRANTs:** a new tenant-owned table is not done until it has (a) `tenant_id` scoping (or is the `tenants` root), (b) enable+`force` RLS with own-tenant policies built on the DEFINER helpers, (c) explicit role GRANTs (`anon -> none`), and (d) enrollment in `TENANT_TABLES`. Missing any one is a tenant-isolation or availability defect.
- **Secrets never get committed.** `.env` and `.env.*` are gitignored; ONLY `.env.example` is whitelisted, and it holds PLACEHOLDERS ONLY — never real project refs, keys, URLs, or PII. Only `NEXT_PUBLIC_`-prefixed vars are exposed to the browser. Do not echo `.env*` contents into prompts.
- **Do not copy from the Lovable app by default** (see Lovable Oracle Policy) — it is a behavioral oracle, not a code source.
- **Stay in Phase A scope.** Do not create migrations, add dependencies, edit `.env`, or modify app code for process-only tasks. If a change touches a deferred module, stop unless there is explicit re-approval in the PR description and a linked planning artifact.
- **CI `pnpm build` is non-hermetic** (the Next scaffold fetches a Google font over the network). Acceptable on networked GitHub runners; revisit (switch to `next/font/local`) only when CI must run network-restricted.

## BMAD Output Discipline

BMAD agents should produce decision-oriented artifacts:

- State phase and scope explicitly.
- Mark each item as `IN`, `DEFERRED`, or `SEAM` where relevant.
- Link back to the baseline plan and related ADRs.
- Separate assumptions from decisions.
- Convert ambiguous Swedish business terms into explicit owner questions.
- Avoid broad implementation plans that smuggle in deferred modules.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code. Follow all rules exactly; when in doubt, prefer the more restrictive option.
- Update this file when new durable patterns emerge.

**For Humans:**

- Keep this file lean and agent-focused. Update when the stack or conventions change (e.g. when money/tax suites, golden-master comparisons, or the E2E browser runner land).
- Review at each epic boundary; remove rules that become obvious over time.

Last Updated: 2026-06-29
