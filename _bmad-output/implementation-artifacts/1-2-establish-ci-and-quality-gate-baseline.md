# Story 1.2: Establish CI And Quality Gate Baseline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an implementation lead,
I want CI to run the minimum Phase A verification gates,
So that every product story has a consistent definition of done.

## Acceptance Criteria

1. **Given** a pull request for Phase A product work, **when** CI runs, **then** install, typecheck, lint, unit test, and build gates execute using `pnpm`, **and** the PR template/checklist captures phase, story/ADR link, checks run, security/RLS impact, data migration impact, and deferred-scope confirmation.
2. **Given** no database migrations exist yet, **when** CI is configured, **then** migration reset, integration, RLS, storage, and golden-master jobs are documented as required once the relevant stories introduce those surfaces, **and** skipped product gates must be explicitly stated for docs/config-only work.

## Tasks / Subtasks

- [x] Task 1: Create the GitHub Actions CI workflow with the five active Phase A gates (AC: 1)
  - [x] 1.1 Create `.github/workflows/ci.yml` (the `.github/workflows/` directory does not exist yet — this story creates it; architecture §3 names `.github/workflows/ci.yml` as the target).
  - [x] 1.2 Triggers: `pull_request` targeting `main`, plus `push` to `main` (post-merge safety net). Add a `concurrency` group keyed on the ref with `cancel-in-progress: true` so superseded runs stop (keeps CI small/cheap, per the "small but expandable" technical note).
  - [x] 1.3 Provision the toolchain in the correct order (ORDER MATTERS — see Dev Notes): `actions/checkout` → `pnpm/action-setup` (let it read the `packageManager` field — do NOT also pass a `version:` input, or it errors on conflict) → `actions/setup-node` with `node-version-file: .nvmrc` and `cache: 'pnpm'`.
  - [x] 1.4 Install with `pnpm install --frozen-lockfile` (matches the reproducibility contract proven in Story 1.1; fails the build if `pnpm-lock.yaml` is stale).
  - [x] 1.5 Wire the existing lockfile guard as a CI step: `pnpm run verify:lockfiles` (Story 1.1 created `scripts/verify/check-lockfiles.mjs` + the `verify:lockfiles` script and explicitly handed off "Story 1.2 will wire it into CI" — do NOT rewrite the script, just call it).
  - [x] 1.6 Add the four remaining active gates as ordered steps, each using `pnpm run <script>`: `typecheck`, `lint`, `test`, `build`. Use one `verify` job with sequential steps (single install) rather than five parallel jobs (which would re-install five times) — see Dev Notes rationale.
  - [x] 1.7 Do NOT reference any secret, environment variable, external/paid service, deployment step, or Supabase service in this workflow (Stop Condition). No `secrets.*`, no `vercel`, no service containers yet.
- [x] Task 2: Provide the `test` gate without pulling the test-framework decision forward (AC: 1)
  - [x] 2.1 Add a `test` script to `package.json`. No test runner/framework is chosen yet (Story 1.1 deferred that decision to "the first story that needs it"; the TEA `testarch-framework` workflow initializes the real harness around Epic 2). Use an honest, cross-platform placeholder that announces why it is empty and exits 0 — see the exact snippet in Dev Notes. Do NOT add Vitest/Jest or any test dependency in this story (see Decision Note).
  - [x] 2.2 Confirm the placeholder runs green locally on Windows and will run identically on the CI Linux runner (`node -e "..."` is cross-platform).
- [x] Task 3: Author CI/quality-gate documentation (AC: 1, AC: 2)
  - [x] 3.1 Create `docs/quality/ci.md` describing: (a) the five **active** gates and the command each runs; (b) the **deferred** gates (migration reset, integration, RLS negative, storage negative, golden-master, secret scan) as required-once-introduced, each mapped to the introducing story; (c) the test-environment ground rules; (d) the docs/config-only skipped-gate convention.
  - [x] 3.2 State explicitly in `ci.md`: automated tests run against **local Supabase only** (CLI stack with migration reset) — never against shared dev/staging/prod projects (architecture §18). 
  - [x] 3.3 State explicitly in `ci.md`: `seed.sql` holds only a **minimal deterministic baseline**; business test data comes from test-only factories introduced in Story 2.2 (architecture §18).
  - [x] 3.4 State explicitly in `ci.md`: docs/config-only PRs may run lighter checks but MUST explicitly state which product gates were skipped (architecture §19; quality-gates.md Gate 2).
  - [x] 3.5 Add a one-line pointer from `docs/quality/quality-gates.md` (Gate 2) to `docs/quality/ci.md` so the gate-to-CI mapping is discoverable. Do not duplicate content — link it.
- [x] Task 4: Verify (do NOT recreate) the existing PR template satisfies AC1 (AC: 1)
  - [x] 4.1 `.github/pull_request_template.md` already exists and already captures Phase/Scope, Linked Work (story/ADR), Tests/Checks Run, Security/RLS Impact, Data Migration Impact, Money/Tax Impact, and Deferred-Scope Confirmation. Verify each AC1 field is present — do NOT rewrite the file.
  - [x] 4.2 Optional light alignment only: ensure the "Tests / Checks Run" section's wording matches the CI gate names so contributors reference the same gates. No structural rewrite.
- [x] Task 5: Validate the workflow and run the local gate sequence (AC: 1, AC: 2)
  - [x] 5.1 Sanity-check YAML well-formedness and GitHub Actions schema by careful review; run `actionlint` ONLY if it is already available (do not install it / do not add a YAML dependency to the app — network/install is gated). The authoritative syntax validation is the workflow executing on the PR (the `feature/1.2` branch already has an `origin` remote).
  - [x] 5.2 Run the active gates locally in CI order and confirm green: `pnpm install --frozen-lockfile` → `pnpm run verify:lockfiles` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`. Record results in the Dev Agent Record (note: `pnpm build` fetches a Google font over the network — expected to pass with network, as in Story 1.1).
  - [x] 5.3 Scope guardrail sweep: confirm the workflow adds no deferred-module step, no secret, no external service, and no production observability; confirm no new app dependency was added.

## Dev Notes

### Critical Constraints (read first)

- **Stop Conditions (this story).** STOP and request human approval if CI would require: secrets, external/paid services, global machine changes, or deferred integration setup. The pure-`pnpm` gate set below requires none of these.
- **No new app dependencies.** Per AR28 (dependency approval) and Story 1.1's precedent, do not add Vitest/Jest, a YAML linter, or any package. The unit-test gate is wired as a documented placeholder, not by installing a runner (see Decision Note). The framework decision is owned by the first product story that needs it (TEA `testarch-framework`).
- **Reuse, don't reinvent.** Two artifacts already exist and MUST be reused, not recreated: the lockfile guard (`scripts/verify/check-lockfiles.mjs` + `verify:lockfiles` script) and the PR template (`.github/pull_request_template.md`). Story 1.1 explicitly deferred CI wiring of the guard to this story.
- **Keep CI small but expandable.** Five active gates now; the heavier gates (migration reset, integration, RLS/storage, golden-master) are documented placeholders activated by later stories. No production observability, no deploy, no external integrations.
- **Phase A scope only.** No business routes, schema, or deferred modules. This story is chore/config: branch is `feature/1.2` (already checked out), CI + docs only.

### Decision Note — unit-test gate (flagged for owner review)

AC1 requires a "unit test" gate that executes, but **no test framework exists and no product code is testable yet** (Story 1.1 deferred the framework choice; architecture §18 names the unit layer but no runner). Two honest paths:

- **Recommended (this story's default): documented placeholder.** Add a `test` script that prints why no suite exists and exits 0, and wire it into CI. This keeps the gate present and the pipeline ready, adds zero dependencies, honors "the framework decision lands with the first story that needs it," and respects the "keep CI small" note. It is NOT a silent false-green — the script states its own emptiness, and `ci.md` documents that the real suite arrives with Story 2.2 / the TEA harness.
- **Alternative (needs explicit approval): initialize Vitest now.** Adds a dev dependency + one smoke test. This crosses AR28 (dependency approval) and pre-empts the TEA `testarch-framework` workflow, so it is out of scope unless the owner promotes it. If chosen, raise it as its own decision/ADR.

Implement the recommended path; the end-of-story question surfaces this for Rasmus.

### Architecture Compliance

- **Target location:** `.github/workflows/ci.yml` (architecture §3 repo tree). `.github/workflows/` is created by this story.
- **CI stages (architecture §19)** — the authoritative gate order. Active now = stages 1–5; documented-for-later = stages 6–10:
  1. Install (pnpm) · 2. Typecheck · 3. Lint · 4. Unit tests · 5. Build · 6. Supabase migration reset (once migrations exist) · 7. Integration command tests · 8. RLS/storage negative tests · 9. Golden-master comparison · 10. Secret scan (before external-beta hardening).
- **Gate 2 — Static Quality** (quality-gates.md): typecheck, lint, unit tests, build are exactly the Phase A product-PR gate; CI is its enforcement surface. Docs/config-only PRs run lightweight checks and must state skipped product gates.
- **Test Infrastructure Decisions (architecture §18)** — must be captured verbatim-in-spirit in `ci.md`: local-Supabase-only; `seed.sql` minimal-baseline-only; test-only factories own business data (Story 2.2); each test worker provisions its own tenant pair; RLS coverage gate fails CI when a tenant-owned table is uncovered (future, Story 2.4).
- **Toolchain pinning (from Story 1.1):** `packageManager: pnpm@10.24.0`, `engines.node: >=20.9.0`, `.nvmrc = 22`. CI must derive Node from `.nvmrc` (`node-version-file: .nvmrc`) and pnpm from the `packageManager` field (via `pnpm/action-setup`) so versions never drift from the repo source of truth.

### Reference CI workflow (target shape — adapt action versions to current stable)

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # pnpm BEFORE setup-node: setup-node's `cache: pnpm` needs pnpm on PATH first.
      - uses: pnpm/action-setup@v4          # reads version from package.json "packageManager"; do NOT also set `version:`
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run verify:lockfiles      # reuse the Story 1.1 guard
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

**Why one job, ordered steps (not five parallel jobs):** five separate jobs would each repeat `pnpm install` (5× minutes/cost) for no benefit at this size. A single `verify` job installs once and runs the gates in sequence. It stays expandable — later stories add separate jobs (e.g., `rls`, `golden`) that legitimately need their own Supabase service container.

### `package.json` `test` script (exact placeholder)

```json
"test": "node -e \"console.log('No unit test suite yet. The test harness is initialized by the first product story that needs it (TEA testarch-framework; first real suites land in Epic 2 / money-tax units in Epic 4). This placeholder keeps the CI unit-test gate wired. See docs/quality/ci.md.')\""
```

Cross-platform (works on the Windows dev host and the Linux runner), exits 0, and is self-documenting (not a silent pass).

### `docs/quality/ci.md` — required content checklist

- **Active gates** table: gate → command (`pnpm install --frozen-lockfile`, `pnpm run verify:lockfiles`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`).
- **Deferred gates** table mapping each future gate to the story that activates it:
  - Migration reset → first migration story (Story 2.2 introduces schema/RLS + migrations).
  - Integration command tests → Story 2.3 (command envelope) and downstream command stories.
  - RLS negative tests → Story 2.2 (helpers/fixtures) hardened by Story 2.4 (security regression harness; RLS coverage gate).
  - Storage negative tests → Epic 8, Story 8.1 (file-storage foundation).
  - Golden-master comparison → Epic 4, Story 4.4 (money/tax golden fixtures); Story 5.5; Story 9.3.
  - Secret scan → external-beta hardening (post Phase A).
- **Test environment rules:** local Supabase only (never shared dev/staging/prod); `seed.sql` minimal baseline only; business test data via test-only factories (Story 2.2); any admin/service key for test setup is test-only and never imported into app/client code.
- **Docs/config-only PRs:** lighter checks allowed but skipped product gates must be explicitly stated (in the PR's "Tests / Checks Run").

### Previous Story Intelligence (Story 1.1 — done)

- **Toolchain already pinned:** pnpm 10.24.0 (corepack, no global install), Next 16.2.9, React 19.2.4, TypeScript 5.9.3, ESLint 9.39.4, eslint-config-next 16.2.9, Tailwind v4 (CSS-based config, no `tailwind.config.ts`). `engines.node >=20.9.0`, `.nvmrc = 22` (added during 1.1 review to steer CI toward the architecture-preferred LTS).
- **Scripts available:** `dev`, `build`, `start`, `lint` (`eslint`), `typecheck` (`tsc --noEmit`), `verify:lockfiles`. This story adds `test`.
- **Explicit handoff:** Story 1.1 Task 4.1 — "Story 1.2 will wire [the lockfile guard] into CI." Honor it (Task 1.5).
- **Build needs network:** `pnpm build` fetches a Google font (`next/font/google`); green on networked CI, was green in 1.1's dev. Not a failure risk in CI.
- **No test framework yet:** 1.1 stated the framework decision "lands with the first story that needs it" and "TEA `testarch-framework` initializes the harness." Do not pre-empt it here.
- **Verification discipline:** 1.1's review penalized a false-green guard (a lockfile guard that passed on an empty file). Apply the same standard — the `test` placeholder must be honest about being empty, and `--frozen-lockfile` (not a bare `pnpm install`) keeps install reproducible.
- **Open scaffold items (NOT this story):** README still has create-next-app `npm/yarn/bun` instructions and `globals.css` Arial override are tracked in `deferred-work.md` (owners: Story 1.4 / 1.3). Do not fix them here.

### Git Intelligence

Recent commits show the established cadence: `feat(story-1.1): …`, `fix(story-1.1): apply Round 1 code-review hardening`, merged via PR (`#1`, `#2`) from `rthunborg/feature/1.1`. Follow the same conventional-commit + PR-to-main flow. Branch `feature/1.2` is already checked out and has an `origin` remote (so the PR run validates `ci.yml` end-to-end).

### Testing Standards

- This story's deliverables are themselves quality-gate plumbing. "Tests" = (a) the local gate sequence passing in CI order (Task 5.2), and (b) the workflow parsing/executing on the PR (Task 5.1). No unit-test harness is introduced (see Decision Note).
- Do not point any test config at a remote Supabase project (architecture §18 / project-context.md): local Supabase only when test jobs land later.

### Project Structure Notes

- New files: `.github/workflows/ci.yml`, `docs/quality/ci.md`. Modified: `package.json` (add `test`), `docs/quality/quality-gates.md` (one-line pointer). Verified-unchanged: `.github/pull_request_template.md`.
- Windows host (PowerShell); keep all scripts cross-platform (Node-based, as in 1.1).
- PR must follow `docs/process/branching-and-pr-policy.md`: scope/phase statement, story link (this file), changed files, checks run, security/RLS impact (none — no tenant data; CI references no secrets/service-role), data migration impact (none), deferred-scope confirmation. Merge gate: CI must pass.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — story statement, ACs, technical notes, test requirements, stop conditions
- [Source: _bmad-output/planning-artifacts/architecture.md#19 (CI And Quality Gates)] — 10-stage gate order; PR content requirements; docs-only lighter checks
- [Source: _bmad-output/planning-artifacts/architecture.md#18 (Test Strategy + Test Infrastructure Decisions)] — gate layers; local-Supabase-only; seed.sql-minimal; factories (Story 2.2); RLS coverage gate
- [Source: _bmad-output/planning-artifacts/architecture.md#3 (Repo And App Structure)] — `.github/workflows/ci.yml`, `scripts/verify/`, `tests/` target layout
- [Source: _bmad-output/planning-artifacts/architecture.md#2 (Version Verification Notes)] — pinned-versions policy; Node LTS guidance
- [Source: docs/quality/quality-gates.md#Gate 2] — static quality gate (typecheck/lint/unit/build); docs-only lighter checks
- [Source: docs/quality/definition-of-done.md] — Phase A product-work done criteria CI must enforce
- [Source: docs/process/branching-and-pr-policy.md] — PR requirements and merge gates
- [Source: .github/pull_request_template.md] — existing template satisfying AC1's checklist requirement (reuse, do not recreate)
- [Source: _bmad-output/implementation-artifacts/1-1-choose-package-manager-and-initialize-app-baseline.md] — pinned toolchain, scripts, `.nvmrc`, lockfile-guard handoff, no-test-framework decision
- [Source: _bmad-output/project-context.md#Quality Rules] — Phase A minimum gate set
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-12.md] — test-infrastructure decisions (local Supabase, seed.sql minimal)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

Local gate sequence run in CI order (Task 5.2), all green:

- `pnpm install --frozen-lockfile` → "Lockfile is up to date" / "Already up to date" (pnpm v10.24.0).
- `pnpm run verify:lockfiles` → "✅ Lockfile guard passed: only `pnpm-lock.yaml` is present."
- `pnpm typecheck` → `tsc --noEmit`, no output (clean).
- `pnpm lint` → `eslint`, no output (clean).
- `pnpm test` → placeholder prints the "no unit suite yet" message and exits 0.
- `pnpm build` → `next build` compiled successfully (Next.js 16.2.9, Turbopack); Google font fetched over network as expected; routes `/` and `/_not-found` prerendered static.

Validation tooling notes (Task 5.1): `actionlint` is not installed on the host and was not installed (gated). No YAML parser is present in `node_modules`. The workflow was validated by careful manual review against the GitHub Actions schema and the architecture-provided reference shape; authoritative schema validation is the workflow executing on the `feature/1.2` PR.

Scope guardrail sweep (Task 5.3): `ci.yml` contains no `secrets.*`, no `env:` block, no external/paid service, no Supabase service container, and no deploy step (the only matches for those keywords are in the comment block documenting that these are intentionally absent). `git diff package.json` confirms only a `test` **script** was added — no dependency or devDependency.

### Completion Notes List

- **CI workflow** `.github/workflows/ci.yml`: single `verify` job on `ubuntu-latest`, triggered by `pull_request` → `main` and `push` → `main`, with a `concurrency` group (`ci-${{ github.ref }}`, `cancel-in-progress: true`). Steps in required order: `actions/checkout@v4` → `pnpm/action-setup@v4` (no `version:` — reads `packageManager: pnpm@10.24.0`) → `actions/setup-node@v4` (`node-version-file: .nvmrc`, `cache: pnpm`) → install (`--frozen-lockfile`) → `verify:lockfiles` (reused Story 1.1 guard) → `typecheck` → `lint` → `test` → `build`. Five active Phase A gates wired (AC1).
- **Unit-test gate as honest placeholder** (Decision Note / Task 2): added a `test` script that prints why no suite exists and exits 0; **no** Vitest/Jest or any dependency added (respects AR28 and the deferred test-framework decision). Self-documenting, not a silent false-green.
- **Docs** `docs/quality/ci.md`: active gates table (gate → command), deferred gates table mapping each future gate to its activating story (migration reset → 2.2; integration → 2.3; RLS negative → 2.2/2.4; storage negative → 8.1; golden-master → 4.4/5.5/9.3; secret scan → external beta), test-environment ground rules (local Supabase only; `seed.sql` minimal baseline; test-only factories from Story 2.2; test keys stay test-only), and the docs/config-only skipped-gate convention (AC2). One-line pointer added from `quality-gates.md` Gate 2 → `ci.md` (no content duplication).
- **PR template** `.github/pull_request_template.md`: verified (not recreated) that all AC1 checklist fields are present (phase, story/ADR link, checks run, security/RLS impact, data migration impact, deferred-scope confirmation). Applied an optional light, non-structural alignment: an HTML comment under "Tests / Checks Run" listing the CI gate names and the skipped-gate convention.
- **Decision flagged for owner** (Rasmus): the unit-test gate is wired as a documented placeholder rather than by initializing Vitest now. Promoting to a real runner (Vitest) crosses AR28 and pre-empts the TEA `testarch-framework` workflow — left out of scope unless explicitly approved. See the end-of-story question.

### File List

- `.github/workflows/ci.yml` — **new**. CI workflow with the five active Phase A gates.
- `package.json` — **modified**. Added the `test` placeholder script (no dependency change).
- `docs/quality/ci.md` — **new**. CI/quality-gate documentation (active + deferred gates, test env rules, skipped-gate convention).
- `docs/quality/quality-gates.md` — **modified**. One-line pointer from Gate 2 to `ci.md`.
- `.github/pull_request_template.md` — **modified**. Light, non-structural alignment of "Tests / Checks Run" to the CI gate names.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **modified** (tracking). Story 1.2 status `ready-for-dev` → `in-progress` → `review`.

## Change Log

| Date | Change |
| --- | --- |
| 2026-06-15 | Implemented Story 1.2: added `.github/workflows/ci.yml` (5 active Phase A gates), `test` placeholder script, `docs/quality/ci.md`, Gate 2 → ci.md pointer, and PR-template checks alignment. All active gates verified green locally. Status → review. |
