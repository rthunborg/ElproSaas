# Author-written suggested review order

Status: project convention for future implementation stories and follow-up fixes.
Owner: implementation author; evidence expectations maintained by the Test Architect.

Every completed implementation story has exactly one `## Suggested Review Order`
in its implementation story/spec, outside the frozen intent/approval contract.
This is a reading guide, not approval or proof of correctness. Apply it to work
being implemented or fixed; do not backfill completed historical stories.

## Write for the reviewer

Use the [section scaffold](../../_bmad/custom/review-order-template.md). Usually
write 2–5 cohesive concerns, with 1–4 stops each; one concern is enough for a
small change. A concern explains a design intent, not a file or directory.

Start with the user-facing/public entry point (or the operator/configuration
entry point for process work). Follow the data flow and trust boundaries, then
finish with relevant tests and operational considerations. A file may recur
where it serves different concerns. Do not force every change into every layer.

Each concern contains a short `###` heading, 1–2 sentences explaining the
approach, and a few review stops. Use this form, with framing under 15 words:

```markdown
- `src/example.ts:42` — `exampleSymbol`: validates the caller before the write.
```

Paths are repository-relative, use `/`, and carry a verified, one-based line
number. Cite a declaration, branch, assertion, or documentation heading that
actually shows the concern. When useful, put its exact symbol or literal anchor
in the first code span after the em dash; the reference checker verifies that
literal on the cited line. This is a text anchor, not an AST symbol check. Put
additional explanation in the concern, not in a long stop label.

Describe alternatives and tradeoffs only when recorded by the author or backed
by repository evidence; cite the decision when it matters. Missing rationale is
unknown, not an invitation to invent a rejected design. Distinguish new behavior,
corrected defects, existing limitations, and unresolved decisions where relevant.
Do not imply an unresolved decision was accepted. Link to the existing spec,
decision, or finding instead of reproducing it. Keep the trail concise; it does
not replace the Code Map, acceptance criteria, test plan, PR description, or
review findings.

## Evidence responsibilities

| Role | Responsibility |
| --- | --- |
| Implementation author | Own the design rationale, choose stops from the final change, and write/refresh the section. A fix author owns the decisions introduced by that fix. |
| Test Architect | Define the risk-based evidence expectations here and in applicable test plans; distinguish tested boundaries from coverage gaps. Do not invent the author's rationale. |
| Reviewer | Resolve the stops against the final diff, verify the narrative and AC/invariant-to-test mapping, and return consequential mismatches to the author. Trail presence is not an approval criterion on its own. |
| auto-bmad root orchestrator | Delegate the work through its existing phase contract and consume structured results. Never read/edit story code or author/edit spec content to satisfy this convention. |

For important invariants and acceptance criteria, identify the relevant tests
at the corresponding concern or in the final evidence concern. State which
AC/invariant an assertion exercises, not simply that a suite passes. Record a
compact evidence summary or link to the existing Verification/Auto Run Result:
command, outcome, executed/failed/skipped counts when available, and the revision
or worktree state tested. Source inspection and reported historical runs must
be labeled separately from execution in this run.

State material limitations: mocked boundaries; synthetic fixtures or command
bodies; skipped suites; browser coverage narrower than the intended flow;
untested external services; and operational steps still required. A synthetic
envelope probe does not prove its production business-command body. A skipped
test is not evidence. Required local integration/RLS runs use
`SUPABASE_TEST_REQUIRED=1` and report actual execution counts. Do not start a
service or rerun a broad suite solely to decorate the trail. Reuse current,
relevant evidence and rerun checks when changes invalidate it.

## Author lifecycle

1. **Plan:** load this convention into the implementation spec's `context:` and
   preserve existing context entries. Planning can describe provisional concerns
   in planning notes or the Code Map. Do not add an empty final heading or guess
   future line numbers or test results. The exact heading makes checkpoint-preview
   select a trail even when its contents are only placeholders.
2. **Implement:** the implementation author writes the section after code and
   relevant verification exist, before handing work to review. Preserve the
   original intent and acceptance criteria. Add a concise Intent summary to a
   legacy story lacking one, grounded in its approved intent, for checkpoint use.
3. **Review/fix:** send patch findings back to the same author when available.
   Include this convention in every fix handoff. After each fix batch or
   re-derivation, refresh affected rationale, stops, tests and limitations against
   the final files. If a different builder applies fixes, that builder owns the
   new rationale and must reconcile it with recorded earlier decisions.
4. **Finish:** validate the current section and have the reviewer verify the
   final trail against the change. Replace the existing section in place; never
   accumulate sections for each pass. Follow the completion-hook protocol below
   for installed Build's additional generated section and late fixes.

These steps add no owner-confirmation checkpoint. Preserve existing authorization,
intent-gap and risk gates. A review-trail defect is repaired by an author within
the current story workflow. Do not create another broad code-review round just
to refresh line numbers; follow the project's existing review-round rules.

## Completion-hook protocol

The project `on_complete` hooks run inside the Build/Build Auto delegate, not in
the auto-bmad root. They are an idempotent final reconciliation:

1. If the workflow stopped before implementation, for planning approval, or with
   a blocked/incomplete result, preserve that result and do not manufacture a
   completed trail. Do not recursively invoke HALT or start another story.
2. For a completed implementation, re-engage its implementation/fix author
   synchronously with the spec path, final diff/baseline and existing verification
   evidence. The one-shot builder is itself the author. If the original author
   cannot be resumed, a builder that actually implemented the fixes may refresh
   its own decisions while preserving the earlier authored rationale. If no
   implementation/fix author is available, report author reconciliation unavailable;
   do not substitute a reviewer or call reconstructed guidance author-written.
3. The author ensures exactly one final section, using the scaffold. Installed
   interactive Build appends a generated section even if an author section
   exists: retain and refresh the author section, remove that generated duplicate,
   and preserve all other spec sections. For one-shot Build, enrich its own
   generated section. For Build Auto/follow-up fixes, refresh or create the
   section if it is missing. Only the author/fix delegate edits it.
4. Run `node scripts/verify/check-review-order.mjs "<implementation-spec.md>"`
   from the repository root. Repair reference errors, then have a reviewer
   inspect the final section against the diff and evidence. This is a narrow
   trail check, not a new broad review. Keep the author as the section's writer.
5. If reconciliation changed the spec after a workflow's local commit, include
   only that author's spec change in a separate local documentation commit when
   local commits are part of the active workflow's authorized contract. Do not
   amend unrelated commits, sweep unrelated files, push, or change release state.
   Report the final revision and check result through the existing completion
   summary/delegate contract. If commits are not part of that contract, report
   the uncommitted artifact normally.
6. If authoring or validation cannot finish, report **review trail check failed**
   and its concrete cause through the existing summary/residual-risk output.
   Do not claim this convention passed. Preserve the already-written terminal
   status; do not invent result fields or re-enter HALT/on_complete. This is a
   post-terminal advisory failure, not a reliable blocker for an unattended
   orchestrator. The missing pre-completion integration is recorded below.

## Workflow coverage and supported customization

Team files under `_bmad/custom/` are the supported upgrade-preserved surface.
Only exposed fields are used; the resolver merges base → team → personal.
Arrays append and scalar hooks replace, so keep future project hook additions
in the existing scalar rather than silently replacing them. Personal overrides
can supersede these fields: inspect resolved/rendered output after upgrades or
local customization changes.

| Execution path | Project integration |
| --- | --- |
| `bmad-build` planned implementation | Persistent convention + explicit implementation-author handoff; completion hook reconciles the installed generated section. |
| `bmad-build` one-shot | Same convention and completion hook; the direct implementer authors the small trail. No extra planning or approval step. |
| `bmad-build-auto` sprint/story or spec-folder dispatch | Same author handoff, context and completion hook, including patch and re-derivation refresh. Non-done exits do not require a trail. |
| `auto-bmad` story/epic runs and follow-up review/fix delegates | Inherit the Build Auto team override. The existing managed review-layer region remains intact. Root orchestration and phase ordering stay intact. |
| Deprecated create/dev/quick-dev entry points | Installed forwarders route into Build/Build Auto; use the target workflow overrides, not copies of old templates. |
| `bmad-spec` kernel and story breakdown | Planning-only persistent guidance: carry the convention as an adopted companion when downstream needs it; keep final trails in implementation story specs, not the derived kernel. |
| Standalone `bmad-code-review` / `bmad-review` | Load the convention; reviewers check final trail/evidence. Code Review's completion hook refreshes through the author only when the run implemented fixes. Read-only reviews never author rationale. |
| `bmad-checkpoint-preview` | Load the convention for provenance/limits; use its existing orientation and walkthrough, with no new confirmation step. |

The reusable template is a **section scaffold**, loaded by the author via the
handoff/convention. It is not a replacement for Build's entire spec template.
Build and Build Auto do not expose `spec_template`; their templates are snapshot
references. `bmad-spec` exposes that field, but its template is the five-field
derived kernel, not the implementation story. Swapping it would solve the wrong
problem and risk overwriting author execution evidence on a future derivation.

### Installed integration limits

BMAD 6.11.0 has no exposed before-done or after-patch callback and no supported
per-step template/step replacement for Build. Its completion hooks run **after**
the usual status/commit/presentation writes (Build Auto: after HALT's result
write). The protocol above therefore repairs the final artifact via a supported
hook; it is not an atomic pre-status gate. Early presentation may briefly show
the generated trail. A hard guarantee that no intermediate `done` or generated
trail is ever visible requires an upstream hook or a separately approved custom
workflow. No installer-owned workflow or auto-bmad root was patched here.

Author re-engagement is also host-dependent, not guaranteed by BMAD. A failed
post-terminal check cannot safely roll back the installed terminal protocol;
it reports a limitation while preserving that status. This convention is a
project authoring/DoD requirement with a best-effort completion repair, not a
machine-enforced guarantee that every automatically marked-done story complies.
Test hook execution in the actual host; use the separate integration decision
above if strict unattended enforcement is required.
Hook text names the existing runtime spec variable; inserted custom prose is
not recursively placeholder-expanded by the renderer.

Likewise, the checker can verify references, not authorship, design judgment,
test adequacy, or agent compliance. Unknown author intent remains explicit.
Checkpoint-preview has instruction-driven consumption, not a callable trail
parser. It selects `full-trail` by the exact H2, then resolves stops and reads the
diff. It accepts these repository-relative `path:line` stops; the rich concern
format follows its Walkthrough format. A fallback-generated trail must never be
reported as an author-provided one.

For spec-folder runs, provide checkpoint-preview with the implementation story
file plus the actual process-change PR, commit, or baseline needed to read its
diff. Its automatic enrichment searches implementation/planning artifacts;
Build Auto may record `baseline_revision` and kernel stories may live elsewhere.
Verify the supplied revision with Git rather than guessing or silently using
`HEAD~1`. Do not embed a fixed branch baseline in reusable guidance or copy
kernel content just for discovery.

## Targeted reference validation

```powershell
node scripts/verify/check-review-order.mjs "path/to/current-implementation-spec.md"
node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/scripts/verify/check-review-order.test.ts
```

The checker targets named files only, ignores fenced examples, and checks the
section, concrete stops, repository containment, file existence, line ranges
and optional literal anchors. It intentionally does not score prose, enforce a
concern count, or sweep historical stories. Recheck after fixes/rebases move a
stop; never auto-update a line merely because a similarly named symbol exists.

See the [completed process-change example](examples/review-order-workflow.md) and
[verification record](../quality/review-order-verification.md) for the installed
consumer walkthrough, execution evidence, and upgrade checks.
