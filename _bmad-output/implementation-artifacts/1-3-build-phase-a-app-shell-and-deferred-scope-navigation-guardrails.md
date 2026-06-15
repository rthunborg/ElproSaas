# Story 1.3: Build Phase A App Shell And Deferred-Scope Navigation Guardrails

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a tenant admin,
I want a focused operations app shell showing only Phase A modules,
So that I can navigate the pilot workflow without seeing unavailable or deferred product areas.

## Acceptance Criteria

1. **Given** the tenant-admin app shell, **when** the user views desktop/laptop navigation, **then** the sidebar contains only Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, and Inställningar (Pilotstöd/Migrering appears **only if** an approved migration story requires it — no such story is approved yet, so it is omitted), **and** no Fortnox, field-worker, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, or analytics placeholder appears anywhere in the shell.
2. **Given** responsive layouts, **when** the viewport becomes medium or small, **then** navigation collapses to an accessible icon rail (medium) or drawer (small), **and** the page title and primary-action slot remain reachable without clipped labels or overlapping controls.
3. **Given** an icon-only control, **when** it receives focus or hover, **then** it has an accessible name **and** a visible tooltip or equivalent help.

## Tasks / Subtasks

- [x] Task 1: Create the authenticated app-shell route group and layout (AC: 1, 2)
  - [x] 1.1 Create `src/app/(app)/layout.tsx` — a route-group layout (the `(app)` group adds no URL segment) that renders the shell chrome: left sidebar (desktop) / icon rail (medium) / drawer (small), a slim top bar with a page-title region and an empty primary-action slot, and a `<main id="main-content">` region for `{children}`. This is the ONLY sidebar in the app — do NOT add nested sidebars (UX §2, technical note).
  - [x] 1.2 Add a "Hoppa till innehåll" (skip-to-content) link as the first focusable element, targeting `#main-content`, visible on focus (keyboard accessibility, UX §10).
  - [x] 1.3 Keep styling restrained and functional with Tailwind v4 utilities only. High-fidelity visual design, a brand system, and a reusable component library are explicit Phase A non-goals (UX §11) — do not build a design system here.
- [x] Task 2: Define the Phase A navigation config as the single source of truth (AC: 1)
  - [x] 2.1 Create a typed nav-items module (e.g. `src/components/app-shell/nav-items.ts`) listing exactly these seven items in order — `label` (Swedish UI label) → `href` (English route): Dashboard→`/dashboard`, Kunder→`/customers`, Kalkyler→`/calculations`, Offerter→`/quotes`, Jobb/Order→`/jobs`, Filer→`/files`, Inställningar→`/settings`.
  - [x] 2.2 Do NOT include Pilotstöd/Migrering. Add a code comment stating it is intentionally omitted until an approved migration story (Epic 9) activates it — do not build a feature-flag mechanism for it (avoid gold-plating; Stop Condition guards adding it prematurely).
  - [x] 2.3 Each nav item gets an inline SVG icon (so the icon rail and drawer have recognizable icons). Do NOT add an icon library (lucide/heroicons) or any other dependency — AR28 (dependency approval). Use simple inline SVGs.
- [x] Task 3: Build the sidebar / icon-rail / drawer navigation component with active state and a11y (AC: 1, 2, 3)
  - [x] 3.1 Implement the nav as a Client Component (`"use client"`) and derive the active item from `usePathname()` (next/navigation). Mark the active item with both `aria-current="page"` AND a non-color indicator (e.g. left border + bold weight) — active state must not rely on color alone (UX-DR4, UX-DR36).
  - [x] 3.2 Wrap the nav links in `<nav aria-label="Huvudnavigation">` (navigation landmark) and use `next/link` for client-side navigation.
  - [x] 3.3 Desktop (lg+): persistent sidebar with icon + text label. Medium (md): collapse to an icon rail; each icon-only link needs `aria-label` (accessible name) AND a visible tooltip shown on `hover` and `focus-visible` (CSS-driven, not the native `title` attribute alone, which is unreliable for keyboard focus) — satisfies AC3.
  - [x] 3.4 Small (<md): hide the rail and provide a drawer toggled by a hamburger button. The toggle is icon-only → give it `aria-label`, `aria-expanded`, and `aria-controls` pointing at the drawer. When the drawer opens, move focus into it; when it closes, return focus to the toggle (predictable focus, UX §10 / UX-DR35). Closing on `Escape` and on nav-link activation is expected.
  - [x] 3.5 Verify no clipped labels or overlapping controls at lg / md / sm; the page-title region and primary-action slot stay reachable at every width (AC2, UX-DR38).
- [x] Task 4: Create empty Phase A-owned route containers so every nav item resolves (AC: 1)
  - [x] 4.1 Create a minimal placeholder `page.tsx` under `src/app/(app)/` for each of the seven routes: `dashboard`, `customers`, `calculations`, `quotes`, `jobs`, `files`, `settings`. Each renders the page title and an honest empty state (e.g. "Den här modulen byggs i [epic/story]"). These are IN-scope Phase A modules (UX §1 IA table), NOT deferred placeholders — see Dev Notes "Scope nuance".
  - [x] 4.2 `dashboard` is the shell landing page: a restrained operational empty state (no fabricated metrics/analytics — Dashboard is operational, not analytics, UX §3). Do NOT create sub-routes for settings (`/settings/company|pricing|quote-terms` are Epic 3) or any detail routes — shell scope only.
  - [x] 4.3 Each placeholder must contain ZERO deferred-module content (no Fortnox/supplier/AI/HR/field-worker/etc. text, links, or stubs) (AC1, FR61, UX-DR3).
- [x] Task 5: Wire the app root and remove inherited scaffold artifacts (AC: 1)
  - [x] 5.1 Replace the create-next-app default `src/app/page.tsx` (Next.js/Vercel marketing template) with a redirect to `/dashboard` (`redirect("/dashboard")` from `next/navigation`). Do NOT leave the marketing template in the tree. (Auth/`/login` is Epic 2 — no auth boundary here.)
  - [x] 5.2 Remove the hardcoded `body { font-family: Arial, Helvetica, sans-serif }` override from `src/app/globals.css` so the Geist font loaded in `layout.tsx` (mapped to `--font-sans`) actually applies. This is the open deferred-work item owned by this story. [Source: deferred-work.md — code review of story-1.1]
  - [x] 5.3 Do NOT touch the README — it is owned by Story 1.4 (deferred-work.md). Do NOT change `next/font/google` to self-hosted fonts in this story unless the owner opts in (see Decision Note 2 — the non-hermetic font fetch stays deferred).
- [x] Task 6: Verify the shell (AC: 1, 2, 3)
  - [x] 6.1 Run the active gates in CI order and confirm green: `pnpm install --frozen-lockfile` → `pnpm run verify:lockfiles` → `pnpm typecheck` → `pnpm lint` → `pnpm test` (placeholder) → `pnpm build`. The `(app)` route group + `usePathname` client boundary must build cleanly.
  - [x] 6.2 Run the app (`pnpm dev`) and manually verify at desktop (≥1024px), medium (~768–1023px), and small (<768px) widths: all seven nav items present and only those; Pilotstöd/Migrering absent; active item shows `aria-current` + non-color indicator; icon-rail tooltips appear on hover AND keyboard focus; drawer opens/closes with correct focus handling; keyboard-only navigation reaches sidebar, top actions, and main content; no clipped/overlapping controls. Record results in the Dev Agent Record.
  - [x] 6.3 Scope guardrail sweep: confirm no deferred-module nav item, route, placeholder screen, or stub was added; confirm no new dependency was added (`git diff package.json` shows no dependency change); confirm navigation creates no authorization boundary (it is presentation only — server/RLS enforcement is later stories).
  - [x] 6.4 Automated component/UI tests: RESOLVED to manual-now (Decision Note 1) — no test framework added. The backfill deferral is already recorded in deferred-work.md; confirm it is still present after your changes.

## Dev Notes

### Critical Constraints (read first)

- **Presentation only — navigation is NOT a security boundary.** The shell renders links and route containers; it grants no access. Authorization is enforced server-side and via RLS in later stories (Epic 2+). Do not add auth checks, tenant data fetching, or membership gating here. [Source: epics.md#Story 1.3 Security/RLS Impact; architecture.md#5]
- **No new dependencies (AR28).** Build with what is already installed: Next.js 16.2.9 App Router, React 19.2.4, Tailwind v4 (CSS-based config). No icon library, no headless-UI/component library, no test framework, no animation lib. Use inline SVGs and hand-rolled accessible components. [Source: project-context.md#Architecture Rules; Story 1.1/1.2 precedent]
- **Deferred-scope guardrail is the heart of this story.** No Fortnox, field-worker, supplier, AI, HR, rentals, assets/QR, DoU, tender/FKU, full RBAC, customer portal, broad document center, or analytics may appear as a nav item, placeholder screen, dormant route group, or empty UI. [Source: FR61, UX-DR3, UX §11, architecture.md#4]
- **Shell scope only.** Only shell-level UX + empty Phase A-owned route containers. No detail routes, no `/login`/`(auth)` group (Epic 2), no settings sub-routes (Epic 3), no business logic. Avoid nested sidebars (use tabs inside detail pages later, not now). [Source: epics.md#Story 1.3 Technical Notes; UX §2]
- **Stop Conditions (this story).** STOP and request human approval if: a requested nav item belongs to deferred scope, a placeholder route is proposed for a future deferred module, or the work would require a new dependency / a test-framework decision you are not authorized to make (see Decision Note 1). [Source: epics.md#Story 1.3]

### Scope nuance — placeholder pages are allowed, deferred placeholders are not

The technical note says "empty Phase A-owned route containers needed by approved stories," and UX-DR3 forbids placeholder screens. These are **not** in conflict:

- The seven nav targets (Dashboard, Kunder, Kalkyler, Offerter, Jobb/Order, Filer, Inställningar) are all **IN-scope Phase A modules** per the UX IA table (UX §1). Creating a minimal, honest empty route container for each is the standard app-shell pattern and is what makes the nav navigable and testable (active state, keyboard reach). These are legitimate Phase A-owned containers from the architecture target tree (`src/app/(app)/...`, architecture §3).
- The prohibition in UX-DR3 / FR61 targets **DEFERRED modules** (Fortnox, field-worker, supplier, AI, etc.). Those get nothing: no nav item, no route, no stub.

Net: build seven honest IN-scope placeholders; build zero deferred-module artifacts. State each placeholder's owning epic/story in its empty state so it reads as "not yet built," not "dormant."

### Decision Note 1 — automated component/UI tests (RESOLVED)

**RESOLVED 2026-06-15 (owner: Rasmus): take the recommended path — documented manual verification now; defer automated shell component tests to the TEA `testarch-framework` harness (Epic 2). Do NOT add a test framework in this story.** The backfill is tracked in deferred-work.md. Original analysis retained below for context.

AC test requirements name "Component/UI tests" (nav items, active state, keyboard reachability, absence of deferred labels) and "Manual **or** automated responsive checks." **No test framework exists yet.** Stories 1.1 and 1.2 explicitly deferred the framework decision to "the first product story that needs it," and the architecture reserves harness initialization for the TEA `testarch-framework` workflow around Epic 2 (Story 1.2 wired only a unit-test placeholder). Two honest paths:

- **Recommended (this story's default): documented manual verification now.** Verify all three ACs via the running app at three widths and via keyboard, recorded in the Dev Agent Record (Task 6.2). Rationale: the shell is static, no-auth, no-data presentation; the test requirement explicitly permits manual responsive checks; adding Vitest + React Testing Library + jsdom now crosses AR28 (dependency approval) and pre-empts the TEA `testarch-framework` workflow that 1.1/1.2 reserved this decision for. Track the gap: add a deferred-work item to backfill automated shell component tests when the harness lands (Epic 2), so it is not silently dropped.
- **Alternative (needs explicit approval): initialize the test framework now.** Adds Vitest + React Testing Library + jsdom (+ config) and writes the component tests in this story. This crosses AR28 and front-runs the TEA `testarch-framework` workflow. If chosen, raise it as its own ADR/decision and run `testarch-framework` rather than hand-rolling config.

Implement the recommended path; the end-of-story question surfaces this for Rasmus.

### Decision Note 2 — non-hermetic Google font (RESOLVED)

**RESOLVED 2026-06-15 (owner: Rasmus): keep deferred — fix the Arial override (Task 5.2) only; leave the `next/font/google` network fetch as-is. Do NOT switch to self-hosted fonts in this story.** Original analysis retained below for context.

`layout.tsx` loads Geist via `next/font/google`, so `pnpm build` fetches the font over the network (tracked in deferred-work.md as "alongside Story 1.3 or a future CI-hardening story"). This story **fixes the clear bug** (the Arial override that masks Geist, Task 5.2) but leaves the network-fetch as-is, since making it hermetic means switching to `next/font/local` with self-hosted font files — a separate change. Only do that if the owner opts in; otherwise leave it deferred. Do not add a font package.

### Architecture Compliance

- **Target structure (architecture §3):** app routes live under `src/app/(app)/`; shell components under `src/components/app-shell/`. The `(app)` route group is created by this story. (`(auth)/` and `api/` are later stories — do not create them now.)
- **Routes & UI labels (architecture §4 table):** English route paths, Swedish UI labels. The seven shell routes are `/dashboard`, `/customers`, `/calculations`, `/quotes`, `/jobs`, `/files`, `/settings`. `/login`, detail routes (`/customers/[customerId]`, etc.), and settings sub-routes are explicitly later. "Deferred modules must not appear as navigation items, placeholder screens, empty route groups, or dormant UI."
- **Navigation model (UX §2):** persistent left sidebar (desktop) → icon rail with tooltips (medium) → drawer (small); slim top bar for tenant/user/page-action (tenant + user are populated in Epic 2 — show neutral placeholders, do not fabricate a tenant name or user); active section visually obvious AND exposed to assistive tech; no nested sidebars.
- **Naming (architecture §22):** React components `PascalCase`; route paths lowercase kebab/simple nouns; TS `camelCase`. UI components are feature-scoped; the shell is shared so it lives under `src/components/app-shell/`.
- **Accessibility (UX §10, UX-DR32–38):** keyboard usable across sidebar + top actions + main; icon-only controls have accessible names + visible tooltips; predictable focus on drawer open/close; status/active state not by color alone; responsive layouts prevent overlap/clipping/unreachable actions.

### File Structure (planned)

- **New:** `src/app/(app)/layout.tsx`; `src/app/(app)/{dashboard,customers,calculations,quotes,jobs,files,settings}/page.tsx` (7 placeholders); `src/components/app-shell/` (suggested split: `nav-items.ts`, `Sidebar.tsx`, `TopBar.tsx`, `NavItem.tsx`, `MobileDrawer.tsx`, or a consolidated `AppShell.tsx` — keep it small and readable).
- **Modified:** `src/app/page.tsx` (replace marketing template → redirect to `/dashboard`); `src/app/globals.css` (remove Arial override); `_bmad-output/implementation-artifacts/deferred-work.md` (resolve the Arial item; add the shell-component-test backfill item per Decision Note 1); `_bmad-output/implementation-artifacts/sprint-status.yaml` (tracking).
- **Do NOT touch:** `README.md` (Story 1.4), `.github/workflows/ci.yml` / `package.json` (no dep change), any deferred-module area.
- Windows host (PowerShell). Keep everything cross-platform; no global/system changes.

### Previous Story Intelligence (Stories 1.1 & 1.2 — done)

- **Toolchain (pinned in 1.1):** Next.js 16.2.9 (App Router, Turbopack), React 19.2.4, TypeScript 5.9.3, ESLint 9.39.4 + eslint-config-next 16.2.9, Tailwind **v4** (CSS-based `@theme` in `globals.css`, **no** `tailwind.config.ts`). `pnpm@10.24.0`, `engines.node >=20.9.0`, `.nvmrc = 22`. `@/*` path alias is configured (use `@/components/...`).
- **Existing source:** `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}` only. `layout.tsx` already loads Geist Sans/Mono via `next/font/google` and sets `--font-geist-sans`/`--font-geist-mono`; `globals.css @theme` maps `--font-sans: var(--font-geist-sans)`. `page.tsx` is still the create-next-app marketing template (replace it). The Arial override in `globals.css:22-26` currently defeats Geist (fix it).
- **Scripts available:** `dev`, `build`, `start`, `lint`, `typecheck`, `test` (placeholder that prints "no suite yet" and exits 0), `verify:lockfiles`. No test runner installed.
- **No test framework (1.1/1.2 decision):** framework choice deferred to "the first product story that needs it"; TEA `testarch-framework` initializes the real harness around Epic 2. See Decision Note 1.
- **Build needs network:** `pnpm build` fetches a Google font; green on networked runners (documented, not a failure risk).
- **Verification discipline (from 1.2 review):** no false-greens. Manual verification claims in the Dev Agent Record must be real (actually run the app at each width / with keyboard), not asserted.
- **Process:** conventional commits scoped per story (e.g. `feat(story-1.3): …`), one branch per story → PR to `main`, CI must pass. Story 1.2 used `feature/1.2`; create `feature/1.3` for this work (you are currently on `feature/1.2`).

### Git Intelligence

Recent commits confirm the cadence: `feat/ci/fix(story-1.x): …` with Round-1 code-review hardening follow-ups, merged via PR (`#1`, `#2`) from `rthunborg/feature/1.x`. Story 1.2 (`b05a506`, `c29960b`) is committed. Follow the same conventional-commit + PR-to-`main` flow; branch off `main` (or current tip after 1.2 merges) into `feature/1.3`.

### Testing Standards

- This story's "tests" = (a) the active gate sequence green in CI order (Task 6.1), and (b) documented manual verification of the three ACs at desktop/medium/small widths and via keyboard (Task 6.2), per Decision Note 1. No unit/component harness is introduced.
- Architecture §18: when the harness lands, component/UI tests live under `tests/` or co-located per §22 — do not scatter them. RLS/integration tests are not relevant to this presentation-only story.
- Do not point anything at a remote Supabase project (none is touched here).

### Project Structure Notes

- PR must follow `docs/process/branching-and-pr-policy.md`: phase/scope statement (Phase A, app-shell UI, no business logic), story link (this file), changed files, checks run, security/RLS impact (**none** — presentation only, no tenant data, no secrets/service-role), data migration impact (**none**), deferred-scope confirmation (explicitly confirm no deferred module added). Merge gate: CI green.
- Alignment with the architecture target tree is exact for the parts this story creates (`src/app/(app)/`, `src/components/app-shell/`). No variances expected; if the dev finds one, document it with rationale.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — story statement, ACs, technical notes, test requirements, security/migration impact, dependencies, stop conditions
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1] — epic goal, scope, explicit non-scope, FR60/FR61
- [Source: _bmad-output/planning-artifacts/architecture.md#3 (Repo And App Structure)] — `src/app/(app)/`, `src/components/app-shell/` target tree
- [Source: _bmad-output/planning-artifacts/architecture.md#4 (Frontend Route And Module Structure)] — route table, English-paths/Swedish-labels, "deferred modules must not appear" rule
- [Source: _bmad-output/planning-artifacts/architecture.md#22 (Implementation Patterns And Consistency Rules)] — naming, structure, feature-scoped components
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#1 (Information Architecture)] — IN/DEFERRED area table, recommended top-level nav (the seven items + conditional Pilotstöd)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#2 (Navigation Model)] — sidebar→rail→drawer responsive model, active-state, top bar, no nested sidebars
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#3 (Page And Screen Inventory)] — Dashboard is operational not analytics
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#9 (Validation/Error/Empty/Loading States)] — empty-state expectations; don't rely on color alone
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#10 (Accessibility)] — keyboard nav, icon-only accessible names + tooltips, predictable focus, no color-only status
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#11 (Explicit Non-Goals)] — no component library/brand system; no deferred-module nav/placeholders
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#12 + UX-DR1–9, UX-DR32–38] — left-nav assumption; navigation/accessibility design requirements
- [Source: _bmad-output/project-context.md#Architecture Rules / Quality Rules] — Phase A boundary, no deferred placeholders, minimum gates
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Arial-override item (owned by this story); non-hermetic font item
- [Source: _bmad-output/implementation-artifacts/1-1-choose-package-manager-and-initialize-app-baseline.md] — pinned toolchain, Tailwind v4, Geist font, `@/*` alias, src/app layout
- [Source: _bmad-output/implementation-artifacts/1-2-establish-ci-and-quality-gate-baseline.md] — scripts, active gate order, no-test-framework decision, branching/PR flow
- [Source: docs/process/branching-and-pr-policy.md] — PR requirements and merge gates

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

- **Skip-to-content reveal-on-focus** — initial `sr-only focus:not-sr-only focus:fixed` and a follow-up `-translate-y` / negative-`top` `focus:` variant approach both read as "still hidden on focus" under the preview harness. Root cause was diagnosed as the headless preview page lacking *system* focus (`document.hasFocus() === false`), so `:focus`/`:focus-visible`/`:focus-within` CSS pseudo-classes and programmatic `.focus()` events were intermittent. Resolved by driving the skip link from React `onFocus`/`onBlur` events that toggle Tailwind utility classes (`-top-24` ⇄ `top-4`) — robust in real browsers and verifiable in the harness (a dispatched `focusin` toggled the class; with system focus re-established via a real click it revealed at `top:16px` and re-hid on blur).
- **Icon-rail tooltip** — verification was intermittent for the same system-focus reason. Confirmed positively: all seven tooltips default to `opacity:0`; the generated CSS rule (`…:is(:where(.group/navlink):focus-within *){opacity:1}`) is correct and beats the `opacity-0` base on specificity; `opacity` read `1` on focus in two independent runs while the window held focus. Added `group-focus` alongside `group-focus-within` and `group-hover` so hover, the link's own `:focus`, and `:focus-within` all reveal it (maximally robust for AC3).

### Completion Notes List

Implemented the Phase A app shell and deferred-scope navigation guardrails (presentation only — no auth/RLS, no tenant data, no new dependencies).

- **Single source of truth** for nav: `src/components/app-shell/nav-items.ts` lists exactly the seven IN-scope modules (Dashboard→`/dashboard`, Kunder→`/customers`, Kalkyler→`/calculations`, Offerter→`/quotes`, Jobb/Order→`/jobs`, Filer→`/files`, Inställningar→`/settings`) with inline-SVG icon path data. Pilotstöd/Migrering intentionally omitted with a code comment (Epic 9 gate); no feature flag built.
- **Responsive shell** (`AppShell.tsx`, client component): persistent sidebar (lg) → 64px icon rail with CSS tooltips (md) → hamburger-toggled drawer (<md). Active item derived from `usePathname()`, marked with `aria-current="page"` + a non-color indicator (left border + bold). `<nav aria-label="Huvudnavigation">` landmark; `next/link` client nav. Drawer is `role="dialog" aria-modal="true"` with focus-in on open, Tab trap, Escape/overlay/link-close, focus return to the toggle, and background scroll lock.
- **Skip-to-content** link ("Hoppa till innehåll") is the first focusable element, targets `#main-content` (which is `tabindex=-1`), event-driven reveal on focus.
- **Seven honest empty route containers** under `src/app/(app)/`, each naming its owning epic (e.g. "Den här modulen byggs i Epic 6"); Dashboard is an operational landing with no fabricated metrics. Zero deferred-module artifacts.
- **Root wiring & scaffold cleanup**: `src/app/page.tsx` now `redirect("/dashboard")` (marketing template removed); removed the `body { font-family: Arial … }` override in `globals.css` and applied `font-sans` on `<body>` so Geist applies app-wide (verified: `getComputedStyle(body).fontFamily === "Geist, …"`); deleted five unreferenced create-next-app SVGs from `public/`. README left untouched (Story 1.4); `next/font/google` network fetch left deferred (Decision Note 2).

**Verification (Task 6, against the running app via the preview harness):**
- Gates green on final code: `pnpm install --frozen-lockfile` → `verify:lockfiles` → `typecheck` → `lint` → `test` (placeholder) → `build` (all 9 routes incl. `/` redirect + `_not-found` prerendered).
- Desktop (≥1024): full sidebar, 7 items in order, active state (`aria-current` + bold + blue left-border vs transparent/normal); client-side nav updates active item + top-bar title + `<h1>`; DOM scan found zero deferred-module terms; body font = Geist.
- Medium (768): 64px icon rail, labels hidden, `aria-label` accessible names, hamburger hidden, tooltip default `opacity:0` (all 7) and reveals on focus.
- Small (375): rail hidden, hamburger visible (`aria-expanded`/`aria-controls`/label), drawer absent until opened; on open → `role=dialog`/`aria-modal`, 7 labeled items, focus moves to the close button; Escape closes + returns focus to hamburger + restores scroll; drawer link navigates and closes; no horizontal overflow (no clipping).
- Scope guardrail sweep: no deferred-module nav item/route/placeholder/stub (only excluded-module mentions are in guardrail comments); `git diff package.json pnpm-lock.yaml` empty (no dependency change); navigation adds no authorization boundary.
- Decision Note 1 honored: no test framework added; manual verification recorded here; the shell-component-test backfill remains tracked in deferred-work.md.

**Harness note (no false-greens):** the headless preview page intermittently lacks system focus (`document.hasFocus()` toggled false after reloads/resizes), making `:focus`-dependent CSS verification flaky. Focus behaviors were each confirmed positively at least once with system focus present (re-established via a real click); the skip link was additionally made event-driven for deterministic correctness. No application console errors were observed.

### File List

**New**
- `src/app/(app)/layout.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/customers/page.tsx`
- `src/app/(app)/calculations/page.tsx`
- `src/app/(app)/quotes/page.tsx`
- `src/app/(app)/jobs/page.tsx`
- `src/app/(app)/files/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/components/app-shell/nav-items.ts`
- `src/components/app-shell/NavIcon.tsx`
- `src/components/app-shell/AppShell.tsx`
- `src/components/app-shell/PagePlaceholder.tsx`

**Modified**
- `src/app/page.tsx` (marketing template → redirect to `/dashboard`)
- `src/app/layout.tsx` (apply `font-sans` on `<body>`)
- `src/app/globals.css` (remove Arial `font-family` override)
- `_bmad-output/implementation-artifacts/deferred-work.md` (resolve Arial item)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

**Deleted** (unreferenced create-next-app scaffold assets)
- `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`

## Change Log

| Date       | Version | Description                                                                 | Author |
| ---------- | ------- | --------------------------------------------------------------------------- | ------ |
| 2026-06-15 | 0.1     | Implemented Phase A app shell + deferred-scope nav guardrails; status → review | Amelia (Dev) |
