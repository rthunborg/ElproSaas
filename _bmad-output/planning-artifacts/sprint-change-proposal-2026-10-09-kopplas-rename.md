---
title: "Sprint Change Proposal: Kopplas product rename"
date: 2026-10-09
status: approved-repository-implemented-local-move-pending
phase: Phase B - Legacy Parity Release
trigger: Owner-directed rename from ElproSaas / Elpro to Kopplas
mode: batch-proposal
scope: cross-cutting naming correction with compatibility preservation
---

# Sprint Change Proposal: Kopplas product rename

**Owner approval — 2026-10-09:** Approved; proceed with implementation including
GitHub and local-folder rename. Future domains: `kopplas.se`, `kopplas.io`,
`kopplas.com`. These future names do not yet select a live canonical origin.
The proposal below is retained as the approval record; current implementation
progress supersedes its pre-approval status wording and is recorded in
[rename status](../../docs/process/kopplas-rename-status.md).

## 1. Issue summary and evidence

The owner has renamed the application **Kopplas**, reports that the Supabase
project display name is now **Kopplas**, and reports that the Vercel project is
now **kopplas**. The repository still presents and configures the application
under ElproSaas, ElPro, and Elpro names. The owner requests completion of the
rename throughout the project.

The hosted changes are owner-reported; this analysis did not inspect or mutate
hosted configuration. A project name does not establish the intended canonical
app URL, GitHub repository address, or local checkout path.

Repository evidence collected on 2026-10-09:

- A tracked-file scan found **4,742 matching lines in 375 files**, using
  `(?i)(?<![A-Za-z])elpro(?:saas|-saas)?`. Of those lines, 4,467 are under
  `_bmad-output`. This is an inventory, not a count of required replacements.
  The boundary excludes unrelated identifiers such as `PanelProps`.
- `src/app/layout.tsx:11` sets the title to `Elpro`; the description also uses it.
- `src/app/(auth)/login/page.tsx:63` tells users they are continuing to Elpro.
- `src/components/app-shell/AppShell.tsx:131,228,340` contains ElproSaas branding.
- `supabase/templates/invite.html`, `magic-link.html`, and the corresponding
  subjects in `supabase/config.toml` contain Elpro.
- Root `package.json` is named `elpro`; the monitor package is
  `elpro-cloudflare-monitor`.
- `_bmad/bmm/config.yaml`, `_bmad/core/config.yaml`, sprint metadata, current
  Phase B planning documents, agent descriptions, and working runbooks use the
  old name.
- `workers/cloudflare-monitor/src/model.ts:1` hard-codes
  `https://elpro-saas.vercel.app/login`; its validator accepts that exact URL.
- `supabase/config.toml:17` uses local `project_id = "ElproSaas"`; CI refers to
  `supabase_db_ElproSaas`. Compose and recovery examples also have old prefixes.
- Git origin currently resolves to `https://github.com/rthunborg/ElproSaas.git`.
  The actual checkout is `C:\DEV\ElproSaas`. Sprint metadata contains an older
  `C:/ElproSaas/...` path, which should be corrected independently of branding.
- The old name also appears in signed protocol domains, deterministic booking
  identifiers, stored file metadata, and backup ownership markers. These have
  behavioral meaning and cannot safely be treated as display text.

No product code, configuration, database, hosted service, or resource has been
changed by this proposal.

## 2. Impact analysis

### Epics and stories

This is a cross-cutting maintenance change. It does not invalidate a product
epic, introduce a new module, or change the Phase B parity inventory, functional
requirements, permissions, money rules, or Phase C exclusions.

Sprint status currently has Epic 14 in progress, its four stories in review,
and Epic 15 in backlog. Preserve those statuses and story IDs. Recommend an
**ADR-backed rename task** rather than reopening completed epics or adding a
branding epic. The proposed decision record is
`docs/decisions/ADR-B013-kopplas-product-name-and-compatibility.md`; confirm the
number remains available before creating it after approval.

The rename may be scheduled alongside completion of the current reviews and
before the next release. Do not misrepresent this proposal as completion of
any Epic 14 review or verification obligation.

### Artifact and technical effects

| Area | Required treatment |
| --- | --- |
| Current UI and app metadata | Replace product-name copy with Kopplas; preserve Swedish wording and behavior. |
| Auth email copy | Rename committed headings and subjects; verify hosted templates separately because local templates do not prove hosted configuration. |
| Current planning and agent context | Update active identity fields, titles, and current product prose; preserve IDs, links, requirements, and historical evidence. |
| Packages and disposable fixtures | Use lowercase `kopplas` package/prefix names; update coupled fixture assertions. |
| Deployment and monitoring | Reconcile the confirmed canonical origin, app URL, auth redirect configuration, monitor target, and operational docs together. |
| Local infrastructure and CLI profile | Treat namespace and credential-profile changes as operational transitions; retain old resources/data and verify reuse or deliberate new isolation through the guard. |
| Persisted protocol and storage identities | Preserve existing values for this rename and record exact compatibility exceptions. |
| GitHub and local directory | Scope and final addresses remain owner questions; never manufacture a working path or URL by text replacement. |

Frozen Phase A PRD, architecture, epics, and UX specifications explicitly require
immutability. Preserve them, completed execution/review records, historical
commands, migration files, and original evidence URLs. Current documents should
explain that historical Elpro/ElproSaas references identify Kopplas before the
rename. Existing tenant legal names, identities, quote snapshots, and PDFs are
business records and are not product branding to overwrite.

## 3. Recommended approach

**Direct adjustment through one ADR-backed task, implemented in reviewable
parts.** Scope classification: **Moderate**, because operational and identity
dependencies require coordination despite a small visible UI change.

1. Approve the rename policy and resolve the canonical URL and repository/path
   choices. Record the naming decision and compatibility exceptions in the ADR.
2. Apply current branding, package, documentation, agent configuration, and
   disposable fixture changes. Replace executable hard-coded checkout examples
   with repository-root resolution where supported.
3. Implement environment-variable compatibility and reconcile deployment,
   monitor, CLI-profile, and local resource naming with their consumers.
4. Verify the change and inventory every remaining old-name occurrence by
   reason: frozen history, compatibility, existing external identity, or a
   clearly tracked incomplete operational step.

Effort: **Medium** overall; Low for visible copy and current-document changes,
High for security-sensitive compatibility and auth-origin review. Risk: **Low**
for copy, **Medium** for operational cutover, **High** for an indiscriminate
replacement of protocol/storage identifiers. Plan for one maintenance task plus
a coordinated operational cutover; a calendar estimate depends on the URL and
repository/path decisions and access to the affected services.

Rollback of delivered functionality is unnecessary and would add risk. An MVP
scope reduction or fundamental replan has no justification for this request.

## 4. Specific edit proposals

### A. Current product presentation

| File / section | Old | New |
| --- | --- | --- |
| `src/app/layout.tsx` title | `Elpro` | `Kopplas` |
| Same file, description | `Elpro internal platform` | `Kopplas internal platform` |
| Login copy | `Logga in med ditt konto för att fortsätta till Elpro.` | `Logga in med ditt konto för att fortsätta till Kopplas.` |
| AppShell fallback and desktop/mobile brand | `ElproSaas` | `Kopplas` |
| Invite template and subject | `Du har bjudits in till Elpro` | `Du har bjudits in till Kopplas` |
| Magic-link template and subject | `Fortsätt till Elpro` | `Fortsätt till Kopplas` |
| Root package name | `elpro` | `kopplas` |
| Monitor package name | `elpro-cloudflare-monitor` | `kopplas-cloudflare-monitor` |
| Monitor user agents and alert subject | `elpro-...` / `Elpro pilot monitor: ...` | `kopplas-...` / `Kopplas pilot monitor: ...` |
| README title | `# Elpro` | `# Kopplas` |

Inspect raster/binary assets visually if an asset could contain old branding;
a text scan cannot establish their contents. This is a name change, not a logo,
color, font, or UX redesign. No PWA manifest or deferred feature is introduced.

### B. Current planning, governance, and workflow configuration

Apply `ElproSaas` / product-name `ElPro` / `Elpro` to `Kopplas` in the current
Phase B product brief, PRD, architecture, and UX titles/frontmatter and current
product descriptions. In `epics-phase-b.md`, update the title and overview and
add a pointer to the ADR-backed maintenance task; existing epic/story IDs and
acceptance criteria remain intact.

Add this dated statement to the current architecture/governance baseline:

> Effective 2026-10-09, the application is named Kopplas. Elpro and ElproSaas in
> frozen records refer to this application's earlier name. Versioned protocol
> domains and persisted metadata retain their existing values under ADR-B013;
> branding changes do not alter tenant identity or historical business records.

Update `AGENTS.md`, `_bmad-output/project-context.md`, current `.claude/agents`
descriptions, `.codex/rules/default.rules` commentary, `_bmad/bmm/config.yaml`,
`_bmad/core/config.yaml`, and current README/environment-contract descriptions.
Do not claim a generated context block has been newly verified against a commit
without performing that verification.

Sprint metadata changes:

```yaml
# OLD
project: ElproSaas
story_location: C:/ElproSaas/_bmad-output/implementation-artifacts
# NEW
project: Kopplas
# story_location: use a supported project-root-relative value if the consumer
# supports it, otherwise the VERIFIED actual checkout path; never guess it.
```

In `_bmad/custom/bmad-build-auto.toml`, replace the two fixed
`C:/DEV/ElproSaas` launch paths with verified root resolution supported by the
workflow. Verify the emitted Windows command quoting. Do not change model,
effort, review, or sandbox policy as part of the rename.

Working runbooks must describe current hosted names as **Supabase Kopplas** and
**Vercel kopplas**. Mark those as owner-reported until verified. Append dated
updates to historical evidence sections instead of rewriting previous claims.

### C. Configuration and infrastructure transitions

| Existing value | Proposed value / handling |
| --- | --- |
| MCP key `supabase-elprosaas` | `supabase-kopplas`; keep the verified project ref and credentials unchanged; note connection/session reload requirements. |
| Supabase CLI profile `name: elprosaas` | `name: kopplas` after verifying the new profile's authentication; account for its credential-store slot rather than assuming the old login transfers. |
| Local `project_id = "ElproSaas"` | `project_id = "kopplas"` with coordinated CI reference `supabase_db_kopplas` and documented local resource transition. |
| Compose default `elpro-story14-test` | `kopplas-story14-test`; retain explicit `COMPOSE_PROJECT_NAME` override support and guard ownership. |
| Recovery sample/runtime prefix `elpro-isolated-recovery-` | `kopplas-isolated-recovery-`; update coupled validation tests without restoring into the hosted app. |
| New backup archive prefix `elpro-pilot-` | `kopplas-pilot-`; update packaging/cleanup patterns together; discovery must still find existing archives by the established ownership marker. |
| `ELPRO_MONITOR_URL` / `ELPRO_MONITOR_EXPECTED_STATUS` | `KOPPLAS_MONITOR_URL` / `KOPPLAS_MONITOR_EXPECTED_STATUS` with tested transition aliases and coordinated GitHub variable updates. |
| `ELPRO_QUOTE_SEND_TRACK` | Prefer `KOPPLAS_QUOTE_SEND_TRACK`, retain a documented legacy fallback, and resolve conflicting/invalid settings to the existing safe `real_customer` behavior. Review at High effort. |
| `http://elpro.local` in auth callback URL construction | `http://kopplas.local` is only an internal parsing base; preserve the relative returned path and trusted-origin enforcement. |
| Canonical app origin / monitor URL | Use the owner-confirmed and verified origin; update the exact monitor validator, tests, Wrangler vars, `NEXT_PUBLIC_APP_URL`, Auth Site URL, and necessary callback allow-list together. |
| Production Worker name `elpro-pilot-availability-monitor` | Retain as an external compatibility identity until a state-preserving migration of Durable Object history, pending alerts, bindings, and Cron is verified. Record this as an explicit exception, not a completed resource rename. |

Supabase describes `project_id` as a local host discriminator and auth Site URL
as the base used for redirects and email URLs
([CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)).
The local namespace must therefore not be confused with the hosted project's
display name or project ref. The current CLI docs were read; fetching the
changelog Markdown through the web tool failed, so version-specific profile
or lifecycle behavior remains an implementation-time verification item.

No resource launch, deletion, migration replay, secret rotation, account rename,
or domain purchase is implied. Local resource transitions must use the trusted
resource guard and preserve existing containers, volumes, registrations, and
profiles. Do not rename the active checkout while agents are using it; prepare
the move and perform it only after affected work and path references are settled.

### D. Explicit compatibility exceptions

Retain these internal values in this task, documenting their role:

- `elpro.*.v1` signing, key-derivation, encryption, and review domains, including
  SQL mirrors and associated regression fixtures.
- `elpro.booking-create-id.v1`, which participates in deterministic booking ID
  generation and replay behavior.
- `elpro_file_linked_at`, a persisted Storage immutability marker.
- `elpro_pilot_backup`, the persisted Drive backup ownership/discovery marker.
- Historical migrations, finished review/execution records, frozen Phase A
  artifacts, and dated evidence URLs/paths.
- Existing tenant/company data, historical quote/PDF content, Auth account
  identities, and external resource addresses until explicitly reconciled.

Renaming these bytes requires a separate, versioned compatibility migration;
it is not necessary to present and develop the application as Kopplas. Any such
migration must preserve existing signatures/replays, storage protections,
backup recovery, and tenant boundaries, with High-effort implementation/review.

### E. Implementation task and acceptance criteria

**OLD:** no approved task covers the cross-cutting product rename.

**NEW:** ADR-backed task `KOPPLAS-RENAME-2026-10-09`, titled
**Complete the Kopplas product rename with preserved compatibility**.

1. Current app metadata, login, desktop/mobile shell, and committed auth email
   headings/subjects show Kopplas; existing navigation and auth behavior hold.
2. Current package names, workflow identity, active planning/context, fixture
   brands, and runbook instructions use Kopplas/kopplas consistently.
3. All remaining tracked old-name references are classified. No unexplained
   active branding remains; historical and compatibility references are retained
   with a documented rationale. Do not exclude all source/tests wholesale.
4. Environment aliases preserve supported behavior, fail closed on conflict,
   and have an explicit retirement condition after all consumers are migrated.
5. Local namespace/CI dependencies agree; existing local resources and data are
   preserved. CLI-profile and MCP changes are verified after any required login
   or session reload, or explicitly reported as incomplete.
6. Canonical URL, hosted callback/template configuration, and monitoring agree
   with verified service state. Report local completion separately from any
   pending hosted cutover; never infer hosted success from repository edits.
7. Versioned domains, deterministic IDs, stored metadata/backup markers, tenant
   data, historical migrations, and frozen records retain compatibility.
8. Repository/path decisions are implemented only at verified addresses, with
   links and automation working afterward; pending choices remain visible.

## 5. Verification and handoff

After owner review, the implementer records ADR-B013 and the task, then applies
the approved changes. Ordinary copy/docs/config work uses `gpt-6.1-sol` Low;
security-sensitive environment/auth/compatibility changes use High, as required
by `docs/process/agent-model-routing.md`. Independent review is retained and
focused on actual behavioral risk. The sensitive inventory was delegated to an
independent `gpt-6.1-sol` High reviewer before recommending compatibility handling.

Verification should include:

- Boundary-aware tracked-file scan with reviewed classifications and a complete
  final diff; validate current links and metadata paths.
- Existing typecheck, lint, unit, build, and containment gates applicable to the
  changed files; monitor-package unit/type checks for monitor changes.
- Focused tests for environment alias precedence/conflicts and canonical monitor
  URL acceptance/rejection. Avoid tests that merely mirror copy replacements.
- Visual confirmation of the title, login, and shell at desktop and 360x640;
  local email template rendering/callback coverage where changed.
- Appropriate required local integration/RLS coverage if command/configuration
  behavior changes, with `SUPABASE_TEST_REQUIRED=1` and executed/skipped counts.
  Hosted demo services are never generic test targets.
- Existing signature, booking-replay, immutable Storage, and recovery tests if
  any corresponding compatibility code is touched.
- Separate bounded hosted configuration/smoke evidence after cutover. Sending
  email to a person requires explicit authorization; no test mail is implied.

Implementer delivers the change and evidence; independent reviewer checks the
final diff; owner settles external naming and approves the proposal. No handoff
to another user-owned chat or external contact has occurred.

### Open owner inputs

1. The intended canonical Kopplas app URL.
2. Whether GitHub repository and local directory renaming are included now, and
   their intended names/paths if different from the straightforward Kopplas name.
3. Approval or amendments to the explicit history/compatibility exceptions above.

### Change-navigation checklist

| Items | Status | Outcome |
| --- | --- | --- |
| 1.1 triggering story | N/A | Direct owner naming decision; no defective story identified. |
| 1.2–1.3 trigger/evidence | Done | Owner statement plus concrete repository inventory. |
| 2.1–2.5 epic effects/order | Done | Existing epics remain valid; independent ADR-backed maintenance task. |
| 3.1–3.4 artifact effects | Done | Current planning, UX, code, operations, and historical constraints identified. |
| 4.1 direct adjustment | Viable | Recommended with compatibility preservation. |
| 4.2 rollback | N/A | No delivered capability needs rollback. |
| 4.3 MVP review | N/A | Naming does not reduce or redefine product scope. |
| 4.4 recommended path | Done | Moderate coordinated maintenance change. |
| 5.1–5.5 proposal/handoff | Done | Explicit edits, task criteria, risks, verification, and roles above. |
| 6.1–6.2 proposal review | Done | Repository-grounded proposal; uncertainty is explicitly recorded. |
| 6.3 owner approval | Action needed | Proposal has not yet been approved. |
| 6.4 sprint update | Pending approval | Update project metadata; no epic/status rewrite proposed. |
| 6.5 handoff | Prepared | Finalize task after approval and parameter resolution. |

The change is **proposed**, not implemented or release-verified.
