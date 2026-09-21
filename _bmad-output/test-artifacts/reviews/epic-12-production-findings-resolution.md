# Epic 12 Focused Production Findings Resolution — 2026-09-21

## Scope and authority

This follow-up is limited to the two production candidates from the independent
Epic 12 review at frozen head `fa76fedea678bd0455fce15906eb4c127da5f848`:

1. concurrent reuse of one provisioning request ID with different canonical
   content can escape the required `IDEMPOTENCY_CONFLICT` result; and
2. the Swedish organisation-number guard may apply the wrong date shape.

The approved oracle is Story 12.1 AC3/AC4 and its Owner-Approved V1 Contract.
No new identity policy, registry lookup, legal/tax policy, provider behavior, or
Phase C surface was introduced.

## Finding 1 — confirmed: concurrent request-ID conflict misclassification

**Reachable caller and bypass.** An authenticated, allow-listed platform
operator can approve the same `request_id` from two tabs or retry with changed
canonical company/admin content. Both calls carry otherwise valid server HMAC
attestations. When the second call's initial request lookup precedes the first
commit, the effective RPC can later observe only the canonical organisation
collision and return `ALREADY_PROVISIONED`, or rethrow raw request-key
uniqueness for a different organisation. No database constraint or command
wrapper restores the required same-ID/different-hash result.

**Deterministic reproduction.** The new `12.1-INT-006-R1` regression executes
the winner inside an authenticated database transaction, leaves its tenant and
request uncommitted, starts the differently hashed loser through a separate
authenticated Supabase client, and confirms that the loser is blocked by the
winner before committing. Against the loopback pre-migration database at
`127.0.0.1:54321` / `127.0.0.1:54322`, the loser returned
`ALREADY_PROVISIONED`; the assertion correctly failed.

**Repair.** Append-only migration
`20260921170545_repair_provisioning_idempotency_conflict.sql` preserves the
reviewed RPC body and changes only its conflict ordering. An existing request
ID is now evaluated before organisation identity in both possible visibility
windows: the pre-insert identity lookup and the `unique_violation` handler.
Same ID/same hash returns `REPLAYED`; same ID/different hash raises
`IDEMPOTENCY_CONFLICT`; only a different request ID for an existing canonical
identity returns `ALREADY_PROVISIONED`. The migration fails loudly if either
reviewed function-body seam changed and reapplies the approved owner/grants.

## Finding 2 — partly confirmed: valid legal entities were rejected

The independent finding's personnummer-admission explanation is not supported
by the effective regex. Because its first two digits are optional, one regex
alternative already matches the actual `YYMM` prefix and rejects ordinary
checksum-valid `YYMMDD-NNNN` values. Deterministic inspection returned `null`
for checksum-valid `8501011236` and `8502151239`.

The same optional prefix creates a second, incorrect date window over later
organisation-number digits. That branch rejected structurally valid legal
entity values such as checksum-valid `5560000001`, while `5566770003` happened
to pass. This is a production correctness defect because a valid company can be
blocked before preview and no downstream database validator repairs it.

The replacement follows the primary Swedish structural rule: remove spaces and
hyphens, require ten digits, require the third digit to be at least 2, and check
the Luhn digit. Skatteverket states that organisation numbers have ten digits,
the final digit is a check digit, and the third digit is always at least 2 to
avoid confusion with personnummer. Skatteverket separately defines a
personnummer's first six digits as year, month, day. Bolagsverket confirms that
sole proprietors use personnummer rather than organisation numbers:

- [Skatteverket — Organisationsnummer](https://www4.skatteverket.se/rattsligvagledning/edition/2026.5/326447.html)
- [Skatteverket — Personnummer](https://www.skatteverket.se/privat/folkbokforing/personnummer.4.3810a01c150939e893f18c29.html)
- [Bolagsverket — Organisationsnummer](https://bolagsverket.se/foretag/organisationsnummer.1207.html)

This preserves the owner-approved exclusion of personnummer-shaped identities
without attempting calendar validation, registry verification, samordningsnummer
policy expansion, or another identity model.

## Changed paths

- `src/server/commands/provisioning/validation.ts`
- `supabase/migrations/20260921170545_repair_provisioning_idempotency_conflict.sql`
- `tests/unit/provisioning/provisioning-contract.test.ts`
- `tests/integration/commands/provision-tenant.int.test.ts`
- `_bmad-output/implementation-artifacts/spec-12-1-platform-operator-identity-and-the-provision-tenant-command.md`
- this resolution record

## Evidence and closure

- Provisioning unit contract: 19 passed, 0 failed, 0 skipped. The new cases
  accept `5560000001`/`5566770003` and reject checksum-valid
  `8501011236`/`8502151239`.
- Targeted ESLint: passed with no findings for the three changed TypeScript test
  and production files.
- `git diff --check`: passed for the focused changes.
- Deterministic integration regression on the pre-migration loopback database:
  9 passed and the new case failed RED with observed
  `resultCode: ALREADY_PROVISIONED`. The local database was not reset or migrated.
- Supabase CLI `2.115.0` created the append-only migration. The current Supabase
  breaking-change index and database-function/migration documentation exposed no
  change affecting this PostgreSQL function repair.

Root-owned clean verification at source commit
`6edbd2d9021310b202ab0e4fc828522d4bcf20b5` passed typecheck and focused lint;
the full unit suite passed 1,837/0/1, with the existing skip excluded from
coverage. [CI run 35631411549](https://github.com/rthunborg/ElproSaas/actions/runs/35631411549)
passed verify, database, browser, and recovery jobs, including the isolated
migration/integration runtime gate.

The independent in-app `gpt-5.6-luna` / `xhigh` focused P1 review is recorded
under `## Focused P1 closure — production fixes at acf6625…` in
`_bmad-output/test-artifacts/reviews/epic-12-independent-review-2026-09-21.md`.
It reviewed frozen tree `acf6625fc1a0073aba8396ed05cf57d584f7eaef`, whose
source content matches commit `6edbd2d9021310b202ab0e4fc828522d4bcf20b5`,
accepted the narrower validator adjudication, and found zero new findings or fix
regressions. The owner accepted the review and runtime evidence. Story 12.1's
`followup_review_recommended` flag is therefore false.

This author did not target the hosted/demo project, launch or reset services,
commit, push, or alter code, tests, migrations, git state, or Auto-BMAD state
during this final metadata closure. Historical external CLI failures remain
preserved in the Story 12.1 evidence and are not counted as review evidence.
