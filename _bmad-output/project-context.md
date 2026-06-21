---
title: ElPro BMAD Project Context
status: active
baseline_plan: docs/planning/saas-rebuild-phased-plan-2026-06-07.md
phase: A - Internal Pilot MVP
project_name: ElproSaas
user_name: Rasmus
last_updated: 2026-06-21
sections_completed:
  ['product_boundary', 'architecture_rules', 'money_tax_rules', 'lovable_oracle', 'technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns', 'bmad_output_discipline']
optimized_for_llm: true
---

# Project Context For BMAD Agents

_Critical rules and patterns AI agents must follow when planning, implementing, or reviewing code in this project. Focuses on unobvious details agents might otherwise miss. Read this before writing any code; when in doubt prefer the more restrictive option._

The durable governance rules (Product Boundary, Architecture, Money/Tax/Quote, Lovable Oracle) are evergreen and phase-scoped. The implementation sections (Technology Stack onward) reflect the conventions established through Epic 1.

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
- Every future business table must be tenant-owned and protected by RLS.
- Phase A schema should contain only the v0 tables required by the baseline plan.
- Do not create placeholder production tables for deferred modules.
- No service-role key may be reachable from browser/client paths.
- No unauthenticated privileged functions are allowed.
- Prefer server-side command handlers for sensitive mutations.
- Critical commands must be auditable, tenant-scoped, validated, and tested.

## Money, Tax, And Quote Rules

- Represent SEK money as integer öre.
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
- **Backend (forthcoming):** Supabase (supabase-js / `@supabase/ssr`). No Supabase client, migration, or dependency exists yet — it lands in Epic 2. Do not add it for process/docs-only tasks.

> These forward-dated version pins (Next 16, React 19, TS 5.9, Tailwind 4) are REAL and intentional. Do not "correct" them down based on stale training knowledge — a past adversarial review wrongly flagged them as non-existent.

## Critical Implementation Rules

### Language-Specific Rules

- TypeScript `strict` is on. No implicit `any`; type everything. Prefer `readonly` and `as const` for fixed data (see `nav-items.ts`).
- Use the `@/*` alias for intra-`src` imports; avoid deep relative `../../..` chains.
- `isolatedModules` is on — use `import type` for type-only imports.
- Node helper scripts live in `scripts/**` as ESM `.mjs` (included in `tsconfig`); keep them dependency-free where possible (the lockfile guard runs on bare Node, no test runner).

### Framework-Specific Rules

- App Router only, under `src/app/`. Route groups organize the app: the authenticated shell lives in `src/app/(app)/` with its own `layout.tsx`.
- **Navigation is data-driven from a single source of truth:** `src/components/app-shell/nav-items.ts`. It contains EXACTLY the seven IN-scope Phase A modules (Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Inställningar) in that order. Swedish UI labels map to English lowercase route paths.
- **Never** add a deferred module — as a nav item, a route, or a placeholder. Specifically excluded: "Pilotstöd/Migrering" and all deferred modules (Fortnox, field-worker, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, analytics). Do not add feature-flag scaffolding for them either (avoid gold-plating).
- **Icons:** inline SVG `path` `d` strings on a shared 24×24 stroke viewBox (`NavIcon`). No icon library (AR28).
- The Phase A shell is intentionally hardcoded-light (`bg-zinc-50`/`bg-white`/`text-zinc-900`); there is deliberately no dark-mode / `forced-colors` theming yet. Do not reintroduce `@media (prefers-color-scheme: dark)` scaffolding.
- The shell is currently a single client island (`"use client"` `AppShell`). When auth/tenant context lands (Epic 2), prefer splitting into a server layout + a small client nav island rather than enlarging the client island. Tenant/user top-bar placeholders are deferred to Epic 2 — do not stub them now.

### Testing Rules

- **No automated test harness exists yet.** `pnpm test` is a deliberate placeholder that prints a notice and exits 0, solely to keep the CI unit-test gate wired. Do NOT treat a green `test` as real coverage.
- The test framework is initialized by the TEA `testarch-framework` flow in the first product story that needs it (Epic 2); money/tax unit suites land around Epic 4. Do not invent an ad-hoc test runner — follow the TEA framework decision when it lands.
- When the harness arrives, the highest-value first unit test is the `scripts/verify/check-lockfiles.mjs` guard (currently the only bespoke verification logic and itself untested).
- Backfill obligations recorded for the post-harness story: automated coverage of the app shell (the seven nav items render and ONLY those, `aria-current` active state with a non-color indicator, icon-only controls expose accessible names + tooltips, and the sidebar→rail→drawer responsive behavior).
- Phase A minimum gates once code exists: clean install, typecheck, lint, unit tests for money/tax/quote lifecycle, integration tests for core commands, basic RLS cross-tenant negative tests, migration reset from an empty DB once migrations exist.

### Code Quality & Style Rules

- Code style is enforced by ESLint flat config (`eslint-config-next`) — there is no separate Prettier config; match existing formatting.
- File/dir conventions: route segments and most files are kebab-case/lowercase; React components are PascalCase (`AppShell.tsx`, `NavIcon.tsx`); shared data/util modules are kebab-case (`nav-items.ts`).
- Keep "single source of truth" modules authoritative — do not duplicate the nav list, env-var names, or version pins; reference the canonical file.
- In evergreen committed docs, reference architecture sections (e.g. "architecture §6"), NOT plan positions like "Epic 8 / Story 2.2". Hardcoding plan numbers into durable docs is a known staleness risk flagged in Epic 1.

### Development Workflow Rules

- **Operating modes:** before editing, state whether you are in read-only, docs/config-only, or implementation mode. Implementation mode requires an approved Phase A story or ADR-backed task.
- **Branch types:** `docs/<topic>`, `chore/<topic>`, `feature/<approved-story-id>`, `fix/<approved-issue-id>`, `spike/<topic>`. Feature branches require an approved story.
- **Gated actions (require explicit approval before running):** dependency installs/upgrades, edits to `.env*`, database migrations, edits to product code (`app/**`, `src/**`, `components/**`, `supabase/migrations/**`, `package.json`, `pnpm-lock.yaml`), and network/destructive/prod commands. Do not run `git` operations on behalf of an orchestrated workflow — the orchestrator owns git/PR.
- **CI quality gate (`.github/workflows/ci.yml`), in this exact order — never weaken, skip, or reorder:** `pnpm install --frozen-lockfile` -> `verify:lockfiles` -> `typecheck` -> `lint` -> `test` -> `build`. Deferred gates (migration reset, integration, RLS/storage negative, golden-master, secret scan) are activated by later stories per `docs/quality/ci.md`. docs/config-only PRs must state which product gates were skipped.
- **PR requirements:** scope statement + phase, link to approved story/ADR/process task, changed-files list, tests/checks run, security/RLS impact statement, data-migration impact statement, deferred-scope confirmation.
- Deeper governance: `AGENTS.md` (shared source of truth), `CLAUDE.md`, and `docs/process`, `docs/quality`, `docs/security`, `docs/decisions`. Local dev setup: `docs/process/local-setup.md`.

### Critical Don't-Miss Rules

- **Service-role key is SERVER-ONLY.** It bypasses RLS. Never prefix it `NEXT_PUBLIC_`, never import it into browser/client code paths. Any server-side use must be documented (file + purpose) and test-covered. (No automated guard exists yet — Epic 2 should add a lint/CI check against client-side service-role exposure.)
- **Secrets never get committed.** `.env` and `.env.*` are gitignored; ONLY `.env.example` is whitelisted, and it holds PLACEHOLDERS ONLY — never real project refs, keys, URLs, or PII. Env-var NAMES are the documented contract; the code reading them lands in Epic 2. Only `NEXT_PUBLIC_`-prefixed vars are exposed to the browser.
- **No secrets read into prompts** unnecessarily; do not echo `.env*` contents.
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

- Keep this file lean and agent-focused. Update when the stack or conventions change (e.g. when the test harness, Supabase client, or auth lands).
- Review at each epic boundary; remove rules that become obvious over time.

Last Updated: 2026-06-21
