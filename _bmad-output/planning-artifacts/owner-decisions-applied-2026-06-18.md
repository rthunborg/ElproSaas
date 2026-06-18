---
created: 2026-06-18
project: ElproSaas
phase: Phase A - Internal Pilot MVP
purpose: >
  Translate the owner's 2026-06-18 email answers into concrete, story-ready
  decisions. Primary focus: Epic 3 (CRM/settings/pricing) story creation. Also
  records the downstream impact on Epics 4-9 and the two open scope decisions.
source_documents:
  - _bmad-output/planning-artifacts/owner-signoff-questions.md  # answer log + IDs
  - _bmad-output/planning-artifacts/epics.md                    # story definitions
  - _bmad-output/planning-artifacts/prd.md                      # assumption register
---

# Owner Decisions Applied (2026-06-18)

The owner reply (logged in `owner-signoff-questions.md`) resolves most of Prio 1-2.
This document converts those answers into decisions the affected stories can be
created against, resolving the relevant **Stop Conditions** in `epics.md`.

**Sequencing:** build order is unchanged — Epic 1 (Story 1.4 next) → Epic 2 →
Epic 3 → … These decisions are *prep*: they make Epic 3 (and later epics) ready to
create the moment their turn comes; they do not authorize jumping ahead of Epics 1-2.

---

## Epic 3 — CRM, Company Settings, Pricing (story-creation brief)

### Story 3.1 — Tenant-Owned CRM Data Model And Commands

**Customer types (resolves A10; Stop "customer type decisions materially change the data model").**
Exactly four types: `private` (privatperson), `company` (företag), `brf`,
`public` (kommun/offentlig). Customer type drives three things downstream:
- **Tax eligibility:** only `private` is eligible for ROT/grön teknik (see Epic 4).
- **Identifier field:** `private` → personnummer; `company`/`brf`/`public` → org.nr.
- **PDF VAT display default:** `private` → always incl-VAT line (see Story 3.3).

**Personnummer (resolves/REVERSES A23, AR16, NFR16; Stop "if personnummer capture is requested").**
Personnummer **is required** for `private` customers (needed for ROT). Implement it,
do not omit it. Handling: tenant-owned, access-controlled, not shown in normal list
UI by default — same private-data posture already described in the security
guardrails. Pilot is internal; full GDPR/retention treatment is deferred to full
release. Org.nr is the identifier for the other three types.

**Facilities / anläggningar (resolves A11).**
A customer can have **multiple** facilities. A facility is a first-class, natural
part of the model but **optional** on a customer (the admin need not actively work
in it for every customer — e.g. a private customer may have one home today and add a
sommarstuga later). Support adding/managing facilities freely under a customer.

**Contacts (resolves A11/A12).**
- Contacts exist at both **customer level and facility level**; **multiple** per
  customer/facility (arbetsledare, projektledare, etc.).
- **No enforced primary contact** at customer or facility level.
- The facility + specific-contact requirement lives at the **quote/job command
  layer**, not the CRM entity layer: creating a jobb or offert (and downstream tools
  like egenkontroll) **must** bind a facility and a specific contact. Model contacts
  so they can be linked freely to facility / job / project.

**Data-model implications.**
- `customers`: `customer_type` enum (4 values); `personnummer` (private, secure
  handling) / `org_nr` (others); existing identity/address fields; archive status;
  tenant ownership + parent-tenant constraints.
- `facilities`: tenant-owned, parent `customer`, many-per-customer, optional.
- `contacts`: tenant-owned; link to `customer` and **optionally** `facility`;
  no required primary flag (an optional `is_primary` is fine but never enforced).
- Cross-tenant RLS negatives for all three tables (per Epic 2 pattern).

### Story 3.2 — CRM UX
- List/detail for the four customer types (type badge); search per approved fields.
- Facility add/manage from the customer view (optional, multiple).
- Contact add/manage at both customer and facility level; **do not force a primary**.
- The "facility + contact required" rule is surfaced where it belongs — at quote/job
  creation (Epics 5-7) — not as a blocking CRM rule.
- Personnummer field present for `private` with restrained/masked display.

### Story 3.3 — Company Identity, Quote Terms, VAT Defaults
- **Quote terms:** placeholder text is acceptable for the pilot (owner: "platshållartext
  räcker"). Do **not** block on final wording; final customer-facing wording is full-release.
- **VAT display defaults (resolves part of A19, from answer 2.1):**
  - `private`: PDF **must always** show VAT rate + VAT amount + incl-VAT total —
    not togglable.
  - `company`: incl-VAT display is **togglable** (can show/hide).
  - Use the owner's existing Lovable quote as the oracle for the exact layout
    (capture anonymized).
- **VAT rate value** itself is still pending the working session (A19) — keep it a
  configurable setting (legacy hardcoded 25%), never a literal in calc/quote code.

### Story 3.4 — Work Roles And Articles
- **Reusable article/material register is IN scope** for the pilot (owner: yes) — so
  `articles` is included, not "optional/only if fixtures need it".
- **Work roles:** labor must be priceable **both** via reusable work roles **and**
  via free entry. Support both paths.
- Integer öre; values snapshottable via Story 3.5.

### Story 3.5 — Snapshot Source Contract
- Intent unchanged, but the contract must now cover `articles` (confirmed in scope),
  work roles, VAT defaults, and quote terms.

### Still open for Epic 3 (minor — not blocking)
- **`1.2` exact mandatory customer fields for a PDF** — owner gave "kundrelevant
  info" + type-driven identifier rather than a precise list. Proceed with sensible
  defaults (name; identifier by type; address; a bound contact) and confirm the exact
  required set in the working session. Not a data-model blocker.

---

## Downstream epic impacts (apply when those stories are created)

| Epic / story | Owner decision | Effect on the story |
| --- | --- | --- |
| Epic 4 · 4.3 (ROT/grön) | Only `private` eligible; **ROT and grön teknik cannot be mixed**; personnummer required for ROT | Resolves the *eligibility* half of A20/A21; **rates/caps/schablon + rounding + VAT rate still pending the working session** |
| Epic 4 · 4.2 (VAT) | Display rules from `2.1` (private always incl-VAT, company togglable) | VAT display resolved; VAT rate value pending |
| Epic 5 · 5.4/5.5 | Display modes: **detailed + text-only first** (summary later); options accepted **with base** but **individually selectable**; margin warning = **TB% vs a global threshold** in settings; **hidden rows DO count** in totals + deductions | Resolves UX-DR13/14 + readiness/options/hidden-row stop conditions (`2.2` exact handling to confirm by phone) |
| Epic 6 · 6.1-6.5 | Number = any unique format; statuses = **utkast / skickad / accepterad / förlorad-avböjd / arkiverad**; "sent" = our chosen lock event (drives dashboard follow-up); attachments **default-off opt-in + choose order** (`5.1`) | Resolves A13, statuses, sent semantics, attachment model |
| Epic 6 | **Email-from-app wanted (`3.4`)** | ⚠ **Scope decision** — email was Epic 6 *non-scope*; see below |
| Epic 7 · 7.1-7.4 | Auto-create a job on **every** accept; planned dates **at accept**; accepted price may differ **+ reason field** (`6.1`); double-accept = **audited correction** (`6.2`); job called **"Jobb"** | Resolves FR43/FR47 intent; **job structure (jobb/order/arbetsorder/projekt) + first-job fields pending phone (`7.1`/`7.3`)** |
| Epic 8 · 8.x | No files required before send (`5.2`); **snapshot + lock sent files as "facit"** (`5.4`); file types = all common, larger size limit; delete/restore = any admin | Resolves A17 + file lock model (Stories 6.3/8.4) |
| Epic 8 · 8.5 | **Unified document library wanted (`7.5`)** | ⚠ **Scope decision** — Phase A is a *limited* index; see below |
| Epic 9 · 9.5 | Cutover = **full Lovable feature parity** | Resolves the cutover gate; classification + golden masters pending phone (`8.1`/`8.2`) |

## Two scope decisions to settle (ideally with Alex)

1. **Email-from-app (`3.4`)** — Phase A scoped email as Epic 6 non-scope. Recommend:
   build the architectural seam now, defer live sending — unless the owner needs it
   day one, in which case it needs an ADR / scope re-approval.
2. **Unified document library (`7.5`)** — Phase A Story 8.5 is a *limited* file index,
   not a broad document center. Recommend: keep limited for the pilot, designed so a
   fuller library can layer on later.

Both pull in previously-deferred scope, so they should be an explicit decision, not
absorbed silently.

## Still gated on the working session (not in any story yet)

- Tax **rates/caps/schablon**, rounding rule, VAT rate value (Epic 4) — the critical
  remaining gate.
- Hidden-rows exact handling (`2.2`), job model + first-job fields (`7.1`/`7.3`),
  migration classification + golden masters (`8.1`/`8.2`).
