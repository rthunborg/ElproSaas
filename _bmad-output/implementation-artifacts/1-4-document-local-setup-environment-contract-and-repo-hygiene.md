# Story 1.4: Document Local Setup, Environment Contract, And Repo Hygiene

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an implementation lead,
I want local setup and environment expectations documented without secrets,
so that agents and developers can run the pilot consistently and safely.

## Acceptance Criteria

1. **Given** a fresh developer machine, **when** the developer follows the README / local setup docs, **then** install, dev, typecheck, lint, unit test, build, and future Supabase local commands are discoverable, **and** Docker/Supabase instructions follow the repository's Windows/WSL/Docker conventions (architecture §3: project-local Compose only if needed, no fixed `container_name`, no global Docker/daemon changes, no DB data bind mounts to Windows paths, configurable localhost ports, `.env` out of git).
2. **Given** environment configuration is needed, **when** `.env.example` is created, **then** it contains only placeholder values and documented variable names, **and** `.env` is gitignored (verify the existing `.gitignore` rule keeps `.env`/`.env.*` ignored while whitelisting `.env.example`).
3. **Given** the Lovable oracle policy, **when** docs describe reuse, **then** they state that Lovable is a behavioral oracle only and code is not copied by default.

## Tasks / Subtasks

- [x] Task 1: Rewrite the README so setup is discoverable and pnpm-only (AC: 1, 3)
  - [x] 1.1 Replace the verbatim create-next-app README wholesale. It currently instructs `npm/yarn/bun dev` (contradicts the pnpm-only contract and Story 1.1's Stop Condition) and references `app/page.tsx` while the scaffold uses `src/app/page.tsx`. This is the open deferred-work item explicitly owned by this story. [Source: deferred-work.md — code review of story-1.1; README.md:1-36]
  - [x] 1.2 Document the **exact** scripts that exist in `package.json` (do NOT invent commands): `pnpm install --frozen-lockfile` (reproducible install), `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (note it is the honest "no suite yet" placeholder — see Dev Notes), `pnpm build`, `pnpm start`, `pnpm run verify:lockfiles`. Present them in the CI gate order so README and CI agree: install → `verify:lockfiles` → typecheck → lint → test → build. [Source: package.json:9-17; docs/quality/ci.md]
  - [x] 1.3 State the toolchain prerequisites a fresh machine needs: Node per `.nvmrc` (`22`) / `engines.node >=20.9.0`, and pnpm via Corepack (`corepack enable`) so the version is taken from `packageManager: pnpm@10.24.0` — do NOT instruct a global `npm i -g pnpm` that could drift from the pinned version. [Source: package.json:5-7; 1-1 / 1-2 toolchain intelligence]
  - [x] 1.4 Add a short, honest "Local Supabase (not yet wired)" section: state that Supabase local commands (`supabase start`, `supabase db reset`, etc.) and the `supabase/` directory do **not exist yet** and are introduced by Epic 2 (Story 2.2 brings the first migrations + local reset), so they are documented as **forthcoming/discoverable**, not as runnable-today steps. Point to `docs/quality/ci.md` for the local-Supabase-only test rule. Do NOT scaffold a `supabase/` dir, `config.toml`, or any migration here (that is an approval-gated migration story). [Source: architecture.md#3, #6, #18; ci.md; sprint-status execution order]
  - [x] 1.5 Include the Lovable oracle one-liner (or link to the dedicated section from Task 3) so AC3 is satisfied from the README too: Lovable is a behavioral oracle only; code is not copied by default.
- [x] Task 2: Create `.env.example` with placeholder-only, documented variable names (AC: 2)
  - [x] 2.1 Create `/.env.example` at repo root (architecture §3 names it in the target tree; it does NOT exist yet despite `.gitignore` already whitelisting it). Populate it with the Phase A Supabase variable **names** only, each with a short comment and a clearly-fake placeholder value. Recommended minimal set (names are the documented contract; confirm against any Supabase SSR usage when Epic 2 lands): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public/browser-safe), and a server-only `SUPABASE_SERVICE_ROLE_KEY` documented as **server-only — never imported into browser/client paths**. Optionally include an env-configurable signed-URL TTL placeholder (architecture §6 says TTL is env-configurable). [Source: architecture.md#6, #18; security-guardrails.md:5]
  - [x] 2.2 Use only obvious placeholder values (e.g. `https://YOUR-PROJECT.supabase.co`, `your-anon-key-here`, `your-service-role-key-here`). NO real project refs, NO real keys, NO real URLs. The file must contain zero secrets. [Source: NFR18; security-guardrails.md:8; AGENTS.md]
  - [x] 2.3 Add a header comment in `.env.example` stating: copy to `.env.local` (Next.js) / `.env` for local use, `.env*` is gitignored, the service-role key is server-only and must never reach client bundles, and these are placeholders to be filled from your own dev Supabase project.
  - [x] 2.4 Verify the `.gitignore` contract: `.env` and `.env.*` are ignored, `!.env.example` is whitelisted (already present at `.gitignore:10-12`). Do NOT edit a real `.env` (none exists; creating one is out of scope and approval-gated). [Source: .gitignore:10-12; AC2; Stop Condition]
- [x] Task 3: Document the local setup + environment contract + Lovable oracle policy in docs (AC: 1, 3)
  - [x] 3.1 Author a concise local-setup / environment-contract doc (e.g. `docs/process/local-setup.md`) OR fold this into the rewritten README — pick one home and cross-link; do NOT duplicate the same content in two places. Cover: prerequisites (Node/.nvmrc, Corepack/pnpm), the script/gate sequence, the env-var contract (mirroring `.env.example` with the server-only service-role warning), the forthcoming local-Supabase workflow, and the Windows/WSL/Docker conventions verbatim-in-spirit from architecture §3. [Source: architecture.md#3; ci.md]
  - [x] 3.2 State the Windows/WSL/Docker conventions explicitly (the host is Windows 11 + PowerShell): project-local Compose files only if ever needed, no fixed `container_name`, **no global Docker Desktop / daemon / WSL / system-level changes**, no DB data bind mounts to Windows paths, configurable localhost ports, `.env` kept out of git. Frame Docker/Supabase as forthcoming (Epic 2) — do not instruct any global install. [Source: architecture.md#3:225; Stop Condition / Technical Note]
  - [x] 3.3 Document the Lovable oracle policy: Lovable is a behavioral oracle and fixture source only; no code is copied by default; allowed = inspect behavior, extract anonymized fixtures, compare outputs, cite candidate functions for tested reuse; not allowed = copy coupled code, import generated architecture, port service-role/auth patterns. Link to the canonical sources rather than restating them at length. [Source: AGENTS.md; project-context.md#Lovable Oracle Policy; docs/process/agent-workflow.md#Lovable Oracle Workflow; AR26/NFR32]
  - [x] 3.4 Document the old-app fallback / oracle posture at the setup level (AC migration note): state that the old Lovable app remains the behavioral oracle/fallback reference, but this story captures **no fixtures** and stands up **no migration assets** (those are Epic 9). [Source: epics.md#Story 1.4 Migration/Coexistence Impact]
- [x] Task 4: Repo hygiene — remove inherited scaffold cruft assigned to this story (AC: 1)
  - [x] 4.1 Remove the create-next-app dark-mode leftover in `src/app/globals.css`: the `@media (prefers-color-scheme: dark)` block plus the `--background`/`--foreground` light/dark vars are inconsistent with the hardcoded-light shell (`bg-zinc-50`/`bg-white`/`text-zinc-900`) that Story 1.3 shipped. This is the same class of scaffold cruft as the Arial override (already removed in 1.3) and is explicitly assigned to "Story 1.4 repo hygiene." Verify nothing in `src/` depends on those vars before deleting; if `globals.css` still references `var(--background)`/`var(--foreground)` in the `body`/base layer, reconcile so the file is internally consistent (light shell). [Source: deferred-work.md — code review of story-1.3 (2026-06-16); src/app/globals.css:15-20, 22-25]
  - [x] 4.2 Repo-hygiene sweep (read-only audit; act only within this story's scope): confirm no stray lockfiles (only `pnpm-lock.yaml`), no committed `.env`, no leftover unreferenced create-next-app assets beyond what 1.3 deleted. Do NOT expand into unrelated refactors. [Source: AC2; 1-1 lockfile guard]
- [x] Task 5: Verify (docs/config-only; AC: 1, 2, 3)
  - [x] 5.1 Lightweight docs review: re-read the rewritten README / setup doc and follow it mentally as a fresh developer — every command named must exist in `package.json`; every env var named must appear in `.env.example`; no command references a tool/dir that does not exist yet without labeling it "forthcoming." [Source: epics.md#Story 1.4 Test Requirements]
  - [x] 5.2 Repo check that `.env` is ignored and no obvious secrets are committed: confirm `git check-ignore .env` reports it ignored, confirm `git status` does not surface any `.env`/`.env.local`, and scan the new/changed files (README, `.env.example`, setup doc) for accidental real keys/URLs/PII. [Source: epics.md#Story 1.4 Test Requirements; NFR18]
  - [x] 5.3 Because the globals.css edit touches product code, run the active gate sequence to prove no regression: `pnpm install --frozen-lockfile` → `pnpm run verify:lockfiles` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (placeholder) → `pnpm build`. Confirm green and record results in the Dev Agent Record. (If this story ends up touching only docs + `.env.example` + `globals.css`, the build gate still applies because of the CSS change.) [Source: docs/quality/ci.md; quality-gates.md Gate 2]
  - [x] 5.4 Scope guardrail sweep: confirm no new dependency (`git diff package.json pnpm-lock.yaml` empty), no real `.env` created/edited, no `supabase/` dir / migration / config scaffolded, no global Docker/WSL/system change, no deferred-module content introduced in docs. [Source: epics.md#Story 1.4 Stop Conditions; AR28]

## Dev Notes

### Critical Constraints (read first)

- **Docs/config-only story (plus one tiny CSS hygiene edit).** This story produces documentation (`README.md`, a setup doc) and one config artifact (`.env.example`), and removes scaffold cruft from `globals.css`. It writes no business logic, no schema, no Supabase scaffolding. Per the quality gates, docs/config-only PRs may run lighter checks but must explicitly state which product gates were skipped — however, the `globals.css` change is product code, so run the full active gate set (Task 5.3) and do not claim a skip. [Source: architecture.md#19; docs/quality/ci.md; quality-gates.md Gate 2]
- **Never edit a real `.env`; never commit secrets.** `.env.example` holds placeholder-only values. No real Supabase project ref, key, URL, or any PII. `.env`/`.env.*` stay gitignored (whitelist `.env.example`). [Source: security-guardrails.md:5-8; NFR18; AGENTS.md; CLAUDE.md permissions.deny on `.env*`]
- **No new dependencies (AR28).** Documentation and a `.env.example` need none. Do not add a markdown linter, dotenv tooling, or anything else. [Source: AR28; 1-1/1-2/1-3 precedent]
- **No global Docker / WSL / daemon / system changes.** The Technical Note forbids it. Docker/Supabase are documented as *forthcoming* (Epic 2), with the repo conventions stated, but nothing is installed or scaffolded. The dev host is Windows 11 + PowerShell. [Source: epics.md#Story 1.4 Technical Notes; architecture.md#3:225]
- **Do not pull Epic 2+ forward.** No `supabase/` directory, `config.toml`, migrations, auth wiring, or env *consumption* code. `.env.example` documents the *contract*; the code that reads those vars lands in Epic 2. The README/setup doc must label Supabase-local steps "forthcoming," not "run this now." [Source: sprint-status execution order; architecture.md#6, #18]
- **Stop Conditions (this story).** STOP and request human approval if: real secrets are needed, global Docker/system changes are requested, or setup would require a new dependency outside the approved platform story. [Source: epics.md#Story 1.4]

### Deferred-work items this story OWNS or must consider

Folded from `_bmad-output/implementation-artifacts/deferred-work.md` (only the entries that overlap this story — the rest of the ledger is out of scope and must NOT be reopened):

- **OWNED — README is the verbatim create-next-app placeholder** (instructs `npm/yarn/bun dev`, references `app/page.tsx`). The ledger names **Story 1.4** as owner ("rewrites the README wholesale"). Resolve in Task 1 and mark this ledger item resolved with a dated note. [deferred-work.md — code review of story-1.1; README.md:7-19]
- **OWNED — create-next-app dark-mode leftover in `globals.css`** (`@media (prefers-color-scheme: dark)` + `--background`/`--foreground` light/dark vars), inconsistent with the hardcoded-light shell. The ledger lists "Owner: Story 1.4 repo hygiene or a future theming story." Take it in Task 4.1 (it is small and squarely "repo hygiene") and mark the ledger item resolved with a dated note. If the dev judges it a larger theming decision, that is a Stop-Condition-style flag for the owner — but the default is to remove the cruft now. [deferred-work.md — code review of story-1.3 (2026-06-16); src/app/globals.css:15-20, 22-25]
- **NOT this story (leave deferred) — non-hermetic `next/font/google` fetch in `pnpm build`.** The ledger explicitly keeps this deferred to a future CI-hardening/font story (making it hermetic means switching to self-hosted `next/font/local`), NOT Story 1.4. Do not touch fonts. Note in the README that `pnpm build` fetches a Google font over the network (so a fresh dev on a restricted network knows what to expect), but do not attempt to fix it. [deferred-work.md — code review of 1-2 (2026-06-15); story-1.3 Decision Note 2]
- **NOT this story (Epic 2) — Arial override (already RESOLVED by 1.3), single-client-island shell, drawer-link focus, top-bar tenant/user region.** All resolved or assigned to Epic 2 / route-transition work. Do not reopen. [deferred-work.md entries dated 2026-06-15/16]

### What already exists (do not recreate, reuse/verify)

- **`package.json` scripts** (the source of truth for README commands): `dev`, `build`, `start`, `lint`, `typecheck`, `test` (placeholder), `verify:lockfiles`. `packageManager: pnpm@10.24.0`, `engines.node >=20.9.0`, `.nvmrc = 22`. [Source: package.json]
- **`docs/quality/ci.md`** already documents the five active gates, the deferred gates mapped to their stories, the local-Supabase-only rule, and the seed.sql-minimal rule. The README/setup doc should LINK to it, not restate it. [Source: docs/quality/ci.md — created by Story 1.2]
- **`.gitignore`** already ignores `.env`/`.env.*` and whitelists `!.env.example` (`.gitignore:10-12`), and ignores build artifacts / private fixture dirs. Verify, do not rewrite. [Source: .gitignore]
- **Canonical Lovable-oracle policy text** lives in `AGENTS.md`, `_bmad-output/project-context.md` (#Lovable Oracle Policy), and `docs/process/agent-workflow.md` (#Lovable Oracle Workflow). Link/summarize; do not fork a divergent version. [Source: those files]
- **`.env.example` does NOT exist yet** — architecture §3 lists it in the target tree but no platform story created it. This story creates it. [Source: architecture.md#3:149; repo audit]

### Environment-variable contract (for `.env.example`)

Phase A is Supabase Auth + Postgres + Storage (architecture §6). The browser-safe vars use the `NEXT_PUBLIC_` prefix (Next.js exposes only those to the client); the service-role key is server-only and must never be `NEXT_PUBLIC_` and never imported into client/browser code (architecture §1/§6, security-guardrails.md, NFR4). Document at minimum:

- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase project URL (browser-safe).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key (browser-safe; RLS still enforces tenancy).
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, RLS-bypassing; never exposed to the browser, never `NEXT_PUBLIC_`. Comment it loudly.
- (Optional) a signed-URL TTL var (architecture §6: TTL is env-configurable; low TTL in test envs) — include only if you keep it clearly forthcoming; do not invent unused vars beyond the documented contract.

These names are the **documented contract**; the code that consumes them lands in Epic 2 (Story 2.1 auth / tenant context, supabase-js / @supabase/ssr). If Epic 2's chosen client library prefers slightly different names, that story updates `.env.example` — for now, use the conventional Supabase + Next.js names above. [Source: architecture.md#6, #18; security-guardrails.md:5; project-context.md#Architecture Rules]

### Architecture Compliance

- **Repo tree (architecture §3):** `README.md` and `.env.example` are root-level files in the target tree. The setup doc (if separate) belongs under `docs/` (`docs/process/` is the established home for process docs alongside `agent-workflow.md`, `branching-and-pr-policy.md`). [Source: architecture.md#3; docs/process/ listing]
- **Windows/WSL/Docker conventions (architecture §3:225):** project-local Compose only if needed, no fixed `container_name`, no global Docker/daemon changes, no DB data bind mounts to Windows paths, configurable localhost ports, `.env` out of git. Document these as the standing rules for when Supabase-local lands. [Source: architecture.md#3]
- **Test environment (architecture §18 / ci.md):** local Supabase only; never shared dev/staging/prod. The setup doc should point a developer at ci.md for this rather than restating it. [Source: architecture.md#18]
- **CI gate order (architecture §19 / ci.md):** install → verify:lockfiles → typecheck → lint → test → build. README command order should match so docs and CI never drift. [Source: architecture.md#19]

### Previous Story Intelligence (Stories 1.1–1.3 — all done)

- **Toolchain pinned (1.1):** Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, TS 5.9.3, ESLint 9.39.4, Tailwind **v4** (CSS `@theme` in `globals.css`, no `tailwind.config.ts`), `pnpm@10.24.0`, `.nvmrc = 22`, `engines.node >=20.9.0`, `@/*` alias. README must reflect this exactly — no `npm/yarn/bun`. [Source: 1-1, 1-3 Dev Notes]
- **CI plumbing (1.2):** `.github/workflows/ci.yml` runs the five active gates with the `test` placeholder; `docs/quality/ci.md` is the canonical CI/gate doc; PR template already captures phase/scope/story/checks/security/migration/deferred-scope. Reuse and link these. [Source: 1-2]
- **App shell (1.3):** shipped a hardcoded-light shell (`bg-zinc-50`/`bg-white`/`text-zinc-900`), replaced the marketing `page.tsx` with a `/dashboard` redirect, removed the Arial override, deleted unreferenced `public/*.svg`, and **explicitly left the README to Story 1.4** ("Do NOT touch the README — it is owned by Story 1.4"). The dark-mode `globals.css` block was deferred to 1.4 repo hygiene. [Source: 1-3 Dev Notes / File List / Review Findings]
- **`pnpm build` needs network** (Google font) — green on networked runners; mention it in setup so a fresh dev expects the fetch, but do NOT fix it (deferred). [Source: 1-1/1-2/1-3]
- **No test framework yet** — `pnpm test` is the honest "no suite yet" placeholder; the real harness arrives via TEA `testarch-framework` around Epic 2. Document `pnpm test` truthfully (a placeholder), do not imply a runnable suite. [Source: 1-2 Decision Note]
- **Verification discipline (1.2/1.3 reviews):** no false-greens. Any "I followed the README" / gate-green claim in the Dev Agent Record must be actually performed, not asserted. [Source: 1-2/1-3 Review Findings]

### Git Intelligence

Established cadence: conventional commits scoped per story (`feat/docs/chore(story-1.x): …`), one branch per story → PR to `main`, CI green as the merge gate, with a Round-1 code-review hardening pass. Story 1.3 merged via PR. Branch off the current `main` tip into `feature/1.4` (do NOT run git yourself — the orchestrator owns git; this note is for the PR/commit-message convention only). Use a `docs(story-1.4): …` (with a `chore`/`fix` note for the `globals.css` hygiene edit) scope. [Source: 1-1/1-2/1-3 Git Intelligence; recent commit log]

### Testing Standards

- This story's "tests" = (a) lightweight docs review that every documented command/var actually exists (Task 5.1); (b) a repo check that `.env` is ignored and no secrets are committed (Task 5.2); (c) the active gate sequence green because the `globals.css` edit is product code (Task 5.3). No unit/component harness is introduced. [Source: epics.md#Story 1.4 Test Requirements; ci.md]
- Do not point anything at a remote Supabase project (none is touched). [Source: architecture.md#18]

### Project Structure Notes

- **New:** `.env.example` (root); optionally `docs/process/local-setup.md` (if not folding setup into README).
- **Modified:** `README.md` (full rewrite); `src/app/globals.css` (remove dark-mode scaffold cruft); `_bmad-output/implementation-artifacts/deferred-work.md` (mark the README item and the globals.css dark-mode item resolved, dated); `_bmad-output/implementation-artifacts/sprint-status.yaml` (tracking).
- **Do NOT touch:** `package.json`/`pnpm-lock.yaml` (no dep change), `.github/workflows/ci.yml`, `docs/quality/ci.md` (link, don't duplicate), any `src/` beyond the `globals.css` hygiene edit, any deferred-module area; do NOT create `supabase/` or any migration; do NOT create or edit a real `.env`.
- PR must follow `docs/process/branching-and-pr-policy.md`: phase/scope statement (Phase A, docs/config + one CSS hygiene edit), story link (this file), changed files, checks run (full active gate set — globals.css is product code), security/RLS impact (**reduces secret-handling risk; no RLS** — no tenant data, no secrets committed), data migration impact (**none**), deferred-scope confirmation (no deferred module; Supabase/Docker documented as forthcoming only). Merge gate: CI green. [Source: docs/process/branching-and-pr-policy.md; epics.md#Story 1.4]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — story statement, ACs, technical notes, test requirements, security/migration impact, dependencies (Stories 1.1 & 1.2), stop conditions
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — epic goal, scope (`.env.example`, local setup docs, repo hygiene), explicit non-scope, FR60/FR61
- [Source: _bmad-output/planning-artifacts/architecture.md#3 (Repo And App Structure)] — root-level `README.md`/`.env.example`; Windows/WSL/Docker conventions (line 225)
- [Source: _bmad-output/planning-artifacts/architecture.md#6 (Supabase Auth, Postgres, Storage, RLS)] — env-var contract, public vs server-only keys, env-configurable signed-URL TTL
- [Source: _bmad-output/planning-artifacts/architecture.md#18 (Test Strategy + Test Infrastructure Decisions)] — local-Supabase-only; seed.sql minimal; test-keys-stay-test-only
- [Source: _bmad-output/planning-artifacts/architecture.md#19 (CI And Quality Gates)] — gate order; docs-only lighter checks + skipped-gate statement
- [Source: docs/quality/ci.md] — active/deferred gates, local-Supabase-only rule (link from README; do not duplicate)
- [Source: docs/quality/quality-gates.md#Gate 2] — static quality gate; docs/config-only convention
- [Source: docs/security/security-guardrails.md] — no secrets in committed files; no service-role in client paths; no `.env` edits
- [Source: docs/process/agent-workflow.md#Lovable Oracle Workflow] — oracle allowed/forbidden outputs
- [Source: docs/process/branching-and-pr-policy.md] — PR requirements and merge gates
- [Source: AGENTS.md / _bmad-output/project-context.md#Lovable Oracle Policy] — canonical Lovable-oracle policy (AC3)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — README rewrite (owned by 1.4); globals.css dark-mode cruft (1.4 repo hygiene); non-hermetic font (NOT 1.4, stays deferred)
- [Source: _bmad-output/implementation-artifacts/1-1-choose-package-manager-and-initialize-app-baseline.md] — pinned toolchain, scripts, `.nvmrc`, Corepack/pnpm
- [Source: _bmad-output/implementation-artifacts/1-2-establish-ci-and-quality-gate-baseline.md] — CI gates, `ci.md`, PR template, `test` placeholder, branching/PR flow
- [Source: _bmad-output/implementation-artifacts/1-3-build-phase-a-app-shell-and-deferred-scope-navigation-guardrails.md] — hardcoded-light shell, README left to 1.4, globals.css dark-mode deferred to 1.4
- [Source: package.json] — exact scripts, pinned versions, packageManager/engines
- [Source: .gitignore] — `.env`/`.env.*` ignored, `!.env.example` whitelisted

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8) — BMAD dev-story (auto-bmad delegate)

### Debug Log References

Active gate sequence run locally (2026-06-21), all green:

- `pnpm install --frozen-lockfile` → exit 0 ("Lockfile is up to date", pnpm v10.24.0, the pinned version).
- `pnpm run verify:lockfiles` → exit 0 ("Lockfile guard passed: only `pnpm-lock.yaml` is present.").
- `pnpm typecheck` (`tsc --noEmit`) → exit 0, no type errors.
- `pnpm lint` (`eslint`) → exit 0, clean.
- `pnpm test` (placeholder) → exit 0, prints the honest "no suite yet" message.
- `pnpm build` (`next build`) → exit 0, all 11 routes prerendered; confirms the kept `--font-sans → --font-geist-sans` mapping still loads Geist after the `globals.css` cleanup.

Secret/scope checks:

- `git check-ignore .env` → `.env` (ignored). `.env.local` also ignored; `.env.example` correctly NOT ignored (whitelisted).
- `git status --short` surfaces no `.env`/`.env.local`. `git diff package.json pnpm-lock.yaml` empty (no dependency change).
- No `supabase/` directory exists (correct — not scaffolded).
- Grep of `.env.example`/README/local-setup.md for JWT-/key-/real-URL-shaped strings → no matches. Placeholders only.
- Grep of new docs for deferred-module terms (Fortnox, supplier APIs, AI jobs, rentals, tender/FKU, full RBAC, DoU) → no matches.

### Completion Notes List

- **README rewritten wholesale** (Task 1) — pnpm-only quickstart; tech stack (Next 16 / React 19 / TS 5.9 / Tailwind v4, no `tailwind.config.ts`); prerequisites (Node via `.nvmrc`=22 / `engines >=20.9.0`, pnpm via `corepack enable`, explicitly NOT global `npm i -g pnpm`); the exact `package.json` scripts in CI gate order (install → verify:lockfiles → typecheck → lint → test → build) with `pnpm test` labeled an honest placeholder and `pnpm build`'s Google-font network fetch called out; forthcoming "Local Supabase (not yet wired)" section; env-var pointer; Lovable oracle one-liner (AC3). No `npm/yarn/bun dev`, no `app/page.tsx`.
- **`.env.example` created** (Task 2) — placeholder-only contract: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser-safe), `SUPABASE_SERVICE_ROLE_KEY` (loudly server-only / never `NEXT_PUBLIC_` / never client paths), plus a commented-out optional `SUPABASE_SIGNED_URL_TTL_SECONDS` (architecture §6, forthcoming/Epic 8). Header documents copy-to-`.env.local`, gitignore behavior, and the server-only warning. Zero secrets. `.gitignore` contract verified, not edited.
- **`docs/process/local-setup.md` authored** (Task 3) — chosen as the single canonical home for the full contract; README is the quickstart and cross-links to it (no duplicated content). Covers prerequisites, the gate sequence (links to ci.md for canonical definitions), the env-var contract table with the server-only warning, the forthcoming local-Supabase workflow, the Windows/WSL/Docker conventions (no global Docker/WSL/daemon changes; project-local Compose only; no fixed `container_name`; no DB bind mounts to Windows paths; configurable ports; `.env` out of git), the Lovable oracle policy (links to canonical sources in AGENTS.md / project-context.md / agent-workflow.md), and the old-app fallback / no-fixtures / no-migration-assets (Epic 9) posture.
- **`globals.css` hygiene** (Task 4.1) — removed the `@media (prefers-color-scheme: dark)` block and the `--background`/`--foreground` light/dark vars. Also removed the now-unused `@theme inline` mappings `--color-background`, `--color-foreground`, and `--font-mono` (none referenced anywhere in `src/` — verified by grep for `bg-background`/`text-foreground`/`font-mono`/`var(--background)`/`var(--foreground)`). `body` now hardcodes the light values (`#ffffff` / `#171717`) directly, internally consistent with Story 1.3's hardcoded-light shell. Kept `--font-sans → --font-geist-sans` (load-bearing: the `font-sans` utility on `<body>` in `layout.tsx` relies on it; build confirms Geist still loads).
- **Repo hygiene sweep** (Task 4.2) — only `pnpm-lock.yaml` at root (no stray `yarn.lock`/`package-lock.json`/`bun.lockb`); no committed `.env`; no leftover create-next-app assets beyond what 1.3 removed.
- **Deferred-work ledger updated** — marked the README item and the `globals.css` dark-mode item RESOLVED (2026-06-21, Story 1.4), dated. The non-hermetic `next/font/google` build fetch stays deferred (NOT this story) — only noted in README so a fresh dev expects the fetch.
- **Scope discipline** — docs + one config file + one CSS hygiene edit. No dependency change (`package.json`/lockfile diff empty), no real `.env`, no `supabase/` dir/migration/config, no global Docker/WSL/system change, no deferred-module content. Because `globals.css` is product code, the full active gate set was run (not a docs-only skip).

### File List

- `README.md` (modified — full rewrite)
- `.env.example` (new)
- `docs/process/local-setup.md` (new)
- `src/app/globals.css` (modified — removed dark-mode scaffold cruft + unused theme vars)
- `src/app/layout.tsx` (modified — review fix: dropped the unused `Geist_Mono` import / `geistMono` / `--font-geist-mono` wiring so no unreachable mono font is fetched)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — README + globals.css items marked resolved, dated)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — story 1.4 → review)
- `_bmad-output/implementation-artifacts/1-4-document-local-setup-environment-contract-and-repo-hygiene.md` (modified — tasks checked, Dev Agent Record, status)

### Review Findings

Triage of the round-1 code review (2 primary reviewer models × 3 lenses + auto-bmad-local security). Heavy overlap across reviewers was deduplicated; intentional/approved-scope items (the Task 4.1 dark-mode removal, the documented `pnpm test` placeholder, the deferred non-hermetic font fetch) and stale-knowledge false positives (e.g. "Next.js 16 / TS 5.9 don't exist" — they are the pinned versions from Story 1.1) were dismissed. Security review found no exploitable vulnerabilities.

**Round-1 resolution (2026-06-21, Story 1.4):** Took the repo-hygiene direction — dropped the unused `Geist_Mono` import and its `geistMono` / `--font-geist-mono` wiring from `src/app/layout.tsx` so the unreachable mono font is no longer fetched over the network. Verified `Geist_Mono` / `font-mono` / `--font-geist-mono` were referenced nowhere except `layout.tsx` itself (grep of `src/`), so removal — not re-adding the `--font-mono` `@theme` mapping — is correct and keeps the cleanup's intent. `--font-sans → --font-geist-sans` (Geist sans) left intact. Active gates re-run green: `verify:lockfiles`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (11 routes prerendered, no font-fetch error).

- [x] [Review][Patch][High] `--font-mono` `@theme` mapping removed while `layout.tsx` still loads `Geist_Mono` — the `@theme inline` block dropped `--font-mono: var(--font-geist-mono)`, but `src/app/layout.tsx` still imports `Geist_Mono`, sets `variable: "--font-geist-mono"`, and injects `geistMono.variable` onto `<html>`. The mono font is therefore fetched over the network but is no longer reachable via Tailwind's `font-mono` utility (any future `font-mono` use silently falls back to the system mono stack). Pre-existing scaffold residue that this cleanup exposed; build is green and there is no current functional regression, but the asymmetry is a real defect. Unambiguous fix: either drop the unused `Geist_Mono` import from `layout.tsx`, OR re-add `--font-mono: var(--font-geist-mono)` to the `@theme inline` block (mirroring the kept `--font-sans` mapping). [src/app/globals.css:hunk @theme inline; src/app/layout.tsx:10-13,28] (merged: blind@primary+auditor@primary+blind@secondary+edge@secondary+auditor@secondary)

**Round-2 triage (2026-06-21, Story 1.4) — second-opinion pass.** 2 reviewer models × 3 lenses + auto-bmad-local security. Edge-primary returned an empty array (the iteration-1 `--font-mono` asymmetry is now fixed — confirmed in diff). Re-flagged-but-dismissed: the Task-4.1 dark-mode/`@theme` token removal (verified-unreferenced in `src/`, security-cleared, both auditors confirm no residual references) and the "Next.js 16 / TS 5.9 don't exist" claim (stale-knowledge false positive vs `package.json`'s pinned `next@16.2.9`/`typescript@5.9.3`). Also dismissed: `.gitignore` whitelist "may be missing" (lines 10-12 verified present, not edited), README `/dashboard` redirect + `src/app/(app)/dashboard/page.tsx` path "unverifiable" (path exists — Story 1.3 target), "broken doc links" (every target verified to resolve), placeholder-URL resolvability and placeholder-validation guards (no code reads these vars until Epic 2), the `cp .env.example` placeholder-URL DNS concern, README/local-setup duplication (intentional quickstart vs canonical split), `lang="sv"` vs English dev-docs (app is Swedish-facing; docs target developers), Node `22` pin vs `engines >=20.9.0` floor (intentional, both stated transparently), "fixture source only" wording (spec Task 3.3/3.4 explicitly authorizes it), bare `architecture.md §` references (planning-artifact, section-cited by design), and the `deferred-work.md`/`sprint-status.yaml` "not in diff" tracking note (both already updated in the live tree; git is the orchestrator's). Security review: no exploitable vulnerabilities.

**Round-2 resolution (2026-06-21, Story 1.4).** Resolved the two `[Patch][Low]` items and the one `[Decision][Low]` item (human-chosen direction: sole developer wants the smoothest day-to-day flow). (1) Changed the README "Getting started" default install to plain `pnpm install`, and kept `pnpm install --frozen-lockfile` documented as the reproducible / CI / fresh-clone variant (in both the prose and the gate table); mirrored the "use plain `pnpm install` day to day" note into `docs/process/local-setup.md` so README and the setup doc stay consistent. (2) Reworded "scripts defined in `package.json`" → "commands CI runs" in both docs and explicitly called out that the first row is a pnpm CLI command, not a `package.json` script, listing the actual scripts. (3) Added the PowerShell `Copy-Item .env.example .env.local` form alongside the `cp` form in both docs and dropped the inaccurate "shell-agnostic" claim in `local-setup.md` (pnpm commands are cross-shell; native file commands now show both forms). The three remaining `[Defer][Low]` items are left deferred as triaged (no owner action this story). Active gates re-run green (`verify:lockfiles`, `typecheck`, `lint`, `build`); `pnpm test` placeholder green. No product code touched this round — docs only.

- [x] [Review][Decision][Low] `pnpm install --frozen-lockfile` is presented as the default "Getting started" install command in `README.md` — `--frozen-lockfile` is a CI-reproducibility flag that fails whenever a developer legitimately adds/updates a dependency during feature work, which can confuse a contributor who then can't understand why `pnpm install` "fails". The README labels it "Reproducible install (fails if the lockfile is stale — same as CI)", so the intent is documented, but it conflates the CI invocation with the day-to-day local-dev install. Recommended: defer — the labeling is honest and matching CI on a fresh clone is the desired default for the pilot; if it bites contributors, add a one-line "use plain `pnpm install` when changing dependencies" note rather than changing the documented default now. [README.md:99-106] (merged: blind@secondary)
- [x] [Review][Patch][Low] Docs mislabel `pnpm install --frozen-lockfile` as a `package.json` script — both `README.md` ("These are the **only** scripts defined in `package.json`") and `docs/process/local-setup.md` ("These are the only scripts in `package.json`, listed in the order CI runs them") introduce a list/table whose first entry is `pnpm install --frozen-lockfile`, which is a pnpm CLI invocation, not a `package.json` script (the actual scripts are `dev/build/start/lint/typecheck/test/verify:lockfiles`). A literal reader could attempt `pnpm run install` and get an error. Unambiguous fix: reword "scripts defined in `package.json`" to "commands" (or split install out as a CLI step distinct from the script table) in both docs. [README.md:116-128; docs/process/local-setup.md:225-243] (merged: auditor@secondary HIGH-1+MED-1)
- [x] [Review][Patch][Low] `cp .env.example .env.local` is documented (and called "shell-agnostic") on a project whose dev host of record is Windows 11 + PowerShell, where `cp` is not a native command (`Copy-Item` is the equivalent) — a developer following the instructions verbatim in PowerShell gets a "command not found" error on the stated primary host. Appears in both `README.md` and `docs/process/local-setup.md`. Unambiguous fix: add the PowerShell `Copy-Item .env.example .env.local` equivalent (or drop the "shell-agnostic" claim) in both files. [README.md:155-157; docs/process/local-setup.md:221,251-253] (merged: blind@secondary+edge@primary+edge@secondary)
- [ ] [Review][Defer][Low] Evergreen docs hardcode plan-specific epic/story numbers that risk going stale — `.env.example` and `local-setup.md` attribute the signed-URL TTL var to "Epic 8" (the spec sources it only to architecture §6, with no epic assignment), and `local-setup.md` attributes test-only factories to "Story 2.2" (the spec ties first migrations to 2.2 but not the factory work). The vars/behavior are correctly marked optional/forthcoming; only the specific number attributions are dev-introduced and unverified, so if the plan shifts the comments become stale. Pre-existing class of risk (the docs name Epic 2 / Story 2.1 / 2.2 throughout). Defer to a docs-maintenance pass; no AC or current behavior affected. [.env.example:47; docs/process/local-setup.md:264,293] (merged: auditor@primary Low×2+blind@primary)
- [ ] [Review][Defer][Low] Security guardrails for the env contract are prose-only with no automated enforcement — the "never prefix service-role with `NEXT_PUBLIC_`", "never import into client paths", "document any service-role use with file/purpose/test" rules live only in markdown; there is no lint rule, CI check, or test that prevents a future careless `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` or client-side import. Not actionable in this story (nothing reads these vars yet); the enforcement belongs with Epic 2 when env consumption lands. Defer: add a guard (lint/CI) against client-side service-role exposure in the Epic 2 auth/tenant-context story. [.env.example; docs/process/local-setup.md:266-275] (merged: blind@primary+blind@secondary)
- [ ] [Review][Defer][Low] Hardcoded-light `body` has no dark-mode or `forced-colors`/high-contrast support — `globals.css` now hardcodes `#ffffff`/`#171717` on `body` with the `@media (prefers-color-scheme: dark)` block intentionally removed (Task 4.1) and no `@media (forced-colors: active)` fallback. This is the deliberate Phase A hardcoded-light posture (Story 1.3), not a regression introduced by this change, but OS dark-mode and Windows high-contrast users get an unthemed experience. Defer to a future theming / accessibility pass. [src/app/globals.css:11-13] (merged: edge@secondary forced-colors+blind@primary/secondary dark-mode-as-a11y)
