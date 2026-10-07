# Project agent model routing

Owner decisions: 2026-10-06 and 2026-10-07. Codex primary agents, named roles,
generic/nested subagents and external reviewers default to `gpt-6.1-sol`.
Non-sensitive planners, coordinators, readiness assessors and task-decomposition
agents may instead use `gpt-6-astra` with `low` effort (UI: GPT-6 Astra Light).
This is an allowed alternative, not a change to the project default. Ordinary
BMAD development **and review** start at Low, including planning, implementation,
follow-up review and independent review. The owner starts Auto-BMAD at Low and
has already authorized autonomous effort selection and escalation. Never ask
permission just to select or increase effort. This supersedes older model,
same-effort inheritance and automatic High-for-all-review instructions.

| Effort | Work |
| --- | --- |
| Low | Ordinary development, planning, review, mechanical edits, documentation and triage |
| Medium | A non-sensitive Low attempt needs additional reasoning |
| High | Tenant isolation, tenancy/provisioning, RBAC, permissions, authentication/authorization, security/RLS, secrets/public-token boundaries, money/tax, transactional integrity and critical conflict resolution |

Classify the **actual task or diff**. Changing or reviewing tenant boundaries,
RLS policies, permission checks or privileged entry points requires High.
Routine work using existing validated tenant/permission helpers does not become
High merely because this is a multi-tenant app or its context contains security
boilerplate. If investigation discovers a sensitive boundary, escalate before
implementing, judging or fixing that part. Mixed tasks use High for the sensitive
scope; do not drop required coverage or weaken a validator to keep work at Low.

## Automatic dispatch from a Low session

`.codex/config.toml` sets the primary and generic-subagent model to
`gpt-6.1-sol` and effort to Low. Named roles are explicitly registered there.
Money and security roles remain High; ordinary PR, scope and test-gap reviews
start at Low. A leaf-only reviewer reports newly discovered sensitive scope as
facts to its parent; the parent routes that scope at High without a permission
question. Oracle exploration retains its Medium role setting.

The running primary agent's inference effort cannot be changed by editing a
file. A Low orchestrator **spawns a generic, context-free High delegate** for
sensitive work, explicitly setting `model="gpt-6.1-sol"`,
`reasoning_effort="high"`, `fork_turns="none"`. It waits synchronously and uses
the result. Carry the task, ownership, approved scope, evidence paths and this
policy into the prompt. A delegate already dispatched at the chosen effort does
its task there; it does not recursively delegate solely to change effort.

Every nested implementation/review handoff selects its own appropriate effort;
never cap a sensitive child at the Low parent's effort. If a Low worker discovers
sensitive work after dispatch, it hands off that scope at High and reports the
selected effort and reason in its existing result. Already authorized effort
changes do not introduce a human checkpoint. All other authorization, sandbox,
resource, merge and quality requirements continue to apply.

Project config provides defaults; explicit session selections can override them.
Start a fresh chat after changing roles. Existing chats/spawned agents are not
retroactively reconfigured. Codex ignores named `profiles` in project-local
config; for an explicit CLI launch use `-c model_reasoning_effort="high"` or the
subagent's explicit effort argument instead of a project-local `--profile`.

## Auto-BMAD routing

The live settings are `_bmad-output/auto-bmad/config.yaml`; the two installed
Auto-BMAD copies carry matching defaults. `default`, `light`, `standard` and
`diverse_review` use Low. `critical` uses High. The security layer is inherently sensitive and stays High. Final settling
is Low unless its actual scope involves sensitive domains or critical conflict;
its phase name alone does not force High. Ordinary follow-up/independent review and epic test work use Low unless
their actual scope requires High. Historical profile/layer identifiers remain
for compatibility, but implementation, review and test execution routes continue to use Sol 6.1.

Before each dispatch, assess risk from the approved task/context and any current
scope facts. The orchestrator's no-code-reading rule remains: its planning/build
or review delegates inspect actual files and escalate when discovery requires
it. `effort_policy.py` resolves the assessed domains deterministically; it does
not infer risk from keyword scans or launch agents:

```powershell
python .agents/skills/auto-bmad/scripts/effort_policy.py --phase followup_review
python .agents/skills/auto-bmad/scripts/effort_policy.py --phase build --risk-domain rbac --risk-domain tenant-isolation
```

The first returns Low; the second returns High. Supported sensitive domains:
`tenant-isolation`, `tenancy`, `provisioning`, `rbac`, `permissions`,
`authentication`, `authorization`, `security`, `rls`, `secrets`, `public-tokens`,
`money-tax`, `transactional-integrity`, `critical-conflict`. Unknown domains fail
closed. `--retry` selects Medium for unresolved non-sensitive work;
`--current-effort` retains an in-flight effort floor on resume. For a Codex CLI
route, pass the actual `--host`, `--tier` and `--route cli:codex`.

Persist the returned nine-key capsule with `state_update.py route-select` before
launch. Low-to-High escalation is immediate and owner-authorized; record its
reason, with no intervening Medium run or permission prompt. Do not lower effort
within the same in-flight task; later independent ordinary tasks can start Low.
Keep completed historical state and ledgers intact.

For CLI-routed phases, pass the resolved effort to `cli_delegate.py
--codex-effort high` (or low/medium) so the command's setting matches the persisted
capsule. The external independent review defaults to Low; its generated
instruction authorizes replacing only the effort value with High for sensitive
diffs. Keep the same model and read-only sandbox.

The developer persona, Build, Build Auto and Code Review customization files
load this policy. Delegate prompts carry it through all nesting. Re-run
`/auto-bmad reprovision` after profile/template changes. BMAD reinstall can
replace installed tooling; reconcile it with this owner policy before running.

## Optional Astra planning and coordination

Select GPT-6 Astra Light when starting a fresh planning/coordinator chat, or
explicitly dispatch a generic planning subagent with model `gpt-6-astra` and
reasoning_effort `low`. Do not use a named implementation/review role for this.
Astra may inspect readiness evidence, decompose work, schedule assignments and
coordinate results. It must explicitly dispatch implementation, review, test
execution and integration repairs to Sol under the existing effort policy.
Sensitive planning judgments also go to Sol High without asking permission.

For recorded planning handoffs, route-select accepts Astra Low only for phases
`planning`, `coordination`, `readiness` and `task_decomposition`. Supply the
explicit nine-key route capsule; effort_policy.py continues to select Sol for
its existing execution phases. Worker submission evidence still records Sol
implementation/review routes; it does not substitute a coordinator model for
the model that actually performed the work. The parallel coordinator itself
has no model lock in its shared claim store.

If an Astra planning task needs more reasoning, delegate to Sol Medium for
non-sensitive work or Sol High for sensitive work and record the reason.
Light is the UI label; configuration and API arguments remain `low`.
Existing sessions are not reconfigured by this policy update.
