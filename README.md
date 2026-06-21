# Elpro

Internal pilot platform for an electrical-contracting business — a tenant-admin
operations app (CRM, settings/pricing, calculations, quote versions/PDF/
acceptance, basic job creation, files). Currently **Phase A / Internal Pilot
MVP**; see [`AGENTS.md`](AGENTS.md) and the
[phased plan](docs/planning/saas-rebuild-phased-plan-2026-06-07.md) for scope and
what is deferred.

## Tech stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript 5.9, ESLint 9,
Tailwind CSS v4 (CSS-first `@theme` in `src/app/globals.css` — there is no
`tailwind.config.ts`). Managed with **pnpm only** (`@/*` path alias to `src/`).

## Prerequisites

This repo is **pnpm-only**. Do not use `npm`, `yarn`, or `bun` — a lockfile guard
(`pnpm run verify:lockfiles`) fails CI if another package manager's lockfile
appears.

- **Node.js** — version is pinned in [`.nvmrc`](.nvmrc) (`22`); `package.json`
  requires `>=20.9.0`. With `nvm`/`fnm` installed, run `nvm use` (or `fnm use`) in
  the repo root to pick it up.
- **pnpm** — do **not** `npm i -g pnpm` (it drifts from the pinned version).
  Enable Corepack so the exact version from `package.json`
  (`packageManager: pnpm@10.24.0`) is used automatically:

  ```bash
  corepack enable
  ```

The dev host of record is **Windows 11 + PowerShell**; the commands below also run
unchanged on macOS/Linux shells.

## Getting started

```bash
# Reproducible install (fails if the lockfile is stale — same as CI)
pnpm install --frozen-lockfile

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to
`/dashboard`. Edit pages under `src/app/` (e.g. `src/app/(app)/dashboard/page.tsx`)
and the page hot-reloads.

## Scripts and quality gates

These are the **only** scripts defined in [`package.json`](package.json). They are
listed in the same order CI runs them, so local checks and CI never drift
(architecture §19; see [`docs/quality/ci.md`](docs/quality/ci.md)):

| Step | Command | What it does |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | Reproducible install; fails on a stale lockfile. |
| Lockfile guard | `pnpm run verify:lockfiles` | Enforces pnpm-only; rejects stray/empty lockfiles. |
| Typecheck | `pnpm typecheck` | `tsc --noEmit`. |
| Lint | `pnpm lint` | `eslint`. |
| Test | `pnpm test` | **Placeholder — no unit suite exists yet.** It prints why and exits 0 to keep the CI gate wired. The real harness arrives with Epic 2 (TEA `testarch-framework`). |
| Build | `pnpm build` | `next build`. **Note:** `next build` fetches a Google font (Geist) over the network, so it needs internet on a fresh/restricted machine. |

`pnpm start` runs the production server after a build.

## Local Supabase (forthcoming — not yet wired)

Supabase is the Phase A backend (Auth + Postgres + Storage), but it is **not set
up in this repo yet**. There is intentionally **no `supabase/` directory, no
`config.toml`, and no migrations** today — those are introduced by **Epic 2**
(Story 2.2 brings the first migrations + local reset). So the commands below are
documented as **forthcoming**, not steps to run today:

- `supabase start`, `supabase db reset`, `supabase stop`, etc.

When that work lands, automated tests will run against a **local Supabase stack
only — never a shared dev/staging/prod project**. See
[`docs/quality/ci.md`](docs/quality/ci.md) (Test Environment Ground Rules) for the
local-Supabase-only rule, and [`docs/process/local-setup.md`](docs/process/local-setup.md)
for the full environment contract and the Windows/WSL/Docker conventions.

## Environment variables

Copy [`.env.example`](.env.example) to `.env.local` (or `.env`) and fill it from
**your own** dev Supabase project:

```bash
cp .env.example .env.local
```

`.env` / `.env.*` are gitignored (only `.env.example` is committed). The
service-role key is **server-only** and must never reach the browser. The full
variable contract is documented in `.env.example` and in
[`docs/process/local-setup.md`](docs/process/local-setup.md). Nothing reads these
variables yet; the consuming code lands in Epic 2.

## Lovable oracle policy

The existing Lovable app is a **behavioral oracle only** — **code is not copied
by default**. You may inspect its behavior, extract anonymized fixtures, and cite
candidate functions for tested reuse, but you may not copy coupled code or port
its service-role/auth patterns. See [`AGENTS.md`](AGENTS.md) and
[`docs/process/agent-workflow.md`](docs/process/agent-workflow.md#lovable-oracle-workflow)
for the canonical policy.

## More

- [`docs/process/local-setup.md`](docs/process/local-setup.md) — full local-setup
  and environment contract.
- [`docs/quality/ci.md`](docs/quality/ci.md) — CI gates and the test-environment
  rules.
- [`docs/process/branching-and-pr-policy.md`](docs/process/branching-and-pr-policy.md)
  — branching and PR requirements.
- [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) — agent operating rules.
