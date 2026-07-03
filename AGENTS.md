# Agent Instructions

Current project phase: Phase A / Internal Pilot MVP. Product implementation requires an approved Phase A story or explicit ADR-backed task.

Mandatory rules:

- Treat the Lovable app as a behavioral oracle only. Do not copy code by default.
- Baseline plan: [docs/planning/saas-rebuild-phased-plan-2026-06-07.md](docs/planning/saas-rebuild-phased-plan-2026-06-07.md).
- Phase A is Internal Pilot MVP only: pooled tenancy, `tenant_admin`, CRM/settings/pricing, calculations, quote versions/PDF/acceptance, basic job creation, required files, migration/coexistence.
- Deferred unless re-approved: Fortnox, field-worker UX, supplier APIs, AI jobs, HR, rentals, assets, DoU automation, tender/FKU RAG, full RBAC.
- Do not create database migrations, add dependencies, edit `.env`, or modify app code for process-only tasks.
- No service-role access from client paths. No unauthenticated privileged functions.
- Use the deeper docs in `docs/process`, `docs/quality`, `docs/security`, and `_bmad-output/project-context.md`.
- A live demo deployment exists (Vercel `enhancior/elpro-saas` + Supabase `elprosaas-demo`): see [docs/process/demo-environment.md](docs/process/demo-environment.md). Migrations flow repo→demo via `supabase db push` after merge; CI and tests never target the demo project.
