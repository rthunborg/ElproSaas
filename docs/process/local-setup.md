# Local Setup And Environment Contract

This is the canonical guide for running Elpro locally and the contract for
environment configuration. The [README](../../README.md) is the quickstart; this
document holds the detail. Where another doc owns a rule (CI gates, the Lovable
oracle policy), this doc **links** rather than restating it, so there is one
source of truth.

Current phase: **Phase A / Internal Pilot MVP** (see [`AGENTS.md`](../../AGENTS.md)).

## Prerequisites

This repo is **pnpm-only** (AR2). `npm`, `yarn`, and `bun` are not supported — a
lockfile guard (`pnpm run verify:lockfiles`) fails CI if another package
manager's lockfile is committed.

| Tool | Source of truth | How to get it |
| --- | --- | --- |
| Node.js | [`.nvmrc`](../../.nvmrc) = `22`; `package.json` `engines.node` = `>=20.9.0` | `nvm use` / `fnm use` in the repo root. |
| pnpm | `package.json` `packageManager` = `pnpm@10.24.0` | `corepack enable` (do **not** `npm i -g pnpm`). |

Corepack ships with Node, derives the pnpm version from `packageManager`, and
keeps everyone on the pinned version. Installing pnpm globally is discouraged
because it drifts from the pin and can produce a different lockfile.

The dev host of record is **Windows 11 + PowerShell**. The commands here are
shell-agnostic and run unchanged on macOS/Linux.

## Scripts and the gate sequence

These are the only scripts in [`package.json`](../../package.json), listed in the
order CI runs them so local checks and CI never drift (architecture §19). The
canonical gate definitions live in [`docs/quality/ci.md`](../quality/ci.md) — this
table mirrors the command order only.

1. `pnpm install --frozen-lockfile` — reproducible install; fails on a stale lockfile.
2. `pnpm run verify:lockfiles` — enforces pnpm-only; rejects stray/empty lockfiles.
3. `pnpm typecheck` — `tsc --noEmit`.
4. `pnpm lint` — `eslint`.
5. `pnpm test` — **placeholder.** No unit suite exists yet; the script prints why
   and exits 0 so the CI gate stays wired. The real harness arrives with Epic 2
   (TEA `testarch-framework`). See [`ci.md`](../quality/ci.md#unit-test-gate-placeholder-by-decision).
6. `pnpm build` — `next build`. **Note:** `next build` fetches the Geist Google
   font over the network, so a fresh or network-restricted machine needs
   internet for the build to succeed (a known, intentionally-deferred non-hermetic
   step).

`pnpm dev` runs the dev server; `pnpm start` runs the production server after a
build.

## Environment variable contract

Copy [`.env.example`](../../.env.example) to `.env.local` (Next.js loads it
automatically) or `.env`, then fill each value from **your own** dev Supabase
project:

```bash
cp .env.example .env.local
```

`.env.example` is the documented, committed contract. The variable **names** are
the contract; the code that **reads** them lands in Epic 2 (Story 2.1 — auth /
tenant context). Nothing in the repo consumes these variables yet.

| Variable | Exposure | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Public Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe | Public anon key; RLS still enforces tenant isolation. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | Bypasses RLS. Never `NEXT_PUBLIC_`, never imported into browser/client code. |
| `SUPABASE_SIGNED_URL_TTL_SECONDS` (optional, forthcoming) | Server-only | Signed-URL TTL in seconds (architecture §6 — env-configurable; keep low in test envs). Consumed by Epic 8. |

Rules (see [`docs/security/security-guardrails.md`](../security/security-guardrails.md), NFR18):

- **No secrets in git.** `.env` and `.env.*` are gitignored; only `.env.example`
  is whitelisted (see [`.gitignore`](../../.gitignore)). `.env.example` holds
  **placeholders only** — no real project refs, keys, URLs, or PII.
- **Only `NEXT_PUBLIC_`-prefixed variables reach the browser.** Everything else is
  server-side.
- **The service-role key is server-only.** It bypasses RLS and must never be
  exposed to the client. Any service-role use must be documented with file path,
  purpose, and test coverage.

## Local Supabase (forthcoming — not yet wired)

Supabase is the Phase A backend (Auth + Postgres + Storage, architecture §6), but
it is **not set up in this repo yet**. There is intentionally:

- **No `supabase/` directory, no `config.toml`, no migrations, no `seed.sql`** —
  these are introduced by **Epic 2** (Story 2.2 brings the first migrations +
  local reset). Creating any of them is an approval-gated migration story, not
  this setup work.

So Supabase-local commands (`supabase start`, `supabase db reset`, `supabase
stop`, …) are **forthcoming**, not steps to run today. When that work lands:

- Automated tests run against a **local Supabase stack only — never a shared
  dev/staging/prod project.** See [`ci.md` — Test Environment Ground Rules](../quality/ci.md#test-environment-ground-rules).
- `seed.sql` stays a minimal deterministic baseline; business fixtures come from
  test-only factories (Story 2.2).

## Windows / WSL / Docker conventions

These are the standing rules for when Supabase-local / Docker work lands
(architecture §3). They apply to **this repo's** local stack; do not generalize
them into global machine changes.

- **No global Docker Desktop / daemon / WSL / system-level changes.** Setup must
  not require installing or reconfiguring anything globally on the host.
- **Project-local Compose only if ever needed** — no repo-wide reliance on a
  globally-installed stack.
- **No fixed `container_name`** — let Compose namespace containers per project so
  parallel checkouts don't collide.
- **No DB data bind mounts to Windows paths** — use named volumes; Windows-path
  bind mounts for Postgres data are slow and fragile.
- **Configurable localhost ports** — ports must be overridable so multiple
  projects/instances can coexist.
- **`.env` kept out of git** — see the environment-variable contract above.

Docker/Supabase are documented here as **forthcoming (Epic 2)**; nothing is
installed or scaffolded by this story.

## Lovable oracle policy

The existing **Lovable app is a behavioral oracle and fixture source only —
code is not copied by default.** It remains the behavioral oracle/fallback
reference for the pilot, but this setup work captures **no fixtures** and stands
up **no migration assets** (those are Epic 9).

The canonical policy lives in [`AGENTS.md`](../../AGENTS.md),
[`_bmad-output/project-context.md`](../../_bmad-output/project-context.md) (#Lovable
Oracle Policy), and [`agent-workflow.md`](agent-workflow.md#lovable-oracle-workflow).
In summary:

- **Allowed:** inspect screens, schema, and behavior; extract anonymized
  fixtures; compare calculations / quote outputs / PDFs / accepted-job
  transitions; cite exact source files/functions as candidates for tested reuse.
- **Not allowed by default:** copy coupled React/Supabase code; import generated
  architecture; reuse weakly-typed functions without tests and review; port Edge
  Function service-role/auth patterns.

The Lovable app may contain real company/customer data — inspect only what is
needed and never paste sensitive records into docs or fixtures (see
[`security-guardrails.md` — Lovable Oracle Handling](../security/security-guardrails.md)).

## References

- [README](../../README.md) — quickstart.
- [`docs/quality/ci.md`](../quality/ci.md) — CI gates, the placeholder test gate,
  and the local-Supabase-only test rule.
- [`docs/quality/quality-gates.md`](../quality/quality-gates.md) — Gate 2 (Static
  Quality) and the docs/config-only convention.
- [`docs/security/security-guardrails.md`](../security/security-guardrails.md) — no
  secrets in committed files; service-role is server-only.
- [`docs/process/agent-workflow.md`](agent-workflow.md) — operating modes and the
  Lovable oracle workflow.
- [`docs/process/branching-and-pr-policy.md`](branching-and-pr-policy.md) — PR
  requirements and merge gates.
- architecture.md §3 (repo/Docker conventions), §6 (Supabase/env), §18 (test
  strategy), §19 (CI gates).
