# Sprint Change Proposal — 2026-10-07

Phase B / Legacy Parity Release. Mode: batch, resolved from the owner's autonomous preparation request. Classification: moderate backlog/sequencing adjustment. Status: owner intent approved; 19.1 specification independently reviewed at High and approved for ready-for-dev; E20 checkpoint prepared with explicit remaining conditions. This record does not assert completed technical review, product implementation approval beyond the recorded owner direction, or completed checkpoint conditions.

## 1. Issue and evidence

The owner approved continuing the E14 loop while preparing one additional worker for a useful independent slice: dashboard framework with a live quote pipeline, followed by concrete early Documents sequencing and full stories. The canonical plan previously placed all six dashboard widgets in 19.2 and all B2 candidate expansion at the B1b→B2 checkpoint. A framework-only19.1 would lack its requested live slice; interpreting early Documents as general B2 admission would bypass PB-D10 and AC-B2-8. These planning conflicts trigger this correction; no failed product implementation is alleged.

Inputs: `epics-phase-b.md` (E19/E20; Cross-Epic Rule6), `prd-phase-b.md` (FR107–109, AC-B1b-8, AC-B2-2/8, PB-D10), architecture §§5/9.3/12/16 (manifest, schema checkpoint, entity-scoped files, tests), UX §4.10 and Documents patterns (registry, WidgetCard, filter/search aggregation), AGENTS.md and project context. The `bmad-correct-course` base customization has no activation steps or terminal action; config selects expert English documents. Team customization is absent. Scope/technical assumptions are subject to the independent High specification/checkpoint delegates.

## 2. Impact

| Area | Change | Retained obligation |
| --- | --- | --- |
| E14 | Continue current implementation loop | Existing story, review, and test gates |
| E19.1 | Framework plus live `Offertpipeline` from E10 | Manifest traceability, server authorization, WidgetCard states, responsive UX |
| E19.2 | Five widgets: Uppföljningar, Veckans bokningar, Konflikter, Aktiva jobb, Tidläget | Complete all five on live authorized B1 data; E19 remains incomplete |
| E20 | Prepare full stories and a bounded early checkpoint | Requirements/schema/oracle/story review recorded before eligibility; same-PR activation |
| Other B2/B3 | No sequencing authorization | Normal PB-D10 coarse-FR expansion, full stories and wave gates |

FR107/108 and the complete six-widget obligation stay intact; the dashboard story boundary changes. FR109 keeps PB-D6 aggregation over existing entity-scoped metadata, no new storage model. E20 remains B2. No architecture choice, new epic, Phase C feature, code, infrastructure, migration, environment variable, deployment, or credential is changed by this package. Full Documents requirements and story specifications belong to the checkpoint and companion story artifacts; coarse text alone is not build-ready.

## 3. Recommended approach

Direct adjustment is selected. Preserve E14 momentum, prepare dashboard19.1 for the one additional worker, and prepare E20 before conditional dispatch. This does not reduce parity scope or replace the overall MVP. Rollback of completed product work provides no benefit and is not proposed. A full MVP replan is unnecessary.

Planning effort: moderate; implementation estimates remain story-owned. Timeline effect: permits independent preparation and potentially a narrowly admitted E20 slice, without claiming a date or capacity gain. Risks: accidental premature B2 admission; framework treated as E19 completion; pending modules or unauthorized metadata/amounts leaking into aggregation; parallel edits conflicting with the E14 loop. Mitigation: bounded eligibility record, five explicit retained widgets, independent High authorization/file/money review, isolated ownership, existing manifest and tenant-negative gates.

Rollback of this sequencing decision means hold undispatched19.1/E20 work and restore the normal wave sequence through a recorded planning amendment. It does not revert shipped product, remove data, or weaken existing controls. Already dispatched work requires reconciliation with its current owner before changing its instructions.

## 4. Exact canonical amendments

**E19 story boundary.** Before:19.1 registry/framework;19.2 six widgets including Offertpipeline. After:19.1 registry/framework plus only Offertpipeline, with full specification delegated to dashboard_spec;19.2 retains the other five named widgets. Rationale: a useful live slice using already available quote data, with no scheduling/jobs/time placeholders. E19 is not complete after19.1.

**PB-D10 / AC-B2-8.** Before: all B2 coarse FR expansion and full story preparation at B1b→B2. After: E20/FR109 alone may use [the early Documents checkpoint](early-b2-documents-checkpoint-2026-10-07.md), conditional on recorded requirements expansion, schema review, oracle disposition and full-story review before implementation eligibility. FR110–FR118 and the formal B1b exit remain under normal gates. Rationale: permit concrete early preparation without granting general B2 access.

**E20 entry.** Before: three candidate stories. After: candidate scope retained as traceability and linked to full companion stories/checkpoint; preparation approved, technical review completion not claimed. E20 activation, nav swap, and source-module eligibility remain the reviewed implementation contract. The checkpoint must identify its own review evidence rather than infer completion from this amendment.

## 5. Handoff and success criteria

1. Root coordinator owns sprint status, dispatch plan, final consistency checks, Git/PR operations and user-facing review package. No delegate edits those artifacts.
2. dashboard_spec owns the full19.1 story and sensitive authorization/money read boundaries on Sol High. Retain E19.2's five-widget obligations and exact existing quote read-model semantics.
3. Documents checkpoint/spec delegate owns the E20 checkpoint, concrete FR109 expansion, schema/oracle disposition, and full20.1–20.3 stories on Sol High. Record evidence and unresolved conditions honestly.
4. One additional implementation worker initially may receive the reviewed eligible slice through the root dispatch plan. The first operational lane is bounded single-story `auto-bmad --story 19.1` in a dedicated worktree; it is not a full Epic19 loop. The whole-epic parallel adapter must not receive an invented complete epic plan while19.2 downstream contracts remain unready. The stable story key is `19-1-widget-registry-and-dashboard-framework`; its full specification is `../implementation-artifacts/spec-19-1-dashboard-framework-and-quote-pipeline.md`. Preparation of E20 is not an instruction to start other B2 epics or concurrent extra workers.
5. Independent review verifies final specifications and conditional admission. Implementation authors subsequently supply story review order and required evidence, including executed/skipped database and role/tenant negatives where applicable.

Success: canonical boundary changes agree with full stories; only the quote widget moved; all five retained widgets remain scheduled; E14 continues; E19 is not closed; E20 eligibility is explicit and evidence-backed; no general wave gate or Phase C exclusion is waived. This document is a preparation handoff, not evidence of production readiness.

## Checklist disposition

[x]1.1–1.3: stakeholder sequencing trigger, precise conflict and canonical evidence recorded. [x]2.1–2.5: E14/E19/E20 and remaining epics evaluated; no removal, renumbering or new epic. [x]3.1–3.4: PRD/epics amendments specified; architecture/UX contracts retained; sprint status/dispatch owned by root. [x]4.1/4.4: direct adjustment viable. [N/A]4.2/4.3: no product rollback or MVP reduction. [x]5.1–5.5: issue, impact, sequence, risks and handoff recorded. [x]6.1–6.2: bounded review package prepared. [x]6.3: prior owner intent approval recorded without inventing completed review. [x]6.4: root aligned sprint notes and promotes reviewed 19.1 only. [x]6.5: concrete single-owner handoff records configured-base/CI/ownership gates; E20 specification/oracle closure and implementation eligibility remain explicitly outstanding.

Independent review found no material 19.1 scope/security/money contract gaps. The handoff now requires configured git.base_branch to contain both the accepted workflow and reviewed preparation before ordinary Auto-BMAD Phase 1. No product execution or Epic 19 completion is claimed.
