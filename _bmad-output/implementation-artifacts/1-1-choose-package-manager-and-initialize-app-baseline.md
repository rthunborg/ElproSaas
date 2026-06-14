# Story 1.1: Choose Package Manager And Initialize App Baseline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an implementation lead,
I want one reproducible application baseline using a single package manager,
So that every later Phase A story starts from the same install, type, and build assumptions.

## Acceptance Criteria

1. **Given** a fresh checkout, **when** the platform foundation is initialized, **then** the project uses exactly one package manager: `pnpm`, **and** `package.json`, `pnpm-lock.yaml`, TypeScript, ESLint, App Router, Tailwind, and `@/*` imports are configured consistently with the architecture.
2. **Given** the app is initialized, **when** a developer runs documented install and verification commands, **then** clean install, typecheck, lint, and build commands are available and reproducible, **and** no other lockfile or package-manager metadata is committed.
3. **Given** Phase A scope constraints, **when** initial route/app folders are created, **then** no deferred module route, placeholder screen, navigation item, schema, job, or integration stub is added.

## Tasks / Subtasks

- [x] Task 1: Initialize Next.js App Router baseline in the existing repo root (AC: 1)
  - [x] 1.1 Enable pnpm via corepack (`corepack enable pnpm`) — do NOT install pnpm globally or change machine config
  - [x] 1.2 Scaffold Next.js with TypeScript, Tailwind, ESLint, App Router, `@/*` import alias, `src/` directory (create-next-app defaults match the architecture target)
  - [x] 1.3 The repo root is NON-EMPTY (`_bmad/`, `_bmad-output/`, `docs/`, `.github/`, `.agents/`, `.claude/`, `.codex/`, `AGENTS.md`, `.gitignore`). If `create-next-app` refuses the non-empty directory, scaffold in a temp subfolder and move files into the root. NEVER delete, move, or overwrite the existing folders/files; merge `.gitignore` content instead of replacing it
  - [x] 1.4 Confirm resulting config files match the architecture target tree: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, Tailwind config (v4 may use CSS-based config in `globals.css` instead of `tailwind.config.ts` — acceptable; note which in File List)
- [x] Task 2: Pin versions and lock the package-manager choice (AC: 1, 2)
  - [x] 2.1 Pin exact dependency versions in `package.json` (no `^`/`~` ranges) and record them in Dev Agent Record → Completion Notes
  - [x] 2.2 Add `"packageManager": "pnpm@<exact-version>"` to `package.json` and an `engines.node` constraint (Node >= 20.9, prefer an LTS line: 22 or 24)
  - [x] 2.3 Verify only `pnpm-lock.yaml` exists — no `package-lock.json`, `yarn.lock`, or `bun.lockb`
- [x] Task 3: Documented install and verification commands (AC: 2)
  - [x] 3.1 Ensure `package.json` scripts exist: `dev`, `build`, `lint`, and add `typecheck` (`tsc --noEmit`)
  - [x] 3.2 Run and confirm green, in order: `pnpm install` (clean), `pnpm typecheck`, `pnpm lint`, `pnpm build`
  - [x] 3.3 Delete `node_modules` and re-run `pnpm install --frozen-lockfile` to prove reproducibility
- [x] Task 4: Lockfile guard (AC: 2)
  - [x] 4.1 Add a repo check that fails when a non-pnpm lockfile is present (e.g., `scripts/verify/check-lockfiles.mjs` per the architecture `scripts/verify/` location, wired as a `verify:lockfiles` script; Story 1.2 will wire it into CI)
- [x] Task 5: Scope guardrail sweep (AC: 3)
  - [x] 5.1 Confirm `src/app/` contains only the scaffold default (root layout, `globals.css`, default page) — no business routes, no `(auth)`/`(app)`/`api` route groups yet (those belong to Stories 1.3+)
  - [x] 5.2 Confirm zero references to deferred modules anywhere in scaffold output (Fortnox, supplier, AI, HR, rentals, assets, DoU, tender, RBAC, portal)
  - [x] 5.3 Confirm `.gitignore` covers `.env*` (except `.env.example`), `node_modules/`, `.next/`
  - [x] 5.4 Confirm no service-role env variable name appears anywhere in client/app code

## Dev Notes

### Critical Constraints (read first)

- **`pnpm` is the decided package manager (AR2).** STOP and ask for human approval if anything pushes toward npm/yarn/bun, if a new runtime or dependency beyond the create-next-app baseline is needed, or if any deferred-module structure appears (story Stop Conditions).
- **Dependency scope of this story = create-next-app baseline ONLY** (next, react, react-dom, typescript, tailwind + its peer deps, eslint + next config). AR28 requires story approval for dependencies; this story is that approval, limited to exactly this set. No UI kits, no state libs, no Supabase packages (Supabase joins in Epic 2).
- **No network research was performed during story creation** (repo policy gates network commands). Version reference: architecture verified on 2026-06-09 that `create-next-app@latest` defaults match our target (TypeScript, Tailwind, ESLint, App Router, Turbopack, `@/*`), Node minimum 20.9+, React 19.2 current, Node 22/24 LTS. At implementation time, use whatever current stable `create-next-app@latest` installs, then pin those exact versions.
- **No migrations, no `.env` edits, no Lovable code.** `.env.example` and setup docs belong to Story 1.4, CI to Story 1.2, app shell/navigation to Story 1.3 — do not pull their scope forward.

### Architecture Compliance

- Target repo structure: architecture.md §3 — this story creates only the root config files and the default `src/app/` scaffold. The deeper folders (`src/server/`, `src/features/`, `src/lib/`, `supabase/`, `tests/`) are created by the stories that own them — do NOT pre-create empty folder trees.
- Naming/conventions (architecture.md §22): TypeScript `camelCase`, components `PascalCase`, route paths lowercase. `@/*` maps to `src/*`.
- The app lives in the repo root (`C:\ElproSaas`), coexisting with `_bmad*/` and `docs/` — the architecture tree's `elpro/` root IS this repo.

### Testing Standards

- This story's "tests" are the verification gates themselves: clean install, typecheck, lint, build (Quality Gates — Gate 2), plus the lockfile guard. No unit-test framework is introduced yet — the test framework decision lands with the first story that needs it (Story 1.2 documents the gate plan; TEA `testarch-framework` initializes the harness).
- Per the sprint-change-proposal-2026-06-12 test-infrastructure decisions: automated tests will run against local Supabase only and `seed.sql` stays minimal — nothing to implement here, but do not introduce anything that conflicts (e.g., no test config pointing at remote projects).

### Project Structure Notes

- Repo is currently docs-only (recent commits: epics/PRD/architecture docs, bootstrap). This story produces the FIRST application code. There are no existing code patterns to follow or break — the scaffold establishes them.
- Windows host (PowerShell). Keep scripts cross-platform (Node-based scripts preferred over bash for the lockfile guard).
- PR must follow `docs/process/branching-and-pr-policy.md` and include: phase/scope statement, story link (this file), changed files, checks run, security/RLS impact (none — no tenant data yet, but confirm no service-role names in client code), data migration impact (none), deferred-scope confirmation (AR27).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — story statement, ACs, stop conditions
- [Source: _bmad-output/planning-artifacts/architecture.md#2 (ADR-A001, Version Verification Notes)] — Next.js App Router decision, verified versions
- [Source: _bmad-output/planning-artifacts/architecture.md#3] — target repo structure
- [Source: _bmad-output/planning-artifacts/architecture.md#22] — naming and structure conventions
- [Source: docs/quality/quality-gates.md#Gate 1, Gate 2] — repository hygiene and static quality gates
- [Source: docs/security/security-guardrails.md] — no service-role in client paths, no secrets committed
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-12.md] — test-infrastructure decisions (context for what later stories add)
- [Source: _bmad-output/project-context.md] — Phase A boundary, output discipline

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code / bmad-dev-story workflow), 2026-06-13

### Debug Log References

- `create-next-app` refused the in-repo temp path (`The application path is not writable`) despite the folder being writable. Worked around by scaffolding into the system temp dir (`%TEMP%\elpro-cna`) with `--skip-install --disable-git`, then moving the generated files into the repo root (per Task 1.3 temp-subfolder strategy). Temp dirs cleaned up afterward.
- Verification sequence (all green): `pnpm install` → `pnpm typecheck` (tsc --noEmit, exit 0) → `pnpm lint` (eslint, exit 0) → `pnpm build` (Next 16.2.9 Turbopack, exit 0). Reproducibility proven via `rm node_modules && pnpm install --frozen-lockfile` (exit 0). `pnpm run verify:lockfiles` passes.

### Completion Notes List

**Outcome:** First application code in the repo. Single package manager (pnpm) locked; Next.js App Router baseline initialized, verified, and reproducible. All ACs satisfied.

**Toolchain installed (create-next-app@latest → Next 16, exact pinned versions):**

- Runtime deps: `next` 16.2.9, `react` 19.2.4, `react-dom` 19.2.4
- Dev deps: `@tailwindcss/postcss` 4.3.1, `tailwindcss` 4.3.1, `typescript` 5.9.3, `eslint` 9.39.4, `eslint-config-next` 16.2.9, `@types/node` 20.19.43, `@types/react` 19.2.17, `@types/react-dom` 19.2.3
- `packageManager`: `pnpm@10.24.0` (enabled via corepack — no global pnpm install, no machine-config change). `engines.node`: `>=20.9.0` (architecture-verified minimum used as a floor so 20.9+/22/24 LTS all satisfy it; host ran Node 25).
- Bundler: Turbopack (Next 16 default, matches architecture's verified default). Tailwind is **v4 with CSS-based config** in `src/app/globals.css` (`@import "tailwindcss"` + `@theme inline`) — there is **no `tailwind.config.ts`** (acceptable per Task 1.4).

**Deliberate scope decisions (flagged for review — please confirm):**

1. **React Compiler disabled.** Next 16's `create-next-app` now enables React Compiler by default (`reactCompiler: true` in `next.config.ts` + a `babel-plugin-react-compiler` devDependency). This is **beyond** the story's explicitly enumerated baseline set (next/react/react-dom/typescript/tailwind + peers/eslint) and beyond the architecture's verified defaults (§2 lists Turbopack, not React Compiler). To honor "dependency scope limited to exactly this set" (AR28), I removed `reactCompiler: true` and dropped `babel-plugin-react-compiler`. Re-enabling it later is a one-line config + one dep — raise an ADR/story if desired.
2. **Generated `AGENTS.md` and `CLAUDE.md` excluded.** create-next-app's `--agents-md` default emits Next.js agent-guide markdown. The existing project `AGENTS.md` (Phase A constraints) is canonical and was preserved untouched; the generated boilerplate guides were not moved into the root (not part of the architecture target tree). The Next.js-specific guidance remains available under `node_modules/next/dist/docs/` if needed.
3. **`README.md`** is the create-next-app placeholder. Proper local-setup/README docs are owned by Story 1.4 — not pulled forward here.

**Guardrails confirmed:** `src/app/` holds only the scaffold default (layout/page/globals.css/favicon) — no `(auth)`/`(app)`/`api` route groups. Zero deferred-module references (Fortnox, supplier, AI, HR, rentals, assets, DoU, tender, RBAC, portal) and zero service-role names anywhere in scaffold output. `.gitignore` merged (existing entries preserved; appended `.next/`, build, coverage, tsbuildinfo, next-env.d.ts, vercel, pnp). git correctly ignores `node_modules`, `.next`, `next-env.d.ts`, `.env`. No migrations, no `.env` edits, no Lovable code, no dependencies beyond the approved baseline.

### File List

New (application baseline):

- `package.json` — pnpm-locked, pinned deps, scripts (`dev`/`build`/`start`/`lint`/`typecheck`/`verify:lockfiles`), `packageManager`, `engines`
- `pnpm-lock.yaml` — sole lockfile
- `pnpm-workspace.yaml` — pnpm `ignoredBuiltDependencies` (sharp, unrs-resolver) from scaffold
- `tsconfig.json` — strict TS, `@/*` → `./src/*`
- `next.config.ts` — minimal (React Compiler removed)
- `eslint.config.mjs` — eslint-config-next flat config
- `postcss.config.mjs` — `@tailwindcss/postcss`
- `next-env.d.ts` — generated, gitignored (not committed)
- `README.md` — scaffold placeholder (Story 1.4 owns setup docs)
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` (Tailwind v4 CSS config), `src/app/favicon.ico`
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`
- `scripts/verify/check-lockfiles.mjs` — lockfile guard (Task 4)

Modified:

- `.gitignore` — merged Next.js/build-artifact ignores (existing entries preserved)

Story tracking (not app code):

- `_bmad-output/implementation-artifacts/1-1-choose-package-manager-and-initialize-app-baseline.md` — this file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions

### Change Log

| Date | Change |
| --- | --- |
| 2026-06-13 | Story 1.1 implemented: pnpm + Next.js 16 App Router baseline scaffolded into repo root, exact versions pinned, lockfile guard added, verification gates (install/typecheck/lint/build + frozen reproducibility) green. Status → review. |
