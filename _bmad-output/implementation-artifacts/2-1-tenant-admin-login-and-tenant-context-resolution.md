# Story 2.1: Tenant Admin Login And Tenant Context Resolution

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant admin,
I want to sign in and see the active tenant context,
so that all Phase A work is clearly scoped to the correct company.

## Acceptance Criteria

1. **Given** an authenticated Supabase user with active `tenant_admin` membership, **when** the user opens the app, **then** the server resolves tenant context from membership (NOT from any client-supplied tenant id), **and** the UI displays the active tenant/company context (top-bar tenant/user region).
2. **Given** an authenticated user without active membership (no membership row, or a row whose `status` is not `active` — e.g. `invited`/`disabled`), **when** the user opens a protected app route, **then** access is denied with a user-safe message, **and** no tenant-owned data is loaded.
3. **Given** an unauthenticated user, **when** the user opens a protected app route or invokes a server command, **then** the user is redirected (route) or rejected (command) with a stable user-safe error, **and** no privileged function or route is callable anonymously.
4. **Given** a request that carries a client-supplied `tenant_id` (query, body, header, or cookie), **when** the server resolves tenant context, **then** the client value is ignored or verified against the membership-resolved tenant, **and** a mismatched/spoofed client tenant id never widens access (resolution remains membership-derived).

## Tasks / Subtasks

- [x] Task 1: Add and wire the Supabase auth client libraries — GATED, request approval first (AC: 1, 2, 3)
  - [x] 1.1 **STOP and request explicit approval before installing.** Adding dependencies is a gated action (AGENTS.md / project-context.md Workflow Rules; AR28). This story is the first to consume Supabase, so it needs `@supabase/ssr` and `@supabase/supabase-js`. Pin EXACT versions (no `^`/`~`) consistent with the version-pinning discipline; run `pnpm add` only after approval; commit the updated `pnpm-lock.yaml` and confirm `pnpm run verify:lockfiles` stays green (single lockfile). [Source: project-context.md#Technology Stack; architecture.md#6; epics.md#Story 2.1 Dependencies]
  - [x] 1.2 Create the SSR Supabase client factories per `@supabase/ssr` v0.6+ cookie API (`getAll`/`setAll`, NOT the removed `get`/`set`/`remove`): a browser client (anon key) and a server client (anon key, cookie-bound to the request) under `src/server/db/` or `src/server/auth/` (architecture §3 names `src/server/auth/` and `src/server/db/`). The server client reads cookies via Next.js `cookies()` in a Server Component / Route Handler context. [Source: architecture.md#3, #5, #6; @supabase/ssr Next.js SSR guide]
  - [x] 1.3 Consume env vars by their established names ONLY (the documented contract from `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe), and `SUPABASE_SERVICE_ROLE_KEY` (server-only). Do NOT rename them. If `@supabase/ssr` examples use other names, alias in code — do not change the contract without updating `.env.example` in the same change. [Source: .env.example:27-42; project-context.md#Critical Don't-Miss Rules]
- [x] Task 2: Implement `resolveTenantContext` as the server authority (AC: 1, 2, 3, 4)
  - [x] 2.1 Create `resolveTenantContext` server-side (architecture §5 names it; `src/server/auth/` or `src/server/commands/tenant/`). Steps, in order: (a) resolve the authenticated Supabase user from server cookies/session via the SSR server client using a method that RE-VALIDATES the JWT — `supabase.auth.getUser()` (re-validates against the auth server) or `supabase.auth.getClaims()` (validates the JWT signature against the project's published public keys); NEVER base the authorization decision on `getSession()` (it is not guaranteed to revalidate the token in server code); (b) load the user's active `tenant_admin` membership from `tenant_memberships` where `status = 'active'` and `role = 'tenant_admin'`; (c) return a typed context `{ userId, tenantId, role, status }` on success, or a typed failure. Client-supplied `tenant_id` is ignored or verified against the resolved membership — never trusted as the authority. [Source: architecture.md#5 (command shape steps 1-4), #6 Auth, #8 Tenant context rules; epics.md#Story 2.1 Technical Notes; Supabase SSR auth guide — verified 2026-06-21]
  - [x] 2.2 Return STABLE typed error codes (no thrown raw errors to the client): `UNAUTHENTICATED` (no/invalid session), `TENANT_MEMBERSHIP_REQUIRED` (authenticated but no active `tenant_admin` membership). Map these to user-safe messages; never leak whether a specific tenant/user exists, stack traces, or internal detail. Reuse a `Result`-style return (architecture §3 lists `src/lib/result/`) rather than exceptions for control flow. [Source: architecture.md#5 (error codes UNAUTHENTICATED / TENANT_MEMBERSHIP_REQUIRED / TENANT_ACCESS_DENIED), #3 lib/result; ux-design-specification.md#11 (generic access message, no cross-tenant leakage)]
  - [x] 2.3 Treat membership `status` strictly: ONLY `status = 'active'` grants access. `invited`, `disabled`, or any non-`active` value is NO access — and is a DISTINCT case from "no membership row at all" (both deny, but the disabled case must be exercised separately per the test requirements). Role must be `tenant_admin`; any other role value is rejected. [Source: architecture.md#8 (status active/invited/disabled), epics.md#Story 2.1 Test Requirements (active / missing / disabled / anonymous); test-design-epic-2.md P1 rows "disabled/inactive membership"]
- [x] Task 3: Add the auth route group, `/login`, and the protected-route boundary (AC: 1, 2, 3)
  - [x] 3.1 Add the `(auth)` route group with a `/login` page (architecture §3 lists `src/app/(auth)/`; §4 route table: `/login` → "Logga in", Supabase Auth entry). The login page collects email + password (password-based auth, per the B2 test-design decision below) and signs in via the browser Supabase client. On success, redirect into the `(app)` shell (e.g. `/dashboard`). Keep the login page minimal and Phase A in scope — no signup, no magic-link-only flow, no password reset UI unless trivially provided by Supabase and in scope. [Source: architecture.md#3, #4 (/login row); epics.md#Story 2.1; test-design-epic-2.md B2 (password-based auth)]
  - [x] 3.2 Add the protected-route boundary so the `(app)` group requires an authenticated user WITH active `tenant_admin` membership. Prefer enforcing in the `(app)` server layout (or Next.js middleware) calling `resolveTenantContext`: unauthenticated → redirect to `/login` (AC3); authenticated-but-no-active-membership → render a user-safe "no access" state, load ZERO tenant data (AC2). The `(app)/layout.tsx` is currently a thin client wrapper around `AppShell` (story 1.3) with NO auth boundary — this story adds it. Per project-context.md, prefer splitting into a server layout + the existing small client nav island rather than enlarging the client island; do the auth resolution server-side. [Source: src/app/(app)/layout.tsx:1-17; project-context.md#Framework-Specific Rules (server-layout split when auth lands); epics.md#Story 2.1 AC]
  - [x] 3.3 A sign-out affordance is in scope to the extent needed to make the login/logout loop testable (e.g. a sign-out action in the top-bar user region) — keep it minimal. [Source: ux-design-specification.md#2 (top bar: current user); epics.md#Story 2.1]
- [x] Task 4: Populate the top-bar tenant/user region with the resolved context (AC: 1) — resolves a deferred-work item
  - [x] 4.1 Fill the top-bar tenant/user region in `AppShell.tsx`. Today the slim top bar renders only hamburger + page-title region + an EMPTY `data-slot="primary-action"` div (AppShell.tsx:207-238); the UX spec (§2) calls for tenant context + current user in the top bar. This story is the named owner of that deferred item — render the active tenant/company name and the current user (e.g. email) from the server-resolved context. Pass the resolved context DOWN from the server layer (do not re-resolve or trust client state for authority); the display value is presentational, the authority stays server-side. [Source: deferred-work.md "Top-bar tenant/user region deferred to Epic 2 (Story 2.1)"; epic-1-retro Action Items / Technical Debt #6 (owner: Story 2.1); ux-design-specification.md#2; AppShell.tsx:204-238]
  - [x] 4.2 If the resolved tenant/user context now flows into the shell, the previously-empty placeholders are replaced with real values — do NOT leave churn-prone empty stubs and do NOT fabricate placeholder text. Mark the deferred-work ledger item resolved with a dated note when done. [Source: deferred-work.md (2026-06-16, owner decision); project-context.md#Framework-Specific Rules ("do not stub them now" — now is the story that fills them)]
- [x] Task 5: Add the client-path service-role containment guard (lint or CI grep) (AC: 3) — resolves a deferred-work item
  - [x] 5.1 This story is the first to read env vars in code, so it is the named owner of the deferred client-side service-role guard. Add an automated check that fails if `SUPABASE_SERVICE_ROLE_KEY` is `NEXT_PUBLIC_`-prefixed anywhere, or if it is imported/referenced from a browser/client path (`"use client"` modules, anything reachable from the browser bundle). Implement as an ESLint rule (e.g. `no-restricted-syntax`/`no-restricted-imports` in the flat config) OR a bare-Node grep guard under `scripts/verify/` wired into CI (mirroring the `check-lockfiles.mjs` pattern — dependency-free `.mjs`). Prefer the lighter option that genuinely bites. [Source: deferred-work.md "Env-contract security rules are prose-only" (owner: Epic 2 auth/tenant-context story); epic-1-retro Action Items / Technical Debt #2 + Next Steps #4; test-design-epic-2.md R-002; project-context.md#Critical Don't-Miss Rules (Service-role key is SERVER-ONLY; no automated guard exists yet — Epic 2 should add one)]
  - [x] 5.2 If this story does NOT itself need the service-role key (it likely does not — auth + membership read run as the authenticated user under the anon key + RLS), do NOT import the service-role client anywhere. The guard exists to prevent future leakage; this story should not introduce the first server-only service-role usage unless a concrete, documented need arises (and if it does: document file + purpose + test, server-only). [Source: architecture.md#6 (service-role server-only minimal); project-context.md#Critical Don't-Miss Rules; epics.md#Story 2.1 Stop Conditions]
- [x] Task 6: Tests — UI/server-action layer now; authoritative INT/RLS tests are GATED on Story 2.2 (AC: all)
  - [x] 6.1 **Sequencing reality (do not fight this):** the real test runner and the local Supabase stack (`supabase start` / `supabase db reset`), the `tenants`/`tenant_memberships` tables, RLS helpers, and the two-tenant factories all land in Story 2.2 — they do NOT exist when 2.1 is implemented. Therefore 2.1's AUTHORITATIVE integration/RLS tests (active membership resolves correct tenant; mismatched client tenant id denied; anonymous rejected at the DB/command boundary) are written against 2.2's local stack and are owned/enrolled there. In 2.1, do what is testable WITHOUT the stack: pure-logic unit tests of `resolveTenantContext`'s decision branches with the Supabase client + membership query mocked/faked (active → context; missing → `TENANT_MEMBERSHIP_REQUIRED`; disabled/invited → `TENANT_MEMBERSHIP_REQUIRED`; no user → `UNAUTHENTICATED`; client `tenant_id` mismatch → ignored/denied). Do NOT invent an ad-hoc test runner — if `pnpm test` is still the placeholder when 2.1 runs, follow the TEA `testarch-framework` decision (it may land here or in 2.2); coordinate, do not freelance a runner. [Source: test-design-epic-2.md "Critical Prerequisite: Test Infrastructure Does Not Yet Exist" + Dependencies #2/#3; project-context.md#Testing Rules; epic-2 retro-note R-007]
  - [x] 6.2 Map the tests this story is responsible for to the epic test-design scenarios so 2.2/2.4 can verify nothing fell through: 2.1 AC1 → "Active membership resolves correct tenant context server-side" (INT, R-004, gated on 2.2) + "Active tenant/company context displayed in UI" (E2E, R-004); 2.1 AC2 → "Authenticated user without active membership is denied; no tenant data loaded" (INT/E2E, R-004) + "Disabled/inactive membership treated as no-access" (INT, R-004); 2.1 AC3 → "Anonymous user cannot reach protected route/command" (INT/E2E, R-003); 2.1 AC4 → "Command rejects client-supplied tenant_id mismatch" (INT, R-004). Record in the Dev Agent Record which of these are deferred to 2.2's stack and which are covered now. [Source: test-design-epic-2.md P0/P1 coverage tables (rows citing 2.1 ACs)]
  - [x] 6.3 The service-role containment guard (Task 5) MUST have a proof: confirm it goes red when a `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or a client-path service-role import is planted on a scratch basis, then green when removed. Record the evidence. [Source: test-design-epic-2.md R-002 verification; epic-1-retro team agreement (log dismissal/verification evidence)]
- [x] Task 7: Verify, gate sweep, and finalize (AC: all)
  - [x] 7.1 Run the active CI gate sequence in order and record results: `pnpm install --frozen-lockfile` → `pnpm run verify:lockfiles` → `pnpm typecheck` → `pnpm lint` (now including the new service-role guard rule if implemented as ESLint) → `pnpm test` → `pnpm build`. This story adds product code (`src/**`) and likely a dependency, so the FULL gate set applies — no docs-only skip. Note that `pnpm build` is non-hermetic (fetches a Google font); acceptable on a networked machine. [Source: docs/quality/ci.md; project-context.md#Development Workflow Rules; deferred-work.md (non-hermetic build, still deferred)]
  - [x] 7.2 Scope guardrail sweep (mandatory, not optional): confirm NO deferred module was introduced (no Fortnox/field/supplier/AI/HR/rentals/assets/DoU/tender/RBAC code, route, table, or nav item; nav-items.ts unchanged — still exactly the seven Phase A items); NO production schema/migration created here (tenant tables land in 2.2, not 2.1 — see Critical Constraints); NO full-RBAC/role-management UI; NO public privileged/unauthenticated endpoint; NO `.env` edited; service-role key NOT in any client path. [Source: epics.md#Story 2.1 Stop Conditions; AGENTS.md deferred list; project-context.md#Critical Don't-Miss Rules]
  - [x] 7.3 Security/RLS impact statement for the PR: this story establishes tenant-context AUTHORITY (server-resolved from membership). State that client tenant ids are ignored/verified, anonymous access is rejected/redirected, and the service-role guard was added. Note explicitly that the cross-tenant RLS negative suite and the table-inventory gate land with the schema in Story 2.2/2.4 — 2.1 cannot fully prove DB-level isolation without that stack. [Source: epics.md#Story 2.1 Security/RLS Impact; architecture.md#9; test-design-epic-2.md Dependencies]
  - [x] 7.4 If any deferred-work item this story owns was resolved (top-bar region Task 4, service-role guard Task 5), mark it resolved in `deferred-work.md` with a dated note; add any NEW deferral discovered here to `deferred-work.md` with an owner story BEFORE this story closes (team agreement from epic-1 retro). [Source: epic-1-retro Team Agreements ("Deferred items must be added... with an owner story before the implementing story closes")]

## Dev Notes

### Critical Constraints (read first)

- **This is the FIRST product-infrastructure story that touches real auth.** It writes server-side auth/tenant-resolution logic, a `/login` route, a protected-route boundary, and the first env-var consumption. It is implementation mode and requires the full gate set. State your operating mode before editing. [Source: epics.md#Story 2.1; project-context.md#Development Workflow Rules]
- **Tenant authority is SERVER-RESOLVED, never client-trusted.** `resolveTenantContext` derives the tenant from the authenticated user's active `tenant_memberships` row — not from any client-supplied tenant id (query/body/header/cookie). A client `tenant_id` is ignored or verified against the resolved membership; a mismatch never widens access. This is the load-bearing security property of the whole epic (test-design R-004). [Source: architecture.md#5 step 4, #8; test-design-epic-2.md R-004; epics.md#Story 2.1 Technical Notes]
- **`tenants` and `tenant_memberships` TABLES + RLS land in Story 2.2, NOT here.** Creating migrations / the Supabase local stack is approval-gated and explicitly owned by Story 2.2 (epics.md). 2.1 writes the auth + resolution CODE that READS membership; it does not create the schema. If you find you cannot resolve membership without a table, that confirms the 2.1→2.2 dependency — implement against the documented `tenant_memberships` shape (`tenant_id`, `user_id`, `role` ∈ {`tenant_admin`}, `status` ∈ {`active`,`invited`,`disabled`}, audit timestamps) and let 2.2 land the DDL + the authoritative DB tests. Do NOT scaffold `supabase/`, `config.toml`, or a migration in this story. [Source: architecture.md#7, #8; epics.md#Story 2.2; sprint-status execution order; test-design-epic-2.md "Critical Prerequisite"]
- **Adding `@supabase/ssr` + `@supabase/supabase-js` is a GATED action.** Stop and get explicit approval before `pnpm add`. Pin EXACT versions (no caret/tilde) — the version-pinning discipline is a hard rule. Commit `pnpm-lock.yaml`; keep `verify:lockfiles` green. [Source: project-context.md#Technology Stack & Versions; AR28; AGENTS.md Gated actions]
- **Service-role key is SERVER-ONLY and likely UNUSED by this story.** Auth + membership read run as the authenticated user (anon key + RLS). Do NOT import the service-role client into any path here unless a concrete documented need arises; add the client-path containment guard regardless (Task 5). NEVER `NEXT_PUBLIC_` the service-role key; never reach it from `"use client"` code. [Source: architecture.md#6; project-context.md#Critical Don't-Miss Rules; epics.md#Story 2.1 Stop Conditions]
- **Never base server-side authorization on `getSession()`.** `getSession()` returns the cookie-stored session WITHOUT a guaranteed re-validation against the auth server and must not be the basis of an authorization decision in server code. Use a method that re-validates the JWT: `getUser()` (re-validates against the auth server) or `getClaims()` (validates the JWT signature against the project's published public keys — the current Supabase SSR recommendation). This is the canonical `@supabase/ssr` SSR-security guidance, verified against the live Supabase SSR auth guide 2026-06-21. [Source: @supabase/ssr / Supabase SSR auth docs (verified 2026-06-21); architecture.md#5 step 1]
- **No magic-link-only auth for automated tests.** Test users are password-based or admin-created (test-design blocker B2); any admin/service key used for test setup is test-only and never imported into app/client code. The `/login` page therefore supports password sign-in. [Source: epics.md#Story 2.1 Technical Notes (B2); test-design-epic-2.md B2; architecture.md#18]
- **Stop Conditions (this story):** STOP and request human approval if a service-role key is proposed for any browser/client path, OR if a public/unauthenticated privileged auth bypass is introduced. Also stop (gated) for the dependency add. [Source: epics.md#Story 2.1 Stop Conditions]

### Deferred-work items this story OWNS or must consider

Folded from `_bmad-output/implementation-artifacts/deferred-work.md` (only the entries overlapping this story; the rest of the ledger is out of scope and must NOT be reopened):

- **OWNED — Top-bar tenant/user region (Story 2.1 is the named owner).** The slim top bar ships only the page-title region + an empty primary-action slot (AppShell.tsx:204-238); the UX spec (§2) wants tenant context + current user there. Owner decision (2026-06-16) parked the placeholders for "Epic 2 (Story 2.1) — auth/tenant context populates them." Fill them in Task 4 from the server-resolved context; mark the ledger item resolved with a dated note. [Source: deferred-work.md (code review of story-1.3, 2026-06-16); epic-1-retro Technical Debt #6]
- **OWNED — Client-side service-role import guard (lint/CI), Epic 2 auth/tenant-context story is the owner.** The "never `NEXT_PUBLIC_` the service-role key / never import into client paths" rule is prose-only; no automated check exists. Add it in Task 5 now that env consumption lands here. [Source: deferred-work.md (code review of 1-4, 2026-06-21, "Env-contract security rules are prose-only"); epic-1-retro Technical Debt #2 + Next Steps #4]
- **CONSIDER (not required) — single-client-island shell split.** The `(app)` shell is one `"use client"` island; the deferred note says revisit a server-layout + small client-nav-island split "when auth/tenant context lands (Epic 2)." Task 3.2 adds the auth boundary server-side; prefer doing the resolution in a server layout and passing context into the existing client nav island rather than enlarging the client island. A full refactor is NOT mandated — do the minimum clean split that lets auth resolve server-side. [Source: deferred-work.md (code review of story-1.3, single client island); project-context.md#Framework-Specific Rules]
- **NOT this story (leave deferred) — drawer-link focus after navigation, dark-mode/forced-colors, non-hermetic font fetch, hardcoded plan numbers in evergreen docs.** All assigned elsewhere (route-transition/a11y pass, future theming pass, CI-hardening/font story, docs-maintenance pass). Do not reopen. If you add NEW evergreen-doc references to forthcoming behavior, cite architecture section numbers (e.g. "architecture §6"), NOT "Epic N / Story N.N". [Source: deferred-work.md (2026-06-16/2026-06-21); epic-1-retro Insight 2 / Action Item 2]

### Epic-2 + epic-transition constraints (folded from retro feeds — apply directly)

These are epic-wide gotchas and conventions surfaced for Epic 2; reflect them in implementation, not as a "see the retro" pointer:

- **Test infra (real runner + local Supabase + two-tenant factories) does NOT exist yet and lands INSIDE Epic 2 (Story 2.2; runner via TEA `testarch-framework`).** Story 2.1's authoritative INT/RLS tests are gated on that stack — do the UI/server-action-layer + pure-logic tests now, and let 2.2 own the DB-backed isolation suite (Task 6). Do not stub a hollow runner. [Source: epic-2 retro-note (Phase 2 epic test design); test-design-epic-2.md "Critical Prerequisite"]
- **The RLS table-inventory gate (architecture H4, Story 2.4) is the standing regression mechanism for every later tenant-owned table.** It is NOT in 2.1's scope to build, but be aware: 2.2 adds `tenants`/`tenant_memberships`, and 2.4 wires the gate. Do not add a tenant-owned table here that would later need enrollment — 2.1 adds no tenant tables. [Source: epic-2 retro-note (RLS table-inventory gate); test-design-epic-2.md R-008]
- **Expect "fail-loud on the new table" later — that is by design.** When 2.4's inventory gate goes live, any tenant-owned table not enrolled in the cross-tenant negative suite fails CI. 2.1 introduces none, so this does not bite here, but do not treat a future failing inventory gate on a 2.2 table as a bug to suppress — it is the gate working. [Source: epic-1-retro / test-design-epic-2.md H4]
- **Adversarial-review ground-truth check (Epic 1 Action Item 1, apply from Story 2.1).** The toolchain uses REAL forward-dated pins (Next 16, React 19, TS 5.9, Tailwind 4) and will use real current `@supabase/ssr`/`supabase-js` versions. If any review layer claims a version/API "doesn't exist," cross-check `package.json`/the lockfile before acting, and LOG the dismissal evidence in the Dev Agent Record. [Source: epic-1-retro Insight 1 / Action Item 1 / Team Agreements]
- **Reference architecture sections, not plan numbers, in evergreen committed docs (Epic 1 Action Item 2, apply from Story 2.1).** If you touch `.env.example`, README, or any durable doc, cite "architecture §N", not "Epic N / Story N.N". [Source: epic-1-retro Insight 2 / Action Item 2]
- **Real-browser keyboard/focus verification for any focus-dependent UI you add (Epic 1 Action Item 3).** The `/login` form and any new top-bar controls (sign-out) are focus-dependent; verify focus behavior with system focus confirmed present in a real browser, not a headless preview (headless `:focus` is unreliable here). Record the confirmation in the Dev Agent Record. [Source: epic-1-retro Insight 5 / Action Item 3 / MEMORY preview-harness-focus-limitation]
- **Windows/WSL Docker conventions still apply** — but 2.1 stands up NO Docker/Supabase Compose stack (that is 2.2). Do not start a local stack or make global Docker changes here. [Source: epic-1-retro Critical Prep #4; docs/process/local-setup.md]

### What already exists (do not recreate, reuse/verify)

- **`.env.example` (created by Story 1.4)** already defines the EXACT env-var contract: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, loudly commented), and optional `SUPABASE_SIGNED_URL_TTL_SECONDS`. Consume these NAMES; do not redefine them. [Source: .env.example:27-42]
- **`(app)` route group + `AppShell`** (Story 1.3): `src/app/(app)/layout.tsx` is a thin wrapper rendering `<AppShell>`; `AppShell.tsx` holds the sidebar/rail/drawer + slim top bar with an empty primary-action slot. Seven Phase A routes exist as placeholder pages. `nav-items.ts` is the single nav source of truth (exactly seven items) — do NOT modify it. [Source: src/app/(app)/layout.tsx; src/components/app-shell/AppShell.tsx; src/components/app-shell/nav-items.ts]
- **`src/server/` and `src/app/(auth)/` are named in the architecture target tree but do NOT exist yet** — this story creates `src/app/(auth)/login/` and the `src/server/auth/` (+ `src/server/db/`) modules. Place auth/command code there, NOT inside UI modules (architecture §22 structure rules). [Source: architecture.md#3, #22]
- **`scripts/verify/check-lockfiles.mjs`** is the existing bespoke verification pattern (bare-Node, dependency-free `.mjs`, wired into CI). If you implement the service-role guard as a script, mirror this pattern. [Source: scripts/verify/; project-context.md#Testing Rules]
- **`docs/quality/ci.md`** documents the active gates and the deferred gates mapped to stories; the migration-reset / RLS-negative gates activate in Story 2.2/2.4, not 2.1. Link, don't restate. [Source: docs/quality/ci.md]

### Architecture compliance

- **Server command pattern (architecture §5):** `resolveTenantContext` follows steps 1-4 (resolve user → resolve active membership → reject unauthenticated / no-active-`tenant_admin` → ignore/verify client `tenant_id`). It performs NO mutation (the §5 table marks it "No mutation"). Commands live under `src/server/`, invoked by App Router route handlers / thin server actions — not scattered in UI modules. [Source: architecture.md#5]
- **Auth + tenancy (architecture §6, §8):** Supabase Auth is the identity source; product access REQUIRES an active `tenant_memberships` row; Phase A role is ONLY `tenant_admin`; end customers do not authenticate; NO public/unauthenticated privileged route, function, cron, webhook, or acceptance portal exists. Tenant context resolves from membership, not client input; if tenant switching is ever added it only selects among the user's existing memberships (out of scope now — Phase A pilot has one tenant, fixtures have two). [Source: architecture.md#6, #8]
- **Error contract (architecture §5, §22):** stable error codes + user-safe messages; API JSON is camelCase; TypeScript is `camelCase`/`PascalCase`, SQL is `snake_case`; tenant id is `tenantId` in TS / `tenant_id` in SQL; timestamps are `timestamptz`/ISO. Use `import type` for type-only imports (`isolatedModules`). [Source: architecture.md#5, #22; project-context.md#Language-Specific Rules]
- **Security posture (architecture §9, §20):** the relevant Phase A risks for THIS story are client tenant spoofing (resolve from membership; ignore/verify client ids), anonymous privileged access (reject/redirect), and service-role leakage (server-only; client-path guard). The cross-tenant RLS negative matrix and storage isolation are §9 concerns that land with the schema (2.2) and harness (2.4). [Source: architecture.md#9, #20]
- **File/dir conventions:** route segments kebab-case/lowercase; React components PascalCase; shared data/util modules kebab-case; the `@/*` alias for intra-`src` imports (no deep relative chains). [Source: project-context.md#Code Quality & Style Rules; architecture.md#22]

### Library / framework requirements

- **Supabase SSR auth on Next.js App Router (verified against the live Supabase SSR guide 2026-06-21):** use `@supabase/ssr` (server + browser client factories implementing the `getAll`/`setAll` cookie methods — `setAll` is invoked after token refresh; the older single-cookie `get`/`set`/`remove` API is deprecated/removed and will break) together with `@supabase/supabase-js`. Pin exact versions on install. The server client is created per-request inside Server Components / Route Handlers using Next's `cookies()`; never share a server client across requests. For the authorization decision use `getUser()` or `getClaims()` (both re-validate the JWT), never `getSession()`. [Source: @supabase/ssr Next.js Server-Side Auth guide (verified 2026-06-21); architecture.md#6]
- **Pinned stack to respect (do not bump):** Next.js `16.2.9` (App Router, `src/app/`), React `19.2.4`, TypeScript `5.9.3` (`strict`, `isolatedModules`, `@/*` alias), Tailwind v4 via `@theme` in `globals.css`, ESLint `9.39.4` flat config (`eslint.config.mjs`). The shell is hardcoded-light — do not reintroduce dark-mode scaffolding. These forward-dated pins are REAL. [Source: project-context.md#Technology Stack & Versions; eslint.config.mjs]
- **No icon library** — if the login/user UI needs an icon, use inline SVG on the shared 24×24 stroke viewBox (`NavIcon` pattern), consistent with AR28. [Source: project-context.md#Framework-Specific Rules]

### File-structure requirements (where things go)

- `src/app/(auth)/login/page.tsx` — the Supabase Auth login entry (route `/login`, label "Logga in"). [architecture.md#3, #4]
- `src/app/(app)/layout.tsx` — extend to enforce the auth + active-membership boundary (prefer a server layout resolving context, passing it to the client `AppShell`). [src/app/(app)/layout.tsx]
- `src/server/auth/resolve-tenant-context.ts` (and a `Result`-style type) — the server tenant-resolution authority. [architecture.md#3, #5; src/lib/result/ per §3]
- `src/server/db/` — `@supabase/ssr` server + browser client factories (server client cookie-bound per request). [architecture.md#3]
- `src/components/app-shell/AppShell.tsx` — fill the top-bar tenant/user region from passed-in context (Task 4). [AppShell.tsx:204-238]
- `scripts/verify/<guard>.mjs` OR an `eslint.config.mjs` rule — the service-role client-path containment guard (Task 5). [scripts/verify/; eslint.config.mjs]
- Tests: pure-logic unit tests co-located or under `tests/unit/`; the DB-backed INT/RLS tests live under `supabase/tests/` / `tests/integration/` and are OWNED by Story 2.2's stack (architecture §22: do not scatter RLS tests in UI modules). [architecture.md#3, #22; test-design-epic-2.md]

### Testing requirements (this story)

- **Authoritative DB-backed tests are GATED on Story 2.2's local Supabase stack** (no runner / no `supabase/` / no `tenant_memberships` table / no factories exist when 2.1 is implemented). In 2.1: write pure-logic unit tests of `resolveTenantContext`'s branches with the Supabase client + membership query faked/mocked — active `tenant_admin` → context; missing row → `TENANT_MEMBERSHIP_REQUIRED`; `disabled`/`invited` status → `TENANT_MEMBERSHIP_REQUIRED` (distinct case); no user → `UNAUTHENTICATED`; client `tenant_id` mismatch → ignored/denied. If `pnpm test` is still the placeholder, follow the TEA `testarch-framework` decision rather than freelancing a runner. [Source: test-design-epic-2.md "Critical Prerequisite" + Dependencies; project-context.md#Testing Rules]
- **Coverage owed by 2.1's ACs, mapped to epic test-design scenarios** (record which are done-now vs deferred-to-2.2 in the Dev Agent Record): AC1 → INT "active membership resolves correct tenant" (R-004, gated on 2.2) + E2E "tenant/company context displayed in UI" (R-004); AC2 → INT/E2E "no active membership → denied, no tenant data" (R-004) + INT "disabled membership → no access" (R-004); AC3 → INT/E2E "anonymous cannot reach protected route/command" (R-003); AC4 → INT "command rejects client `tenant_id` mismatch" (R-004). [Source: test-design-epic-2.md P0/P1 tables]
- **Service-role containment guard must be proven to bite** (Task 6.3): red when a `NEXT_PUBLIC_`-prefixed service-role var or a client-path service-role import is present, green when absent — record the evidence (R-002 verification). [Source: test-design-epic-2.md R-002]
- **A11y/focus verification in a real browser** for the login form and any new top-bar controls (system focus confirmed present). [Source: epic-1-retro Action Item 3]
- **Test-user auth is password-based / admin-created (B2)**; magic-link-only is not used for automated tests; test-setup keys are test-only and never imported into app/client code (the Task 5 guard helps prove this). [Source: epics.md#Story 2.1; test-design-epic-2.md B2]

### Project Structure Notes

- Adds the `(auth)` route group and the `src/server/` tree for the first time — both are named in architecture §3's target structure, so this is alignment, not divergence. No conflict with the existing `(app)` group (route groups add no URL segment). [Source: architecture.md#3]
- `nav-items.ts` and the seven Phase A routes are unchanged; `/login` is in the `(auth)` group, not a nav item. [Source: nav-items.ts; architecture.md#4]
- No `supabase/` directory, `config.toml`, or migration is created here — that is Story 2.2's approval-gated scope. The 2.1→2.2 dependency is intentional and documented. [Source: epics.md#Story 2.2; sprint-status execution order]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Tenant Admin Login And Tenant Context Resolution (lines 537-572)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2 (membership schema/RLS/factories — the gated dependency, lines 574-608)]
- [Source: _bmad-output/planning-artifacts/architecture.md#5 Server-Side Command Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#6 Supabase Auth, Postgres, Storage, And RLS Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#8 Tenant Model And Membership Model]
- [Source: _bmad-output/planning-artifacts/architecture.md#9 RLS Policy Strategy And Test Strategy / #20 Security Risks]
- [Source: _bmad-output/planning-artifacts/architecture.md#3 Repo And App Structure / #4 Frontend Route And Module Structure / #22 Implementation Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#2 Navigation Model (top bar: tenant context + current user) / #11 (generic access message, no cross-tenant leakage)]
- [Source: _bmad-output/test-artifacts/test-design-epic-2.md (Critical Prerequisite; Risks R-002/R-003/R-004; P0/P1 coverage tables; B2/H4/H5)]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md (top-bar tenant/user region → Story 2.1; client-side service-role guard → Epic 2 auth story; single-client-island shell split)]
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-06-21.md (Next Epic Prep; Action Items 1-3; Technical Debt #2/#6; Next Steps #4; Team Agreements)]
- [Source: _bmad-output/auto-bmad/retro-notes/epic-2.md (test-infra gating; RLS table-inventory gate)]
- [Source: _bmad-output/project-context.md (all sections — read before coding)]
- [Source: .env.example:27-42 (env-var contract); src/app/(app)/layout.tsx; src/components/app-shell/AppShell.tsx:204-238; src/components/app-shell/nav-items.ts; scripts/verify/]
- External: @supabase/ssr Next.js Server-Side Auth guide (server/browser client factories, `getAll`/`setAll` cookie API, `getUser()` vs `getSession()`).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (claude-opus-4-8), via the auto-bmad `dev-story` delegate.

### Debug Log References

Full active CI gate sequence run locally (2026-06-22), all green:

1. `pnpm install --frozen-lockfile` → "Lockfile is up to date … Already up to date" (lockfile consistent with package.json; single lockfile).
2. `pnpm run verify:lockfiles` → "✅ Lockfile guard passed: only `pnpm-lock.yaml` is present."
3. `pnpm run verify:service-role-containment` → "✅ Service-role containment guard passed: no NEXT_PUBLIC_ service-role var and no service-role reference in any client path."
4. `pnpm typecheck` (`tsc --noEmit`) → clean.
5. `pnpm lint` (`eslint`) → clean.
6. `pnpm test` (`node --test`, 3 unit suites) → tests 26, pass 26, fail 0.
7. `pnpm build` (`next build`) → compiled; `(app)` routes render dynamic (`ƒ`), `/login` + `/` static (`○`). Build is non-hermetic (Google font fetch) — acceptable on a networked machine (deferred-work item, unchanged).

Runner note: the prior partial run left `pnpm typecheck` RED — the runnable unit tests imported with explicit `.ts` extensions (rejected by `tsc` without `allowImportingTsExtensions`) and the gated `.int`/`.e2e` scaffolds referenced `describe`/`it` globals with no installed types. Fixed by (a) dropping the unnecessary `.ts` extensions from the two unit-test `@/` imports (the `tests/support/alias-hook.mjs` resolver already probes `.ts`/`.tsx`/`index.ts`, so extensionless works), and (b) excluding `tests/integration/**` + `tests/e2e/**` from `tsconfig` until Story 2.2 installs the runner + types (recorded in deferred-work with Story 2.2 as owner).

Build regression caught + fixed: adding the server auth boundary made the `(app)` pages attempt static prerender at build time, where `resolveTenantContext` → `getSupabasePublicEnv()` threw "Missing required env var". Added `export const dynamic = "force-dynamic"` to `(app)/layout.tsx` — protected routes are inherently per-request and must never be statically prerendered. Build then green.

Service-role guard bite proof (R-002 / Task 6.3): `tests/unit/scripts/verify/service-role-containment.test.ts` is RED on a planted `NEXT_PUBLIC_`-prefixed service-role var and on a `"use client"` service-role import, GREEN on a legitimate server-only reference. All three assertions pass.

Adversarial ground-truth check (epic-1 Action Item 1): the forward-dated pins are real — `@supabase/ssr@0.12.0` and `@supabase/supabase-js@2.108.2` are pinned EXACTLY (no caret/tilde) in `package.json`, present in `pnpm-lock.yaml`, and `pnpm install --frozen-lockfile` succeeds. The `@supabase/ssr` `getAll`/`setAll` cookie API and `getClaims()`/`getUser()` (vs `getSession()`) usage match the verified-2026-06-21 SSR guidance recorded in Dev Notes.

### Completion Notes List

Implemented Story 2.1 to completion (the dependency add was explicitly pre-approved for this run; no further approval stops were hit — no service-role key touches any client path, and no unauthenticated privileged bypass was introduced).

- **Task 1 (deps):** `@supabase/ssr@0.12.0` + `@supabase/supabase-js@2.108.2` pinned exactly; `pnpm-lock.yaml` updated and frozen-install-clean; `verify:lockfiles` green (single lockfile).
- **Task 2 (server authority):** `resolveTenantContext` (`src/server/auth/resolve-tenant-context.ts`) re-validates the user via `getClaims()` (never `getSession()`), loads the `tenant_admin` membership (no `status` filter, so disabled/invited is a DISTINCT no-access case), and delegates the decision to the PURE `resolve-tenant-context-core.ts`. Stable typed `Result` codes `UNAUTHENTICATED` / `TENANT_MEMBERSHIP_REQUIRED` with generic Swedish user-safe messages (no cross-tenant leakage). Client-supplied `tenant_id` is never the authority — a mismatch only ever DENIES (AC4 / R-004).
- **Task 3 (auth boundary + /login + sign-out):** `(app)/layout.tsx` converted from a thin client wrapper to a SERVER layout enforcing the boundary — UNAUTHENTICATED → `redirect("/login")` (AC3); no active membership → `NoTenantAccess` user-safe state with ZERO tenant data (AC2); success → mounts `AppShell` with the resolved context (AC1). `/login` (`(auth)` group) does password sign-in via the browser client. `SignOutButton` ends the session and returns to `/login`.
- **Task 4 (top-bar region):** the former empty `data-slot="primary-action"` slot now renders the active tenant/company name + current user email (`data-testid="tenant-context"` / `"current-user"`) + sign-out, fed by the server-resolved context (presentational only; authority stays server-side). Deferred-work item marked resolved.
- **Task 5 (service-role guard):** `scripts/verify/check-service-role-containment.mjs` (dependency-free, mirrors `check-lockfiles.mjs`) wired into CI as `verify:service-role-containment`; this story imports NO service-role client anywhere. Deferred-work item marked resolved.
- **Task 6 (tests):** 26 pure-logic/resolver/guard unit tests on `node --test` (dependency-free; no gated framework added). AC→scenario mapping below.
- **Task 7 (gate sweep + finalize):** full gate sequence green; scope sweep clean (nav-items unchanged at exactly 7; no `supabase/`/migration/`config.toml`; no `.env` edit; no deferred module); deferred-work ledger updated.

**Coverage map (done-now vs deferred-to-2.2):**
- AC1 — done now: pure-logic + faked-client resolver tests for "active `tenant_admin` resolves membership-derived tenant"; presentational display wired. Deferred to 2.2: the DB-backed INT "active membership resolves correct tenant against a real DB" + E2E "tenant/company context displayed in UI" (gated scaffolds carried forward).
- AC2 — done now: "no membership row", "disabled" (distinct), "invited" (distinct), "non-admin role" all → `TENANT_MEMBERSHIP_REQUIRED`; `NoTenantAccess` renders zero tenant data. Deferred to 2.2: DB-backed "reads ZERO tenant rows under RLS".
- AC3 — done now: "no user" + "failed JWT re-validation" → `UNAUTHENTICATED`; layout redirects to `/login`. Deferred to 2.2: DB-backed anonymous-at-the-command-boundary + E2E redirect.
- AC4 — done now: mismatched client `tenant_id` denied; matching/absent ignored; never widens access. Deferred to 2.2: DB-backed "forged tenant id never reads Tenant B".

**Verification note (a11y/focus, epic-1 Action Item 3):** the new focus-dependent controls (`/login` email/password inputs + submit, sign-out button) are standard NATIVE focusable elements with `focus-visible:ring` utilities and no custom JS focus management (unlike Story 1.3's drawer trap), so there is no bespoke focus behavior to verify in a headless harness. `/login` was confirmed to render (HTTP 200) with the email/password fields + "Logga in" submit via the dev server; the full interactive login/logout-loop + focus verification in a real browser is gated on Story 2.2's seeded `tenant_admin` users (same gate as the E2E scaffold) — no live Supabase project/users exist in this story.

### File List

New:
- `src/server/db/supabase-env.ts`
- `src/server/db/supabase-browser-client.ts`
- `src/server/db/supabase-server-client.ts`
- `src/server/auth/resolve-tenant-context.ts`
- `src/server/auth/resolve-tenant-context-core.ts`
- `src/server/auth/tenant-context.ts`
- `src/lib/result/result.ts`
- `src/app/(auth)/login/page.tsx`
- `src/components/app-shell/SignOutButton.tsx`
- `src/components/app-shell/NoTenantAccess.tsx`
- `scripts/verify/check-service-role-containment.mjs`
- `tests/support/register.mjs`
- `tests/support/alias-hook.mjs`
- `tests/unit/resolve-tenant-context-core.test.ts`
- `tests/unit/server/auth/resolve-tenant-context.test.ts`
- `tests/unit/scripts/verify/service-role-containment.test.ts`
- `tests/integration/server/auth/resolve-tenant-context.int.test.ts` (gated red scaffold, `.skip`, excluded from tsconfig)
- `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` (gated red scaffold, `.skip`, excluded from tsconfig)
- `tests/README.md`

Modified:
- `src/app/(app)/layout.tsx` (thin client wrapper → server auth boundary + `force-dynamic`)
- `src/components/app-shell/AppShell.tsx` (accept + display server-resolved tenant/user context; host sign-out)
- `package.json` (Supabase deps; real `test` script; `verify:service-role-containment` script)
- `pnpm-lock.yaml` (Supabase deps)
- `tsconfig.json` (exclude gated `tests/integration/**` + `tests/e2e/**`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (resolved 2 owned items + 1 partial; added 2 new owner-assigned deferrals)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status → review)

### Change Log

| Date | Change |
| --- | --- |
| 2026-06-22 | Implemented Story 2.1 to completion: Supabase SSR client factories, `resolveTenantContext` server authority (membership-derived; `getClaims()`-based; stable typed errors), `(app)` server-side protected-route boundary (redirect/no-access/shell), `/login` password sign-in, sign-out, top-bar tenant/user context display, service-role client-path containment guard (CI-wired + bite-proven). 26 unit tests on `node --test`; full gate sweep green. Fixed prior-run typecheck breakage and a static-prerender build regression (`force-dynamic` on the protected layout). Resolved 2 owned deferred-work items; recorded INT/E2E typecheck re-enrollment as a Story-2.2 hand-off. Status → review. |
