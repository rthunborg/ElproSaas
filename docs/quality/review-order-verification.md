# Review-order convention verification

Verified 2026-09-12 against the final process-change working tree. This record
is authored for this change; no historical story was edited. It intentionally
contains no fixed baseline so the convention can be applied on main and open
implementation branches.

## Intent

Make future completed implementation stories carry an author-written review
order that explains design concerns, points to final code, and states evidence
limits. Use supported project BMAD customizations, preserve author/reviewer
ownership and auto-bmad's orchestration boundary, and add targeted reference
validation without changing the application or adding an owner checkpoint.

## Installed sources inspected

- `_bmad/_config/manifest.yaml`: BMAD/BMM **6.11.0**, TEA **v1.23.3**.
- `.agents/skills/auto-bmad/assets/module.yaml`: auto-bmad **0.31.0**; the
  install manifest labels the custom module `main` on channel `next`.
- Project `AGENTS.md`, process workflow, definition of done and project context.
- Build/Build Auto templates, planning, implementation, review/patch branches,
  one-shot presentation, completion and HALT; deprecated forwarding entry points.
- `bmad-spec`'s five-field kernel, companion ownership and story breakdown;
  checkpoint-preview's orientation, walkthrough and fallback trail instructions.
- Customization defaults, resolver and snapshot renderer. Only fields exposed in
  each installed `customize.toml` are used. Build's spec template has no exposed
  template-swap field; the project supplies a section scaffold instead.

## Executed verification

| Check | Result |
| --- | --- |
| Resolve all seven team overrides with installed `load_customization` | All resolve; fields are present in each skill's exposed defaults. Existing context facts remain. |
| Render Build and Build Auto with installed `render_skill.py` | Both succeed. Rendered implementation steps contain the author handoff/scaffold; terminal steps contain the completion protocol. |
| Compare auto-bmad's managed override region with HEAD | Unchanged. All six resolved review layers remain, including security and cross-model layers. |
| Reference checker unit tests | **6 passed, 0 failed, 0 skipped**. Missing/duplicate/fenced trails, missing targets, stale lines, moved anchors, section boundaries, file errors and a real Windows junction escape are exercised. |
| Completed process-change example | **9 references valid**; files, one-based lines and supplied literal anchors resolve against the process-change tree. |
| Current process author's trail | **8 references valid**, two concerns; source-driven checkpoint orientation selects `full-trail` and does not invoke fallback generation. |
| Supporting validator syntax and focused lint | `node --check` and ESLint on the new validator/test files pass. |
| Whitespace/error check | `git diff --check` passes. |

Commands, from the repository root:

```powershell
python _bmad/scripts/resolve_customization.py --project-root . --skill .agents/skills/bmad-build --key workflow
python _bmad/scripts/resolve_customization.py --project-root . --skill .agents/skills/bmad-build-auto --key workflow
python _bmad/scripts/render_skill.py --project-root . --skill .agents/skills/bmad-build
python _bmad/scripts/render_skill.py --project-root . --skill .agents/skills/bmad-build-auto
node scripts/verify/check-review-order.mjs docs/process/examples/review-order-workflow.md docs/quality/review-order-verification.md
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/scripts/verify/check-review-order.test.ts
node --check scripts/verify/check-review-order.mjs
.\node_modules\.bin\eslint.cmd scripts/verify/check-review-order.mjs tests/unit/scripts/verify/check-review-order.test.ts
git diff --check
```

The installed resolver/renderer were called with the available Python runtime;
no packages were installed. Rendered snapshots are ignored generated files. A
renderer stdout instruction to run the workflow was not executed: rendering
was a compatibility check, not authorization to implement a new story.

## Checkpoint-preview discovery demonstration

Supply this record or the [completed process-change example](../process/examples/review-order-workflow.md)
explicitly as the review spec, together with the actual PR, commit, or baseline
for the change under review. Installed orientation step 1 takes the explicit
spec and `DETERMINE WHAT YOU HAVE` selects `full-trail` because the supplied
file contains the exact H2 below. Intent comes from its Intent section. The
provided trail belongs to this process change's authors; fallback generation is
not needed. Walkthrough consumes its concern groups and repository-relative
`path:line` stops, then reads the supplied diff. Discovery by heading does not
authenticate authorship or certify quality.

## Limits and upgrade follow-up

This is a source-driven checkpoint orientation/walkthrough demonstration and
real reference/test execution, not an unattended production epic run. BMAD has
no executable checkpoint trail parser. The validator's `full-trail-candidate`
label deliberately does not claim to execute the skill or prove authorship.

No application/browser/database/external-service run was performed for this
process change. The focused checker tests use synthetic files and temporary
paths; their passing result is not live tenant-isolation or business-mutation
evidence. The example records that boundary explicitly.

Completion-hook reconciliation is supported freeform agent instruction, but it
runs after built-in status and commit writes. The original author may also be
unavailable on some hosts. A strict pre-done gate, guaranteed author resumption,
and an atomic hook-failure result need an upstream extension or a separately
approved custom workflow. Current hooks are not evidence of those guarantees.
See [installed integration limits](../process/review-order.md#installed-integration-limits).

After a BMAD upgrade or personal override, rerun resolution and rendering,
inspect the handoff/completion call sites, and repeat explicit-spec checkpoint
discovery on a current author trail. Do not enforce the upstream prose verbatim.
Do not sweep or repair historical stories as an upgrade check.

## Suggested Review Order

Author: implementation authors of this process change. Refreshed against the
current process-change working tree; this section is a reading guide only.

### Carry author ownership through the workflow

Project instructions make the convention visible to future authors. Team TOML
overrides were chosen because the installed resolver preserves them across
upgrades; the late completion hook reconciles Build's generated duplicate while
keeping spec writing inside implementation/fix delegates.

- `AGENTS.md:31` — enters the future-story authoring convention.
- `_bmad/custom/bmad-build.toml:4` — `implementation_handoff`: passes ownership and evidence expectations to the author.
- `_bmad/custom/bmad-build-auto.toml:12` — `on_complete`: applies final reconciliation within the delegated story run.
- `docs/process/review-order.md:97` — `Completion-hook protocol`: preserves ownership and discloses post-terminal failure limits.

### Detect stale references without claiming correctness

The checker reads only explicitly named documents and verifies concrete targets
and optional literal anchors. That catches stale stops without trying to grade
prose; reviewer judgment still establishes whether the trail matches the change.

- `scripts/verify/check-review-order.mjs:31` — `parseSuggestedReviewOrder`: excludes fenced examples and ends at the next major section.
- `scripts/verify/check-review-order.mjs:171` — `validateSuggestedReviewOrder`: checks current files, lines and literal anchors.
- `tests/unit/scripts/verify/check-review-order.test.ts:61` — `colon-delimited literal anchor`: catches a moved symbol in the documented format.
- `tests/unit/scripts/verify/check-review-order.test.ts:72` — `symlink outside the repository`: checks file errors and a real junction escape.

Evidence: six checker tests and all cited references pass; commands are recorded
above. Limits: this does not prove author intent, test adequacy or unattended
hook execution. The late-hook/author-resumption limitation remains an upstream
integration decision.
