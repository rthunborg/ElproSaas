# Implementation-author section scaffold

Use with `docs/process/review-order.md` after implementation. Planning may name
provisional concerns separately; do not paste this unfilled block into a story.
Replace all placeholders, remove unused groups, and retain exactly one final
H2. Start at the entry point, follow data/trust boundaries, end at tests/ops.

```markdown
## Suggested Review Order

Author: <implementation/fix author>.
Refreshed against <verified revision or described final working tree>.

### <Cohesive user-facing concern>

<Why this approach, in 1–2 sentences. Link a material recorded decision when useful.>

- `<repository-relative path>:<verified line>` — `<literal symbol on that line>`: <brief role>.
- `<repository-relative path>:<verified line>` — <brief boundary or decision>.

### <Supporting concern, only if needed>

<Why this approach. Identify new behavior or a corrected defect where relevant.>

- `<repository-relative path>:<verified line>` — `<literal anchor>`: <brief role>.

### <Evidence and operational concern, or fold into a small single concern>

<Important AC/invariant → what the relevant assertions exercise.>

- `<test path>:<verified line>` — `<literal test anchor>`: <AC/invariant exercised>.

Evidence: <command/outcome/counts or a link to current Verification evidence>.
Limits: <mocked/synthetic boundaries, skipped tests, untested external services,
existing limitations, unresolved decisions and operational follow-up as applicable>.
```
