---
stepsCompleted: ['step-01-preflight', 'step-02-select-framework']
lastStep: 'step-02-select-framework'
lastSaved: '2026-06-29'
---

# Framework Setup Progress

## Step 1: Preflight

- **Detected stack:** frontend (Next.js 16.2.9 + React 19; pnpm 10.24.0). No backend manifest present.
- **Existing E2E framework:** none. No `playwright.config.*` / `cypress.config.*`. `vitest.config.ts` exists but scopes DB-backed INT/RLS suites only — not an E2E conflict.
- **Context:** Supabase-backed auth (local CLI stack at http://127.0.0.1:54321). Gated E2E scaffold exists at `tests/e2e/auth/login-and-tenant-context.e2e.spec.ts` (the behavioral blueprint). Two-tenant factories at `tests/factories/tenants.ts`; local-stack env contract at `tests/support/test-env.ts`.
- **Decision:** Playwright (TypeScript). `tea_use_playwright_utils: true`.
- Prerequisites: PASS.

## Step 2: Framework Selection

- **Selected:** Playwright (TypeScript).
- **Rationale:** Frontend stack; complex repo with heavy API+UI integration (Supabase auth + server-resolved tenant context); CI parallelism matters; multi-case browser journeys. Cypress's DX edge does not outweigh Playwright's webServer + globalSetup/teardown fit for seeding/tearing-down a two-tenant Supabase fixture. `tea_use_playwright_utils: true` confirms the project's Playwright posture.

