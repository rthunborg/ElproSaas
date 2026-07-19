/**
 * ATDD RED-PHASE scaffold — Story 10.1 AC1 (re-baseline the authored governance docs to Phase B,
 * pointing scope enforcement at the manifest — one ADR-backed change).
 *
 * ── RED PHASE (implementation not yet landed) ─────────────────────────────────────────────────
 * `AGENTS.md`, `CLAUDE.md`, and the `phase-scope-reviewer` agent files still declare the FROZEN
 * "Phase A / Internal Pilot MVP" scope, so the Phase-B assertions below FAIL today — the intended
 * red state. Dev-story (Task 7) turns them green by re-baselining the governance/enforcement
 * statements to Phase B + the manifest, WITHOUT touching historical/record docs (Task 7.4) and
 * WITHOUT weakening the deny set / hook (Stop Condition).
 *
 * This is a pure docs-invariant scan (node:test, no DB) — mirrors the project's existing
 * `tests/unit/docs/**` validator pattern.
 *
 * [Source: story 10.1 AC1, Task 7; PRD §14 (Phase C ledger); Constraints (Stop Condition — do NOT
 *  weaken .claude/settings.json deny set / guard.ps1).]
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const REPO = process.cwd();
const read = (rel: string) => readFileSync(path.join(REPO, rel), "utf8");

test("10.1-DOCS-01 (AC1): AGENTS.md declares the CURRENT project phase as Phase B, not the frozen Phase A statement", () => {
  const agents = read("AGENTS.md");
  assert.ok(
    !/Current project phase:\s*Phase A \/ Internal Pilot MVP/.test(agents),
    "AGENTS.md must no longer pin the current phase to 'Phase A / Internal Pilot MVP'",
  );
  assert.ok(/Phase B/.test(agents), "AGENTS.md must state the Phase B baseline");
});

test("10.1-DOCS-02 (AC1): AGENTS.md points scope enforcement at the typed manifest (src/scope/manifest.ts)", () => {
  const agents = read("AGENTS.md");
  assert.ok(
    agents.includes("src/scope/manifest.ts"),
    "AGENTS.md must reference the scope manifest (src/scope/manifest.ts) as the scope source of truth",
  );
});

test("10.1-DOCS-03 (AC1): the phase-scope-reviewer agent (both .claude .md and .codex .toml) reviews against the manifest, not the frozen Phase A baseline", () => {
  const md = read(".claude/agents/phase-scope-reviewer.md");
  const toml = read(".codex/agents/phase-scope-reviewer.toml");
  for (const [name, src] of [
    [".claude/agents/phase-scope-reviewer.md", md],
    [".codex/agents/phase-scope-reviewer.toml", toml],
  ] as const) {
    assert.ok(
      src.includes("src/scope/manifest.ts"),
      `${name} must reference the manifest as the review baseline`,
    );
    assert.ok(
      !/## Phase A is ONLY/.test(src) && !/against Phase A Internal Pilot scope/.test(src),
      `${name} must be re-baselined off the frozen 'Phase A is ONLY' scope statement`,
    );
  }
});

test("10.1-DOCS-04 (AC1): CLAUDE.md phase-scope-reviewer row no longer says 'review diff against Phase A scope + deferrals in AGENTS.md'", () => {
  const claude = read("CLAUDE.md");
  assert.ok(
    !claude.includes("review diff against Phase A scope + deferrals in `AGENTS.md`"),
    "CLAUDE.md reviewer-table row must be re-baselined to Phase B + the manifest",
  );
});

test("10.1-DOCS-05 (Stop Condition guard): the re-baseline does NOT weaken the .claude/settings.json deny set", () => {
  // A safety net kept GREEN throughout: the irreversible/prod deny entries and secret-read denials
  // must survive the governance re-baseline untouched.
  const settings = read(".claude/settings.json");
  for (const denied of [
    "supabase functions deploy",
    "supabase secrets",
    "supabase projects delete",
    "Read(./.env)",
  ]) {
    assert.ok(settings.includes(denied), `the deny set must still contain "${denied}" after re-baseline`);
  }
});
