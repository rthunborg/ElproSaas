# Demo Environment (MVP)

Provisioned 2026-07-03 after Epic 5 (owner decision). This is the **internal
pilot / demo** deployment of the Phase A app — not production, and not a test
target. It exists so the owner can demo the product and pilot users can try it.

## Topology

| Piece | Value |
| --- | --- |
| Hosting | Vercel project [`elpro-saas`](https://vercel.com/enhancior/elpro-saas) (Enhancior team), auto-deploys from `main` on GitHub `rthunborg/ElproSaas`. |
| Database | Supabase project **`elprosaas-demo`** — ref `wmqmzznmwpheswjjozhq`, region `eu-north-1` (Stockholm), **Enhancior** org (`oykbutypisxdgifmrxid`), free tier. [Dashboard](https://supabase.com/dashboard/project/wmqmzznmwpheswjjozhq). |
| App env vars (Vercel) | `NEXT_PUBLIC_SUPABASE_URL=https://wmqmzznmwpheswjjozhq.supabase.co` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from the project's API settings). No service-role key anywhere in the app — anon + RLS only, enforced by the CI containment gates. |
| Accounts | Two Supabase CLI/dashboard identities exist: the **Enhancior** company account (owns this project — the CLI on the dev machine is logged into it) and a private `rthunborg` account (owns unrelated projects; the Claude Code Supabase MCP connector is currently bound to it — prefer the CLI for this project). |

## Supabase CLI profile (per-project isolation)

Added 2026-07-14 after another project on the dev machine overwrote the global
`~/.supabase/profile` selector and broke every CLI call. This repo pins its own
CLI profile so cross-project clobbering can't recur:

- **Profile file:** [`supabase/cli-profile.yaml`](../../supabase/cli-profile.yaml)
  (committed; YAML — the CLI's TS implementation parses custom profiles with a
  YAML parser and silently falls back to the default profile on a parse
  failure, so don't convert it). It points at the normal production platform;
  only `name: elprosaas` is project-specific. No secrets.
- **Selection:** `SUPABASE_PROFILE=supabase/cli-profile.yaml` is set in the
  committed `.claude/settings.json` `env`, so agent sessions always use it
  (env/flag beat the global `~/.supabase/profile` file). The relative path
  resolves against the process cwd — run `supabase` from the repo root, or use
  `--profile` with an absolute path. Humans: set the env var in your shell or
  pass `--profile` explicitly.
- **Token slot:** the CLI stores its access token in the OS credential store
  under the ACTIVE profile's name, so this profile needs a one-time
  `supabase login --profile "<repo>/supabase/cli-profile.yaml"` (browser flow,
  Enhancior account). Other projects should get their own profile file + name
  + login the same way; then no project's `supabase login` can evict another's
  token, and nothing needs to write the shared global selector file.

## Schema & data lifecycle

- **Migrations flow one way: repo → demo.** The committed `supabase/migrations/`
  set is the contract. The repo is `supabase link`ed to the demo project; after
  an epic merges to `main`, apply new migrations with `supabase db push`
  (sanctioned by the 2026-07-03 guardrail decision — see
  [claude-code-coexistence.md](claude-code-coexistence.md)). Never edit the demo
  schema directly; never write a migration against the demo DB first.
- **CI never touches this project.** All CI jobs run against the LOCAL Supabase
  CLI stack only (see [ci.md](../quality/ci.md)). Do not point any test at the
  demo project.
- **Demo data is disposable.** It was seeded by one-off scripts (session
  scratchpad, not committed) connecting as the managed `postgres` role via the
  session pooler (`aws-1-eu-north-1.pooler.supabase.com:5432`, user
  `postgres.<ref>`, TLS verified against the published Supabase prod CA). The
  seeded content: tenant **Elpro Demo AB** (company settings, approved quote
  terms, 2 work roles, 3 articles, 2 customers — one company with facility +
  contact, one private with a fake personnummer — and one calculation with
  sourced/hidden/tillval rows). Reseeding or extending demo data the same way is
  fine; keep it obviously fake (`.example.test` emails, fabricated org/person
  numbers, öre values under 10 digits).

## Admin users (Phase A has no signup/invite flow — users are provisioned manually)

| Email | Tenant | Role |
| --- | --- | --- |
| `rasmus.thunborg@enhancior.se` | Elpro Demo AB | `tenant_admin` |
| `johan@eraelteknik.se` | Elpro Demo AB | `tenant_admin` |
| `alexander.lewandowski@gmail.com` | Elpro Demo AB | `tenant_admin` |

Passwords are held by the owner (never committed anywhere); reset via the
Supabase dashboard (Authentication → Users) if lost. To add another user:
insert into `auth.users` + `auth.identities` (GoTrue email-provider shape,
`extensions.crypt(pw, extensions.gen_salt('bf'))`, confirmed email, matching
`auth.identities` row with `provider_id = user id::text`) plus a
`tenant_memberships` row (`role='tenant_admin'`, `status='active'`) — or use
the dashboard's Add User button and insert only the membership row. When
inserting `auth.users` by SQL, set `confirmation_token`, `recovery_token`,
`email_change`, and `email_change_token_new` to `''` (not NULL) — GoTrue fails
sign-in with a 500 "Database error querying schema" otherwise. SQL can be run
without the DB password via `supabase db query --linked` (Management API).

## Guardrail posture (what agents may/may not do here)

- **Allowed:** `supabase link`, `supabase db push` (committed migrations only),
  read-only inspection, demo-data seeding as above.
- **Still hard-blocked** (deny-list + `guard.ps1`): `supabase projects delete`,
  secret operations, edge-function deploys. The DB password is owner-held; do
  not persist it in the repo or any committed file.
- The demo project is NOT a stop-condition violation: the CI "no shared
  dev/staging/prod project" rule constrains CI, which remains local-stack only.

## Post-epic routine (for future epic runs)

After an epic's PR merges to `main`:
1. Vercel auto-deploys `main` — no action needed.
2. If the epic added migrations: `supabase db push` (repo is already linked).
3. Optionally extend demo data so the new surface has content to show.
