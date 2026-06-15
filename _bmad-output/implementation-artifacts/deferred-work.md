# Deferred Work

Tracks real findings that were consciously deferred rather than fixed in the originating story. Each entry names where it came from and where it should land.

## Deferred from: code review of story-1.1 (2026-06-14)

- **README is the verbatim create-next-app placeholder** — instructs `npm/yarn/bun dev` (contradicts the pnpm-only AC1 / Stop Condition) and references `app/page.tsx` while the scaffold uses `src/app/page.tsx`. Owner: **Story 1.4** (local-setup / README docs), which rewrites the README wholesale. [README.md:7-19]
- **`globals.css` hardcodes `body { font-family: Arial, Helvetica, sans-serif }`**, overriding the Geist font that `layout.tsx` loads via `next/font/google` and that `globals.css @theme` maps to `--font-sans`. Inherited create-next-app (Tailwind v4) artifact; no functional impact today because `page.tsx` applies the `font-sans` utility. Owner: scaffold cleanup / **Story 1.3** (app shell). [src/app/globals.css:22-26]
  - **RESOLVED (2026-06-15, Story 1.3):** removed the Arial `font-family` override from `body` in `globals.css` and applied the `font-sans` utility on `<body>` in `layout.tsx`, so Geist (loaded via `next/font/google`, mapped to `--font-sans`) now applies app-wide. The old marketing `page.tsx` that masked the bug was also replaced with a `/dashboard` redirect.

## Deferred from: code review of 1-2-establish-ci-and-quality-gate-baseline (2026-06-15)

- **CI `pnpm build` gate is non-hermetic — `next build` fetches a Google font over the network.** The dependency comes from the app scaffold (`next/font/google`, Story 1.1), not the CI workflow this story added; Story 1.2 explicitly documents it as "expected to pass on networked CI." No functional impact on networked GitHub-hosted runners today. Revisit if/when CI runs in a network-restricted environment (self-hosted/air-gapped) or when font loading is reworked. Owner: scaffold/font cleanup (alongside **Story 1.3**) or a future CI-hardening story. [.github/workflows/ci.yml:58]
  - **Status (2026-06-15, Story 1.3 owner decision):** still deferred. Story 1.3 fixes only the `globals.css` Arial override; the `next/font/google` network fetch stays as-is (making it hermetic means switching to self-hosted `next/font/local`). Revisit in a future CI-hardening/font story.

## Deferred from: creation of 1-3-build-phase-a-app-shell-and-deferred-scope-navigation-guardrails (2026-06-15)

- **Automated component/UI tests for the Phase A app shell are deferred to the TEA `testarch-framework` harness (Epic 2).** Story 1.3 verifies its ACs (nav items, active state, keyboard reachability, absence of deferred labels/routes, responsive widths) via documented manual verification, because no test framework exists yet and Stories 1.1/1.2 reserved the framework decision for `testarch-framework` (AR28 dependency approval). When the harness lands, backfill automated tests covering: the seven nav items render and only those (no Pilotstöd/Migrering, no deferred modules), `aria-current` active state with a non-color indicator, icon-only controls expose accessible names + tooltips on hover/focus, and the sidebar→rail→drawer responsive behavior. Owner: first story after the test harness is initialized (Epic 2 / TEA `testarch-framework`). [src/components/app-shell/**, src/app/(app)/**]
