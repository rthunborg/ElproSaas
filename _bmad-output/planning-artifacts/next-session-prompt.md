# Next-session kickoff prompt (copy everything below the line)

> **Historical kickoff record — superseded 2026-08-31.** Do not execute its PR #41, ADR-B006, or merge instructions as current work; those decisions and tasks have since been completed. Consult `sprint-status.yaml`, Stories 10.8/10.9, and ADR-B008 for active follow-up planning. Before treating the follow-ups as complete, run fresh root-owned verification: historical test counts are superseded. Production/demo PDF-byte activation also requires matching server-only Vercel variables `QUOTE_PDF_ATTESTATION_KEY_ID` / `QUOTE_PDF_ATTESTATION_HMAC_SECRET` and Vault secret `quote_pdf_attestation_<key-id>`; follow `docs/process/demo-environment.md` for provisioning/rotation.

---

You are picking up the ElproSaas project at `C:\ElproSaas` (Windows, PowerShell + Git Bash, pnpm). Read this whole brief before acting — you have no context from the previous session.

## Where the project stands

**Phase B / Legacy Parity Release.** Phase A (Epics 1–9, internal pilot MVP) is complete. Phase B was ratified in a party-mode session and has a full planning package: `_bmad-output/planning-artifacts/` holds `prd-phase-b.md`, `architecture-phase-b.md` (ADR-B001…B006), `ux-design-specification-phase-b.md`, `epics-phase-b.md` (Epics 10–34, wave-tagged B1a/B1b/B2/B3), plus the frozen Phase A originals (`prd.md`, `architecture.md`, `epics.md` — do NOT edit those; they are the pilot record).

**Epic 10 (Quote Lifecycle Completion + Phase B governance re-baseline) is MERGED to `main`** — 4 stories: the scope manifest (`src/scope/manifest.ts`) + derived guardrails, the Förlorad/Avböjd `lost` lifecycle token, the manual follow-up workflow, and the first `{ data, entitlements }` pipeline read-model. It survived 8 rounds of independent Codex review. Both its migrations (`20260719120000_quote_lost_reasons_and_lost_status.sql`, `20260719130000_quote_follow_ups.sql`) are already applied to the demo database — do not re-push them.

**Owner + accountant answers arrived 2026-07-26.** Source files: `docs/discovery/phase-b-owner-answers-2026-07-26.md` and `docs/discovery/phase-b-accountant-answers-2026-07-26.md`. They are recorded in `_bmad-output/planning-artifacts/owner-signoff-questions.md` (the system of record). **Phase B now has no remaining hard owner gates.**

## Your tasks, in this order

### Step 0 — Check PR #41 is merged
`gh pr view 41 --json state,mergedAt`. It carries the answer recording + Stories 10.6/10.7. If still open and CI is green, merge it (`gh pr merge 41 --merge --delete-branch`) before continuing. Everything below assumes it is on `main`.

### Step 1 — Write ADR-B006 (the job model). This is the highest-leverage item.
`ADR-B006` is currently a GATED placeholder in `architecture-phase-b.md` — it blocks Epics 16–18 (Jobs core, economy, field depth). **The owner has now answered it:**

> **Option A as the model, Option C as the technique.**
> **A (model):** `Jobb` is the container; it contains `arbetsorder` (work orders); a jobb can be upgraded to a `projekt`, which unlocks project features (members/roles, payment plan, deeper economy).
> **C (technique):** implement as ONE typed entity — a single `jobs` table with `type ∈ {order, projekt}`, `arbetsorder` as child work items, and "upgrade" being an audited/event-logged type change (not a row migration).

Write the ADR properly: decision, rationale, schema implications, what it unblocks, and the consequences for E16–E18. The three options (A/B/C) are described in `_bmad-output/planning-artifacts/phase-b-party-session-2026-07-18.md` §9.2 — cite it. Phase A already ships a minimal `jobs` table (Epic 7, accepted-quote→job), so the ADR must say how the typed entity extends it rather than replacing it.

Also fold in the owner's job-card field list from answer N-9: estimated duration, earliest start, desired/latest end date, priority, number of people, competence/certification requirements, location, dependencies on other work items, travel time, responsible project manager, responsible Arbetsledare, whether the customer must be present, access/time windows. That answers the old open question `7.3`.

### Step 2 — Reconcile the planning docs with the answers
Three answers **contradict what is written and, for the first two, what is already shipped**. The docs are currently wrong and must be corrected so downstream story generation does not inherit stale assumptions.

1. **VAT rounding — `architecture-phase-b.md` §10 (and the Phase A architecture's Rounding section it inherits) is WRONG.** It specifies rounding VAT **per line** and summing rounded line values. The accountant ratified rounding **per VAT category at DOCUMENT level** (Peppol / EN 16931 **BR-CO-17**), explicitly warning that the per-line model yields different totals depending on how an invoice is split into lines. Line NET still rounds to öre; PDF displays 2 decimals; öresavrundning to whole kronor is supported but NOT default (and must appear as a separate document-level row, never baked into VAT). Amounts **claimed from Skatteverket** are whole SEK with öre **truncated** (not rounded).
2. **Hidden rows — the PRD/architecture assumption is WRONG.** Current: "hidden rows always count in both the total and the deduction basis." Correct: visibility does not drive economic inclusion. A hidden row counts in the TOTAL when billable, but in the DEDUCTION basis **only if its cost type is eligible** — material is never ROT-eligible; travel/machine/admin are neither ROT nor grön. Rows need three separate properties: `VisibleToCustomer`, `IncludedInInvoiceTotal`, `DeductionClassification` (`NONE`, `ROT_LABOR`, `GREEN_SOLAR_LABOR`, `GREEN_SOLAR_MATERIAL`, `GREEN_STORAGE_*`, `GREEN_CHARGING_*`).
3. **Mobile posture — the UX spec and architecture assume "responsive web first."** The owner asked for an installable **PWA with genuine offline capture**: offline for assigned jobs, time, materials, checklists/egenkontroller, deviations, photos; a local queue syncing on reconnect/app-open/foreground/manual retry (must NOT depend on background sync while closed); per-change states `SavedLocally|WaitingForSync|Syncing|Synced|Conflict|Failed`; **idempotent writes keyed by operation id**; append-only time/material/photos with optimistic locking for shared objects; local storage scoped to assigned jobs only, minimised, time-boxed, purged on logout, under the same permission checks as online reads. **No native app.** This is architecture, not polish — consider whether it needs its own ADR.

Other answers to fold into the docs (these ADD detail rather than contradicting):
- **N-4 / ADR-B001 / Epic 11 (RBAC)** — this one matters most for the next epic. Roles: Företagsadmin, Projektledare, Montör, Säljare, Ekonomi, plus **Arbetsledare as a per-job/per-project assignment, NOT a global role**; a user may hold several simultaneously. Permission model has 4 dimensions (resource/area, action, data scope, sensitive field groups) with named keys (e.g. `Jobs.ViewAssigned`, `Economy.ViewCostPrice`, `Economy.ViewContributionMargin`, `InvoiceBasis.ExportToFortnox`). **Defaults: Montör sees NO sales price, cost price, or TB. Säljare sees sales prices but NOT cost/TB** (`Economy.ViewContributionMargin` grantable separately). Server-side enforcement; **deny-by-default**; tenant-specific roles only editable by us internally in v1; all role/permission changes audit-logged. The current architecture says the matrix is "gated on N-4 with a conservative default" — replace that with the real matrix.
- **N-2 (E12 provisioning)** — no self-serve signup ever; internal operators provision after contract. AI-assisted but the provisioning logic is a **deterministic service/API**; the agent orchestrates and must NOT have general DB access or run arbitrary SQL in production. Flow must be validated, **idempotent**, dry-runnable, audit-logged, safe to re-run after partial failure. Subscription data (`SubscriptionPlan`, `IncludedUsers`, `AdditionalUserPrice`, `EnabledModules`, `CommercialOverrides`, …) stored as DATA, never hardcoded prices.
- **N-5 (Fortnox, E26/E33/E34)** — OAuth2 Authorization Code Flow **per tenant** (never shared credentials); initial scopes `companyinformation, customer, article, invoice`. **Our system is master for the invoice basis; Fortnox is master for the invoice, its number, bookkeeping and payment status.** No automatic bookkeeping or sending from our system in v1. Detailed line content for time/material/fixed-price/payment-plan/other, and a status flow `Draft→UnderReview→Approved→Exported→PartiallyInvoiced→Invoiced→Cancelled` where an approved version is locked against edits.
- **N-6 (E13 email)** — central verified sender subdomain, display name `[Företag] via [System]`, **Reply-To = the tenant's address**. Priority order: invitations/security → quote sending → accept/reject notification → job assignment → quote reminders → digests. Reminders auto-stop on accept/reject/withdraw/new version/expiry. Invoices are sent from Fortnox (avoid duplicate emails). Full delivery logging.
- **N-8 (E27/E28 DoU + egenkontroller)** — **Johan Ahlström is the named content owner** for the compliance content; we build the template engine/versioning/approval flow. Store `ContentOwnerUserId` as a configurable user reference, **never a hardcoded name**. The dev team must not author content presented as legally or electrically authoritative.
- **N-9 (E14 scheduling)** — capacity from the **actual weekly schedule**, not just employment percentage (80% may be 4 full days or 5 short ones). Capacity = scheduled time − holidays − absence − bookings − blocked time − buffer. Overtime is not ordinary capacity. Overbooking allowed but warns. Central Swedish public-holiday calendar plus tenant-specific closed days. No automatic optimisation required in Phase B.
- **N-10 (E31 HR)** — Phase B needs the technical groundwork: `RetentionCategory`, `RetentionUntil`, `LegalHold`, `AnonymizedAt`, deletion-request statuses `Received→…→Closed`. Applies to every identifiable person (including contact persons, subcontractors, people in photos). Ordinary admins must not hard-delete. Retention periods live in a central versioned policy, not scattered constants.

Keep Phase A artifacts frozen. Follow the repo's existing doc conventions.

### Step 3 — Report and STOP
When Steps 1–2 are done (branch → PR → CI green → merge, per the repo workflow), report what changed and **stop**. Tell the user to start a **fresh session** and run:

```
/auto-bmad epic --epic 11
```

**Do NOT run auto-bmad yourself in this session.** Epic 11 is RBAC and consumes the N-4 matrix directly; running it before Step 2 lands would generate stories against the superseded "conservative default" assumption.

## Standing context you need

**Workflow conventions**
- Work on a branch, open a PR, let CI go green, then merge with a merge commit and delete the branch. Running `gh pr merge` triggers the user's permission prompt — that prompt is the approval gate.
- The user runs an independent **Codex review on each PR** and pastes the comments back. Expect to triage them: verify each against the actual code (some are false positives, some are duplicates of already-ledgered items), fix what is real, ledger the rest. This loop has been high value — it found 3 P1s in Epic 10.
- Deferred/known work is ledgered in `_bmad-output/implementation-artifacts/deferred-work.md` and owned by explicit stories.
- Commit messages: Conventional Commits, with a body. **Write them via a file (`git commit -F <file>`) — backticks and parentheses in a `-m` string get mangled by the shell.**

**Open stories already created (do not re-create)**
- **10.5** — Quote-table DB hardening + read-model pagination. ~23 ledgered items: direct-table-API bypasses of command-layer invariants (composite parent constraints, sent-anchor enforcement, one-way follow-up lifecycle, reason-row coherence) and six-plus instances of PostgREST's **silent `max_rows = 1000` truncation** in read paths. **Worth splitting into two stories** — the bypass class and the pagination class are separate work.
- **10.6** — Tax-answer reconciliation (the VAT rounding, hidden-row, reverse-charge changes above). **Schedule this before any real ROT/grön quote leaves the system** — it is the one with legal weight.
- **10.7** — PWA + offline field capability.

**Environment gotchas**
- Local Supabase needs **Docker Desktop running**; then `npx supabase start` and `npx supabase db reset`. Cloud CLI commands need `SUPABASE_PROFILE=supabase/cli-profile.yaml`. The demo project is `elprosaas-demo` (ref `wmqmzznmwpheswjjozhq`, Enhancior org). Migrations flow repo→demo via `supabase db push --linked` **after merge**; CI never touches demo.
- There is a known **Windows-only** unit failure: `tests/unit/fixtures/golden/lovable/lovable-loader-roundtrip.test.ts` byte-compares a golden fixture that `core.autocrlf` rewrites to CRLF locally. It is green on CI (Linux). **1 failure of exactly this test is expected; anything else is real.**
- CI's `supabase db reset` step intermittently 502s during "Restarting containers"; a bounded 3-attempt retry is already in `.github/workflows/ci.yml`.
- Scope is **manifest-governed**: `src/scope/manifest.ts` is the single source for what surface may exist. A module's live surface requires `status: active`; `deferredFileToken` is deliberately pending-only metadata. Adding a tenant table means enrolling it in the manifest **in the same PR**, and the coherence validator plus the H4 inventory gate will fail loudly otherwise.
- Never weaken an existing guard/trigger/validator to make a test pass. Several Epic 10 review rounds surfaced fixtures taking shortcuts the domain forbids — the fix belonged in the fixture every time.

Start with Step 0, then Step 1. Ask me if any answer above is ambiguous rather than guessing.
