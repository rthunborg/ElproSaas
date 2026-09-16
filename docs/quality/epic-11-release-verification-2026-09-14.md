# Epic 11 release verification — 2026-09-14

## Decision

**IN:** The merged Epic 11 release at `5cc08d2b15b161e4742ddddc3283be4a3c03a059` is verified deployed to the demo environment. The invitation identity-binding release blocker is closed as verified and deployed.

**DEFERRED:** Performance/query/suite targets, availability/DR/observability targets, external delivery receipt, coverage/duplication measurements, and the advisory test-quality maintenance ledger remain open.

**SEAM:** The reset-retry production-command/action correction remains unimplemented product-correctness work. The retrospective remains rejected for this declared criterion.

## Merge and deployment record

| Change | Merge commit | Merged UTC |
| --- | --- | --- |
| PR #57 — identity binding | `9dd6e74a10f87e6bb1961f70ad02a8fcf2bc4a54` | 2026-09-14T11:36:19Z |
| PR #58 — invitation lifecycle | `7b0b991817d75e3f85247c115e12e6830943d9e9` | 2026-09-14T11:37:14Z |
| PR #55 — integrated checkpoint | `5cc08d2b15b161e4742ddddc3283be4a3c03a059` | 2026-09-14T11:37:45Z |

`supabase db push --project-ref wmqmzznmwpheswjjozhq --skip-vault` from the merged tree applied migrations `20260910165124`, `20260914092606`, and `20260914092850`. A repeat dry run reported `upToDate: true` with no pending migrations; the hosted ledger records all three as applied.

Vercel Production deployment `dpl_ExBJ9nSn3F6zGV9H8v6x7o3TAUSd` is READY from `5cc08d2`, with [the deployment URL](https://elpro-saas-n835tz2kq-enhancior.vercel.app) and the configured [elpro-saas.vercel.app](https://elpro-saas.vercel.app) aliases. Fresh deployment error and fatal-log counts were empty. Live GET `/login` returned 200; GET `/admin/users` redirected to login and returned 200. These are availability/routing checks, not authenticated demo-RPC tests.

Ten same-origin JavaScript chunks referenced by live `/login` were inspected for public Supabase URL literals. The sole baked runtime URL was `https://wmqmzznmwpheswjjozhq.supabase.co`, confirming the deployed application targets the verified demo database. No secrets were read or emitted.

## Database boundary verification

Hosted inspection confirms the acceptance function is `SECURITY DEFINER`, has an empty search path, derives `auth.uid()` and the confirmed Auth-user email, and retains trusted activation, delivery, and supersession guards. The inspected bodies exactly match merged source:

- identity function MD5: `c612fb85e99f09f77f1da307d5e6d7d7`
- lifecycle function MD5: `292b3d965982acce4fe0d21b3142996b`

The ACL retains Supabase's explicit anonymous EXECUTE default but has no PUBLIC grant. Independent review verified the `auth.uid()`-null guards deny before privileged capability; no reachable anonymous privilege or bypass was found. No live direct-RPC exploit or regression was run against the demo.

## CI and post-release evidence

Approved PR-head CI is green:

| PR | Run | Evidence |
| --- | --- | --- |
| #57 | [34828698510](https://github.com/rthunborg/ElproSaas/actions/runs/34828698510) | 1,733 units, 96 integration/RLS files with 1,011 passed and zero skips, 130 browser tests passed with four skipped |
| #58 | [34831789727](https://github.com/rthunborg/ElproSaas/actions/runs/34831789727) | 1,736 units with zero skips, 97 integration/RLS files with 1,014 passed and zero skips, 132 browser tests passed with four skipped |
| #55 | [34831828500](https://github.com/rthunborg/ElproSaas/actions/runs/34831828500) | 1,751 units, 101 integration/RLS files with 1,023 passed and zero skips, 136 browser tests passed with four skipped |

Post-merge main CI [34839174668](https://github.com/rthunborg/ElproSaas/actions/runs/34839174668) passed at `5cc08d2`: 1,751 units / 0 skipped, 101 required `SUPABASE_TEST_REQUIRED=1` integration/RLS files / 1,023 passed / 0 skipped, and 136 browser tests passed with four skipped. All checks and teardown passed.

## Security advisor limitation

Supabase security advisors returned no ERROR categories. They did return WARN findings: nine `anon_security_definer_function_executable`, 62 `authenticated_security_definer_function_executable`, and one `auth_leaked_password_protection`. The first two include five `admin_*` RPCs. Independent review verified their enforced Auth guards and found no reachable anonymous privilege; this record does not treat the warnings as a bypass or as clean advisor status.

The applicable follow-up references are [anon SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The password warning is an existing platform setting; no configuration change is authorized or needed for this deployment.

## Final Epic 11 closure reconciliation — 2026-09-16

The earlier reset-retry statement is historical; advisory maintenance remains open. Reset retry is merged in PR #60, and Epic 11’s four stories are done. The final sequence adds backup run [35093574844](https://github.com/rthunborg/ElproSaas/actions/runs/35093574844), isolated recovery [35093851115](https://github.com/rthunborg/ElproSaas/actions/runs/35093851115), a bounded alert rehearsal, and passing main CI [35097950030](https://github.com/rthunborg/ElproSaas/actions/runs/35097950030) at `27e8b11`.

This proves scoped archive recovery with ledger and Storage checks inside the approved RPO/RTO, not full provider disaster recovery. The first scheduled run, seven valid daily recovery points, monthly repetition, 30-day availability history, and full server-error denominator remain unobserved. The Epic verdict is **accepted-with-open-items** while NFR remains **CONCERNS**; the observations do not block Epic 12.
