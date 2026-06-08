# Definition Of Done

## Applies To All Work

A change is done only when:

- Scope is tied to Phase A or an explicit approval for later-phase work.
- Product work is linked to an approved Phase A story or ADR-backed task.
- Files changed are limited to the task.
- Documentation is updated if behavior, process, security, or architecture changed.
- Verification steps are run or explicitly documented as not run.
- Security and tenant isolation impact is stated.
- No `.env` changes are made.
- No dependencies are added unless explicitly approved.

## Process/Documentation Work

Done means:

- New docs have clear status and ownership assumptions.
- Links to the baseline plan or ADRs are correct.
- Instructions are actionable and not vague.
- Any uncertain tool syntax is called out.
- No product code, migrations, or dependencies are changed.

## Phase A Product Work

Phase A product work is not currently authorized by this task. When authorized later, done means:

- Clean install passes.
- Typecheck passes.
- Lint passes.
- Unit tests cover changed money/tax/quote lifecycle behavior.
- Integration tests cover changed commands.
- RLS cross-tenant negative tests cover changed tenant-owned data.
- Migration reset passes when migrations are involved.
- No service-role access from client paths.
- No unauthenticated privileged functions.
- Acceptance criteria in the approved story are met.

## Reviews

Review completion requires:

- Findings listed by severity.
- File and line references where possible.
- Test gaps called out.
- Deferred-scope violations called out.
- Residual risks stated.
