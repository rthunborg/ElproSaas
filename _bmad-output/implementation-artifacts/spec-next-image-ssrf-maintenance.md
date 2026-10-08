---
title: 'Patch shared Next.js image SSRF dependency'
type: 'chore'
created: '2026-10-08'
status: 'in-review'
review_loop_iteration: 1
baseline_commit: 'ab1ca0445b58f5f496be0d938906c744b6dff87e'
context:
  - '{project-root}/docs/process/agent-workflow.md'
  - '{project-root}/docs/process/agent-model-routing.md'
  - '{project-root}/docs/process/review-order.md'
---

<frozen-after-approval reason="owner-authorized shared security maintenance">

## Intent

**Problem:** Next.js 16.3.6 is affected by GHSA-cjq9-62q9-8jv4 / CVE-2026-94483. The existing blocking high-severity dependency audit prevents shared CI from reaching later verification gates.

**Approach:** Pin Next.js and its matching ESLint configuration to the narrow stable patched release 16.3.8, update their lockfile graph, and verify compatibility on the current merged main baseline.

## Boundaries & Constraints

**Always:** Keep the existing audit threshold and all CI gates. Preserve unrelated direct pins, including React/React DOM 19.2.4 and pnpm 10.24.0. Base only on merged `origin/main`; preserve Phase B scope governance. Record actual verification outcomes and gaps.

**Ask First:** A repair that requires app behavior, permission/security configuration, secrets, or another dependency upgrade outside the framework patch scope requires an explicit scope decision. Merge and deployment remain owner-gated.

**Never:** Consume unmerged PR #86 Epic 14 or PR #87 Story 19.1. Edit CI, application code, migrations, environment files, permissions, or the scope manifest. Add an audit exception, weaken thresholds, reset local databases, adopt another actor's resource, commit, merge, or deploy from this delegate.

</frozen-after-approval>

## Authorization & Routing

Owner authorization covers implementation and the dependency patch without another plan approval. This is implementation mode for shared Phase B security maintenance, not product/module activation. ADR-0001's supersession note and `docs/process/agent-workflow.md` Authorization and Remaining Gates govern approval; the historical blanket per-action approval list does not apply. The parent rendered Build once and supplied its snapshot; steps 01–03 are followed with the existing owner authorization at the plan checkpoint.

Route recorded before changes: `gpt-6.1-sol`, **High**, security domain. The parent explicitly dispatched this context-free implementation delegate at High; no effort-only recursive delegation is needed. Independent review and git/PR actions belong to the parent.

## Code Map

- `package.json` — exact framework/ESLint pins and authoritative scripts; `packageManager` remains pnpm 10.24.0.
- `pnpm-lock.yaml` — pnpm lockfile v9 importer, integrity-pinned packages and snapshots; update only framework-related resolutions where possible.
- `pnpm-workspace.yaml:6` and `:17` — existing version-specific override and patch selectors, retargeted to the updated plugin; `patches/@next__eslint-plugin-next@16.3.6.patch` retains its historical filename and identical bytes.
- `next.config.ts` — read-only image configuration inspection: no `images.remotePatterns` configured. The advisory says that configuration is unaffected; the shared dependency/audit still needs patching.
- `.github/workflows/ci.yml:82` — read-only blocking `pnpm audit --audit-level=high`; subsequent type, lint, unit, build and containment stages must remain intact.
- `scripts/verify/check-lockfiles.mjs` and containment scripts — existing acceptance checks; no new version-mirroring test needed for this dependency-only change.
- `tests/unit/` — complete existing application regression suite; production build exercises framework integration and route generation. Use a bounded direct package compatibility probe for image/config/request behavior.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` — update only `next` and `eslint-config-next` to exact 16.3.8.
- [x] `pnpm-lock.yaml` — resolve with pnpm 10.24.0, inspect unrelated drift, then frozen-install.
- [x] `pnpm-workspace.yaml` — retarget only existing Next-plugin override/patch selectors to 16.3.8; preserve patch bytes.
- [x] `_bmad-output/implementation-artifacts/spec-next-image-ssrf-maintenance.md` — record sources, verification, limits, and author review order before independent review.

**Acceptance Criteria:**
- Given vulnerable 16.3.6, when dependencies are patched and audited, then GHSA-cjq9-62q9-8jv4 is absent and the unchanged high-severity audit succeeds.
- Given existing application contracts, when typecheck, lint, all unit tests, production build, containment and framework probes execute, then they pass without app or CI changes.
- Given the reviewed main baseline, when the final diff is inspected, then only authorized dependency files and this maintenance evidence change; any unavailable DB/browser evidence is explicitly deferred to CI.

## Spec Change Log

- 2026-10-08: First resolver attempt refused the now-unused 16.3.6 ESLint-plugin patch (`ERR_PNPM_UNUSED_PATCH`). Parent authorized the tightly necessary workspace dependency-config expansion: retarget both version selectors to 16.3.8, reusing the unchanged historical patch path. npm's 16.3.8 plugin tarball has the same `getRootDirs` patch target. KEEP all unrelated overrides and patch content; do not remove the compatibility guard.

## Design Notes

The [official maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) still renders `16.3.?`. The [GitHub advisory API](https://api.github.com/advisories/GHSA-cjq9-62q9-8jv4), checked 2026-10-08, gives affected `>=16.0.0,<16.3.8`, first patched `16.3.8`, High, CVE-2026-94483 (API published 2026-10-07). npm machine metadata confirms stable [next 16.3.8](https://registry.npmjs.org/next/16.3.8) and [eslint-config-next 16.3.8](https://registry.npmjs.org/eslint-config-next/16.3.8), Node >=20.9.0 and compatibility with React 19.2.4 / ESLint 9.39.4. Matching framework tooling avoids skew; unrelated advisories remain outside this repair.

Parent-provided historical CI evidence: [run 37759212463](https://github.com/rthunborg/ElproSaas/actions/runs/37759212463) on `e008a133bc51270a95f77698b7bde4d6dab5fd83` failed the high audit and skipped subsequent verify/dependent jobs. Local baseline audit independently reproduced exit 1: 8 advisories (1 low, 6 moderate, 1 high); the high advisory was the image SSRF. This is a shared dependency failure, not evidence of a defect in the two unmerged feature PRs.

## Verification

Commands use `npx --yes pnpm@10.24.0` because host-global pnpm is 12.8.1. Local Node is 22.23.2, matching `.nvmrc` major 22. Every shell command explicitly sets this worktree; host workdir selection was unreliable.

Required: frozen install; audit high; lockfile guard; source containment; typecheck; lint; full unit suite with existing 180-second budget; production build; built-bundle containment; targeted framework package compatibility. Full DB/RLS and browser evidence comes from unchanged CI; no managed local services are required here. Skipped suites are never represented as coverage.

### Executed results

Tested 2026-10-08 on the uncommitted maintenance diff over the full baseline above. In this table `pnpm` means the explicit pinned invocation `npx --yes pnpm@10.24.0`.

| Check | Actual result |
| --- | --- |
| `pnpm install --lockfile-only` then `pnpm install --frozen-lockfile` | Passed after the documented workspace-selector repair; 397 installed packages. Next/ESLint 16.3.8, React/React DOM 19.2.4. |
| `pnpm audit --audit-level=high` | Passed: 0 high/critical, 2 moderate (`vitest`, `@vitest/mocker`, [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)). Six Next advisories removed; SSRF advisory absent. |
| `pnpm run verify:lockfiles` / `verify:service-role-containment` | Both passed. |
| `pnpm run typecheck` | Passed, zero errors. |
| `pnpm run lint` | Host-limited: `EPERM: operation not permitted, scandir 'C:\Users\Rasmus\.codex\worktrees\9cd1\ElproSaas\_bmad\render\bmad-build\elprosaas-19e693190a5f\aead3742218b540cf99c'`, also on escalated retry. This generated snapshot is Git-ignored by `_bmad/render/.gitignore:1` (`*`), confirmed with `git check-ignore -v`; it is not excluded by ESLint's repository configuration. No config or permissions changed. |
| `pnpm run lint --ignore-pattern '_bmad/render/**'` | Supplemental lint passed: 0 errors, 13 existing warnings. All tracked source retained; this is not a canonical lint pass. |
| `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/dependencies/next-lint-root-globs.test.ts` | Passed 2 tests, 0 failed/skipped; installed patched helper and its real rule consumer exercised. |
| `node scripts/verify/run-with-time-budget.mjs --label 'Unit tests' --max-seconds 180 -- node --experimental-strip-types --import ./tests/support/register.mjs --test 'tests/unit/**/*.test.ts'` | Passed in 7.92 seconds: 1,948 passed, 0 failed, 1 skipped, 98 suites (1,949 total tests). Exact `test:unit` body under existing budget; `pnpm exec` was not used because its argument parsing consumed the budget delimiter and initially refused to run. |
| `pnpm run test:bmad-focused` / `test:auto-bmad-focused` | Passed 2 / 26+10 tests, zero failures. |
| `pnpm run build` / `verify:bundle-containment` | Production Turbopack build passed, 12/12 static pages generated; authoritative built-output containment passed. |
| Bounded `node -e` installed-framework smoke probe | Passed three groups: local image optimizer URL/default remote-host rejection; request cookies/307 redirect/JSON response and HttpOnly cookie; headers config schema and built login/dashboard/invite-confirm/unsubscribe entries. Synthetic `.invalid` URLs, no network/server launch. Initial probe harness assumed exported ESLint package metadata and omitted route groups; corrected filesystem metadata lookup and actual manifest keys, then all assertions passed. |
| `git diff --check` and final scope inspection | Passed; only package, lockfile, workspace dependency config and this evidence changed. Existing patch content/hash unchanged (`88513a4345d44468acd514beee604f895a6d6d2b61ebe4ee4ab8972de663385e`); lock graph changes are confined to Next/env/SWC/ESLint packages. |

Limits: the single skipped unit is the existing versioned file-backend restore test requiring Linux xattrs; it runs in Ubuntu CI. DB/integration/RLS/Storage/browser suites were not run locally and provide no local coverage. Canonical lint remains unverified locally because of the host directory restriction; unchanged CI must provide it. The smoke probe checks installed APIs and build artifacts, not actual authenticated browser journeys or DNS-rebinding exploitation. The patch's security status comes from verified advisory/registry data and the unchanged audit gate. No managed resources were launched, no app/schema/manifest/CI/env/permission files changed, and this delegate did not commit, push, merge or deploy.

### Successful smoke payload

Run from the repository root using PowerShell `$probe = @'` / `'@; node -e $probe` with the following exact successful JavaScript payload. This bounded probe launches no server and contacts no URLs.

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {NextRequest, NextResponse} = require('next/server');
const {getImageProps} = require('next/image');
const {configSchema} = require('next/dist/server/config-schema');
assert.equal(require('next/package.json').version, '16.3.8');
assert.equal(JSON.parse(fs.readFileSync('node_modules/eslint-config-next/package.json','utf8')).version, '16.3.8');
const local = getImageProps({src:'/icon.png',width:48,height:48,alt:'Probe'}).props;
assert.match(local.src, /^\/_next\/image\?/);
assert.equal(local.width,48);
assert.throws(()=>getImageProps({src:'https://untrusted.invalid/icon.png',width:48,height:48,alt:'Probe'}), /not configured/);
console.log('PASS image props: local optimizer URL and default remote-host rejection');
const request = new NextRequest('https://example.invalid/dashboard?probe=1',{headers:{cookie:'probe=present'}});
assert.equal(request.cookies.get('probe').value,'present');
assert.equal(request.nextUrl.pathname,'/dashboard');
const redirect = NextResponse.redirect(new URL('/login',request.url));
assert.equal(redirect.status,307);
assert.equal(redirect.headers.get('location'),'https://example.invalid/login');
const response = NextResponse.json({ok:true});
response.cookies.set('probe','updated',{httpOnly:true,sameSite:'lax'});
assert.equal(response.cookies.get('probe').value,'updated');
assert.match(response.headers.get('set-cookie'), /HttpOnly/);
console.log('PASS request/response: cookie parsing, redirect, JSON and secure cookie output');
assert.equal(configSchema.safeParse({headers:async()=>[{source:'/:path*',headers:[{key:'X-Frame-Options',value:'DENY'}]}]}).success,true);
assert.ok(fs.existsSync('.next/BUILD_ID'));
const manifest=JSON.parse(fs.readFileSync('.next/server/app-paths-manifest.json','utf8'));
for(const route of ['/(auth)/login/page','/(app)/dashboard/page','/auth/invite/confirm/route','/(public)/unsubscribe/[token]/route']) assert.ok(manifest[route],route);
console.log('PASS configuration/build: headers schema and representative built page/route entries');
```

## Suggested Review Order

Author: context-free `gpt-6.1-sol` High security maintenance implementation delegate.
Refreshed against the final uncommitted diff over `ab1ca0445b58f5f496be0d938906c744b6dff87e`.

### Patch the vulnerable runtime and preserve matching tooling

The first advisory-confirmed stable patch keeps the existing release line and React pins. Matching ESLint tooling requires retaining the existing root-glob adaptation rather than discarding it during resolution.

- `package.json:30` — `"next"`: pins the patched runtime.
- `package.json:43` — `"eslint-config-next"`: aligns framework tooling.
- `pnpm-workspace.yaml:6` — `@next/eslint-plugin-next@16.3.8`: preserves the version-specific tinyglobby override.
- `pnpm-workspace.yaml:17` — `patches/@next__eslint-plugin-next@16.3.6.patch`: reuses unchanged compatibility bytes.

### Confirm reproducibility and behavioral compatibility

The lockfile keeps the existing patch hash, and physical fixture tests prove root matching and lint-rule reachability. The recorded audit/build/unit evidence covers the dependency repair; remaining CI obligations are explicit above.

- `pnpm-lock.yaml:20` — `hash:`: unchanged patch identity.
- `tests/unit/dependencies/next-lint-root-globs.test.ts:39` — `installed Next lint helper`: relative/absolute/array/brace roots without recursive expansion.
- `tests/unit/dependencies/next-lint-root-globs.test.ts:55` — `patched Next no-html-link-for-pages`: real rule consumer still rejects raw route anchors.

Evidence and limits: see Executed results above; canonical lint, Linux-only recovery, DB/RLS and browser proof remain CI obligations.

## Review Round 1 of 3

Completed independent review through the parent against this maintenance diff and author trail. All three context-free reviewers used `gpt-6.1-sol` **High**, selected for the actual security dependency scope:

- **Blind defect review:** no concrete production-reachable defect.
- **Edge-case review:** returned an empty finding list.
- **Verification review:** reported no verification gaps.

High author triage found no consequential implementation defect requiring a fix. Optional evidence suggestions were accepted: preserve the successful smoke payload, link the historical CI failure and residual audit advisory, and distinguish the Git-ignored snapshot from ESLint's scan scope with its exact EPERM path. These are documentation refinements, not new product scope or a further broad review round. Existing moderate Vitest findings remain explicitly outside this repair; no introduced defect or new deferral was identified.

The maintenance commit/PR and its exact-head CI do not exist at this review handoff. Attach their canonical SHA and CI evidence when available; do not treat historical runs or local supplemental lint as that proof. Required CI verification (canonical lint, Linux recovery, DB/RLS/Storage and browser gates) remains outstanding. The artifact stays `in-review` pending required CI and owner merge approval; this delegate neither commits nor merges.
