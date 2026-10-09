# Kopplas rename — implementation and operational status

Task: **KOPPLAS-RENAME-2026-10-09**, approved 2026-10-09 under
[ADR-B013](../decisions/ADR-B013-kopplas-product-name-and-compatibility.md).

## Current identities

| Surface | Identity / evidence |
| --- | --- |
| Product | Kopplas; current UI, metadata, committed email copy and planning updated. |
| GitHub | [rthunborg/Kopplas](https://github.com/rthunborg/Kopplas); rename completed and repository node ID preserved. Local origin updated and fetch verified. |
| Supabase | Kopplas, existing ref `wmqmzznmwpheswjjozhq`; authenticated connector verified ACTIVE_HEALTHY. No database or project-ref rename. |
| Vercel | `enhancior/kopplas`, existing ID `prj_QYRxEeUBlCStlPL0YZd72y8245rg`; CLI and connector verified. Local ignored `.vercel/project.json` display name reconciled. |
| Working origin | `https://elpro-saas.vercel.app`; authenticated domain inventory contains this sole verified domain. Monitor targets retain it. |
| Future domains | `kopplas.se`, `kopplas.io`, `kopplas.com`, owner-designated. None is claimed attached, purchased, or active; primary origin not yet selected. |
| Local directory | **Pending:** Windows refused the move because another process has the folder open. Actual path remains `C:\DEV\ElproSaas`; destination `C:\DEV\Kopplas` is absent. |

The GitHub rename preserves repository identity and history. Dated PR/run URLs
in historical evidence retain their original spelling. A saved app project
entry will need reopening at the new directory after the move.

## Finish the local directory move

The attempted same-volume move was rejected by Windows with “being used by
another process.” No files moved and no compatibility junction was created.
Close Codex/project terminals and any other sessions holding this checkout open,
then run this from an **external** PowerShell window:

```powershell
& 'C:\DEV\ElproSaas\scripts\ops\rename-kopplas-checkout.ps1'
```

The script validates both exact paths, refuses an existing destination, moves
all files without deleting anything, and creates the old path as a compatibility
junction for existing linked worktrees. Reopen the project at `C:\DEV\Kopplas`.
Use that real path for new guard-managed launches; reparse paths are rejected by
the resource guard. No user-owned process is stopped by the script.

## Environment and resource transitions

- `KOPPLAS_QUOTE_SEND_TRACK` is the current setting name; the legacy name is a
  temporary compatibility fallback. Invalid/conflicting values select
  `real_customer`, preserving tax sign-off enforcement. Vercel environment-name
  inspection found neither spelling configured, so no hosted opt-in was added.
- `KOPPLAS_MONITOR_URL` was added to GitHub with the same verified target as the
  existing `ELPRO_MONITOR_URL`. The old variable remains for the deployed main
  workflow. New workflow/script logic accepts both names and rejects conflicts.
  Expected HTTP status remains 200 by default.
- Fresh local Supabase CLI namespace is `kopplas`; CI's recovery database name
  was changed to match. Fresh Compose/recovery defaults use `kopplas-` prefixes.
  Existing local resources/data were not renamed, reset, or deleted. Explicit
  Compose project overrides still work. Port settings are unchanged.
- `supabase/cli-profile.yaml` intentionally keeps `name: elprosaas`, the existing
  credential-store slot. Its comments identify the product as Kopplas. Migrating
  this slot requires verified authentication of the replacement profile, not a
  cosmetic string replacement or secret copying.
- The MCP registration is now `supabase-kopplas`, with unchanged project ref and
  environment indirection. Agent clients must reload configuration to see the
  renamed registration; existing authenticated connector access was verified.
- The Cloudflare package and messages use Kopplas. The deployed Worker identity
  stays `elpro-pilot-availability-monitor` to preserve Durable Object data,
  history and pending alerts. No Worker deployment or Cron change occurred.
- New backup archive names use `kopplas-pilot-`; ownership/discovery retains
  `elpro_pilot_backup`, so old archives stay eligible for verified recovery.

## Remaining old-name inventory policy

Search tracked text using `(?i)(?<![A-Za-z])elpro(?:saas|-saas)?` and review the
context. `PanelProps` and similar identifiers are not product-name occurrences.
The initial inventory was 4,742 matching lines across 375 tracked files.

| Category | Files / retained meaning |
| --- | --- |
| Signed protocols and replay | `src/server/{bookings,provisioning,quote-pdf,storage,email}/` versioned domains, historical SQL and corresponding tests. Exact signed/derived bytes stay stable. |
| Storage immutability | `elpro_file_linked_at` in SQL and recovery fixtures/tests. |
| Backup ownership | `elpro_pilot_backup` in `scripts/ops/google-drive-backup.mjs` and tests. |
| Temporary environment aliases | Send-track resolver, monitor script/workflow, transition docs and dedicated tests. Remove only after all consumers are verified migrated. |
| Existing external identities | Current Vercel alias, deployed Worker name, CLI credential profile; their configuration and tests deliberately agree. |
| Historical records | Frozen Phase A planning, completed implementation/test/review/auto-BMAD artifacts, dated owner decisions and reports, original source/oracle documents, historical migration files and evidence URLs/paths. |
| Dated sections in living docs | Old entries in `demo-environment.md` and historical project-context summaries retain provenance; current naming sections supersede them. |
| Rename provenance | ADR-B013, approved proposal, this report and brief “formerly” statements explain the mapping. |
| Existing business data | Existing tenants, Auth identities, snapshots and PDFs were not rewritten; disposable fixture brands were updated. |

Current Codex instructions, executable workflow examples, sprint metadata and
forward planning use Kopplas or repository-relative paths. The original local
database authorization still names its original target; it does not silently
transfer permission to a different database namespace.

## Verification

Verification against the completed working-tree change on 2026-10-09:

- Full unit gate: **2,114 passed / 0 failed / 1 skipped** (2,115 tests). The skip
  is the existing Linux-xattr recovery test, which runs on Ubuntu CI.
- Required local mark-sent integration: **26 passed / 0 skipped**, with
  `SUPABASE_TEST_REQUIRED=1` against API `127.0.0.1:54321` / DB
  `127.0.0.1:54322/postgres`. No local stack reset or service adoption.
- Sensitive focused units: **90 passed / 0 skipped**. Canonical/legacy tax-track
  combinations, fail-closed gates, monitor conflicts and auth callback behavior.
- Cloudflare monitor: **9 tests passed / 0 skipped** and typecheck passed.
  Its pinned dependencies were installed with `--frozen-lockfile --ignore-scripts
  --ignore-workspace`; no dependency or lockfile changes.
- Root typecheck, production build, lockfile guard, source containment and
  built-bundle containment passed. Build used the local Supabase endpoint.
- Root lint passed with existing warnings; focused lint on changed compatibility
  code/tests passed after removing new unused tuple-label warnings.
- TOML configuration parse passed. No historical migration or protected
  signing/replay/backup-marker implementation changed.
- Local production login returned HTTP 200 with Kopplas title/copy; browser
  screenshots verified desktop and 360x640 rendering. Favicon inspected: generic
  triangle, no old product lettering. Authenticated shell received source review;
  the full browser acceptance suite was not rerun for this naming change.
- Independent Sol 6.1 High review found one branding omission (compact rail EP).
  It was fixed to K, then the reviewer closed the finding with no unresolved
  findings. Final production build and full units passed after the fix.
- Temporary guard-owned server `e1301f37-9ffb-4ffb-8aa1-bc98cc6a9b7c` received
  an accepted Stop request; browser tab closed. No shutdown polling or cleanup
  deletion was performed.

Logs are local ignored verification output under `tmp/private/kopplas-rename/`.
This is local implementation evidence, not a claim of hosted deployment or of
an executed full integration/RLS/browser suite.

## Hosted release and future domain checklist

Repository completion and a hosted release are different evidence:

1. Merge/deploy the reviewed rename through the existing project pipeline.
2. Reconcile hosted Auth email headings/subjects with the committed Kopplas
   templates; repository edits alone do not install hosted templates.
3. For a later domain cutover, select the primary origin from the three future
   domains, establish ownership/DNS/TLS, and verify it serves this project.
4. Coordinate `NEXT_PUBLIC_APP_URL`, Supabase Auth Site URL and exact callback
   allow-list, monitor validator/configuration, and GitHub monitor variable.
   Preserve valid in-flight auth links during the transition. Do not broaden
   redirect allow-lists or send unsolicited verification email.
5. Verify a bounded hosted smoke check and monitor probe, retaining the existing
   Worker history and backup access. A configuration change is not SLO evidence.

No future-domain DNS or hosted credential changes are part of this local rename.

## Suggested Review Order

### Name visible to users

Current product copy uses Kopplas and the narrow sidebar uses K. Persisted
business records and historical evidence retain their identity.

- `src/app/layout.tsx:10` — `metadata`: sets the product title and description.
- `src/components/app-shell/AppShell.tsx:226` — `K`: replaces the old compact initials.
- `supabase/templates/invite.html:1` — `Kopplas`: updates the committed invitation heading.

### Safe configuration transition

Both configuration spellings remain usable during rollout. Invalid/conflicting
quote settings preserve the tax gate; monitor conflicts fail before probing.

- `src/server/commands/quotes/send-track.ts:10` — `quoteSendCustomerDataTrack`: resolves safe demo opt-in.
- `scripts/ops/probe-availability.mjs:19` — `availabilityConfigFromEnv`: validates raw aliases.
- `tests/unit/server/commands/quote-send-track.test.ts:7` — `const values`: covers exact, absent, invalid and whitespace values.
- `.github/workflows/pilot-availability.yml:35` — `KOPPLAS_MONITOR_URL`: forwards the current alias beside the legacy value.

### Operational identities and release limits

The accepted ADR preserves existing signatures, storage protections and recovery
markers. Current working origin/profile/Worker exceptions are intentional;
future domains and hosted templates still require verified release work.

- `docs/decisions/ADR-B013-kopplas-product-name-and-compatibility.md:1` — `ADR-B013`: records the owner-approved naming and compatibility policy.
- `supabase/config.toml:17` — `project_id`: changes the fresh local namespace with its CI consumer.
