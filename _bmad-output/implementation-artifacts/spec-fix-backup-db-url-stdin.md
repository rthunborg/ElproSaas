---
title: 'Fix backup database URL stdin validation'
type: 'bugfix'
created: '2026-09-15'
status: 'done'
route: 'one-shot'
baseline_commit: '5509e564ba6bf192ff2ab4c7d87669317418c8d8'
---

# Fix backup database URL stdin validation

## Intent

**Problem:** The backup activation workflow pipes `SUPABASE_BACKUP_DB_URL` to the validator, but Node 22 rejects `fs/promises.readFile(0, 'utf8')` before the URL policy can run.

**Approach:** Consume the inherited stdin stream as UTF-8 text, retain the existing exact URL policy, and prove the executable accepts approved streamed input while rejecting a forbidden parameter safely.

## Suggested Review Order

### Streamed workflow input

The executable now consumes the process stdin stream before applying the existing fail-closed URL policy.

- `scripts/ops/validate-backup-db-url.mjs:28` — `main`: drains UTF-8 stdin and validates only after EOF.

### CLI boundary evidence

The regression starts the actual Node executable, splits input across chunks without a newline, and captures every observable stream.

- `tests/unit/ops/pilot-operations.test.ts:17` — `runBackupDbUrlValidator`: bounds spawned CLI execution and records exit/output state.
- `tests/unit/ops/pilot-operations.test.ts:132` — `backup database URL validator accepts`: accepts both approved direct and shared-pooler URLs.
- `tests/unit/ops/pilot-operations.test.ts:146` — `backup database URL validator rejects`: preserves safe nonzero rejection.

**Evidence:** `node --experimental-strip-types --import ./tests/support/register.mjs --test tests/unit/ops/pilot-operations.test.ts` passed 14/14; `pnpm typecheck` passed. The CLI test uses synthetic URLs and does not exercise a real backup or GitHub Actions secret pipe.
