# Deferred Work

Tracks real findings that were consciously deferred rather than fixed in the originating story. Each entry names where it came from and where it should land.

## Deferred from: code review of story-1.1 (2026-06-14)

- **README is the verbatim create-next-app placeholder** — instructs `npm/yarn/bun dev` (contradicts the pnpm-only AC1 / Stop Condition) and references `app/page.tsx` while the scaffold uses `src/app/page.tsx`. Owner: **Story 1.4** (local-setup / README docs), which rewrites the README wholesale. [README.md:7-19]
- **`globals.css` hardcodes `body { font-family: Arial, Helvetica, sans-serif }`**, overriding the Geist font that `layout.tsx` loads via `next/font/google` and that `globals.css @theme` maps to `--font-sans`. Inherited create-next-app (Tailwind v4) artifact; no functional impact today because `page.tsx` applies the `font-sans` utility. Owner: scaffold cleanup / **Story 1.3** (app shell). [src/app/globals.css:22-26]
