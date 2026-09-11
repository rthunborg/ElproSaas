---
status: blocked
---

# BMad Build Auto Result

Status: blocked
Blocking condition: dirty working tree

## Auto Run Result

Status: blocked
Blocking condition: intent gap

Unanswered questions:

- Which membership lifecycle states must count toward each role's member count in the Roles view: active only, active plus invited, active plus invited and disabled, or another explicitly defined set? Ended history must be retained, but the supplied story and current planning sources do not define whether it contributes to the displayed count.

Evidence gathered:

- Story 11.4 requires the five seed roles to show member counts, while the Epic 11 test-design artifact explicitly marks the count semantics as "to pin" and requires counts to obey the decided active/invited/disabled/ended semantics.
- The current Epic 11 context requires counts but does not choose a lifecycle-state set. Each candidate set changes the visible count and the generated unit/integration evidence.
