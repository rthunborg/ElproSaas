---
title: ElPro BMAD Project Context
status: active
baseline_plan: docs/planning/saas-rebuild-phased-plan-2026-06-07.md
phase: A - Internal Pilot MVP
last_updated: 2026-06-08
---

# Project Context For BMAD Agents

## Product Boundary

BMAD agents must plan and review only the Phase A Internal Pilot MVP unless the user explicitly approves a later-phase epic. Phase A is a small internal rebuild for the current company, not the full commercial SaaS.

In Phase A:

- Implement admin-only `tenant_admin` access.
- Preserve pooled multi-tenant architecture from day one.
- Build only the workflow CRM/settings/pricing -> calculations -> quote versions/PDF/acceptance -> basic job/order creation -> required files.
- Include migration/coexistence planning and golden-master comparisons against the current Lovable app.

Do not plan implementation for Fortnox, field-worker UX, supplier APIs, AI jobs, HR, rentals, assets, DoU automation, tender/FKU RAG, or full RBAC unless the user explicitly promotes that scope.

## Architecture Rules

- Default tenant model is pooled multi-tenant, not one Supabase project per customer.
- Use dev, staging, and prod Supabase projects. Production contains many tenant companies.
- Every future business table must be tenant-owned and protected by RLS.
- Phase A schema should contain only the v0 tables required by the baseline plan.
- Do not create placeholder production tables for deferred modules.
- No service-role key may be reachable from browser/client paths.
- No unauthenticated privileged functions are allowed.
- Prefer server-side command handlers for sensitive mutations.
- Critical commands must be auditable, tenant-scoped, validated, and tested.

## Money, Tax, And Quote Rules

- Represent SEK money as integer öre.
- Snapshot VAT rate, VAT amount, tax assumptions, work-role prices, article prices, and customer-visible quote content.
- A sent quote version is immutable.
- An accepted quote version and acceptance evidence are immutable except for explicit admin correction workflows.
- Changes to customer-visible price, terms, tax, attachments, or content after send require a new quote version.
- ROT and grön teknik assumptions require owner/accounting sign-off before production use.

## Lovable Oracle Policy

The existing Lovable app is a reference implementation and behavioral oracle only.

Allowed:

- Inspect screens, schema, and existing behavior.
- Extract anonymized fixtures.
- Compare calculations, quote outputs, PDFs, and accepted-job transitions.
- Cite exact source files/functions as candidates for tested reuse.

Not allowed by default:

- Copy coupled React/Supabase code into the new repo.
- Import generated architecture.
- Reuse weakly typed functions without tests and review.
- Port Edge Function service-role/auth patterns.

## Quality Rules

For Phase A work, the minimum expected gates are:

- Clean install.
- Typecheck.
- Lint.
- Unit tests for money/tax/quote lifecycle.
- Integration tests for core commands.
- Basic RLS cross-tenant negative tests.
- Migration reset from empty DB once migrations exist.
- No secrets committed or read into prompts unnecessarily.

## BMAD Output Discipline

BMAD agents should produce decision-oriented artifacts:

- State phase and scope explicitly.
- Mark each item as `IN`, `DEFERRED`, or `SEAM` where relevant.
- Link back to the baseline plan and related ADRs.
- Separate assumptions from decisions.
- Convert ambiguous Swedish business terms into explicit owner questions.
- Avoid broad implementation plans that smuggle in deferred modules.

