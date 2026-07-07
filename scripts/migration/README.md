# `scripts/migration/` — Lovable fixture capture (Story 9.2)

Local, test-oriented, **repeatable** helpers for producing the anonymized Lovable golden fixtures
under `tests/fixtures/golden/lovable/**`. This is the architecture §16 home for "approved, testable
data capture/reset scripts when a migration story exists" — Story 9.2 is that story for capture
(Story 9.1 deferred creating `scripts/migration/**` to a real capture story).

## Scope / hard constraints

- **LOCAL / TEST-ORIENTED only.** No network, no DB, no real Lovable connection, no global/system
  change, no dependency add. Nothing here runs on the app runtime path (`src/**`) — these assets are
  kept OFF the runtime path per AR25 / R-919.
- **Synthetic input only (Story 9.2 Stop Condition).** The input for this story is
  synthetic/representative sample data — NOT a live real-Lovable pull. The real-capture record
  SELECTION (which real Lovable records become the oracle) is owner-gated (Sign-Off 8.1/8.2,
  `öppen (möte)`), and any real customer-data export/import is a **HARD STOP** requiring owner
  sign-off. The script proves the anonymization + capture pipeline works and is repeatable;
  backfilling real captured values happens later with **no fixture-schema change** (the three-way
  `origin` already accommodates a real `old-lovable` case).
- **Zero real PII, anonymized AT SOURCE (R-901/R-902).** `anonymizeRecord` maps real → synthetic
  BEFORE anything is written to disk or a log; a raw value is never written or echoed. Use
  `captureLog({...})` for progress output — it logs **counts/ids only** ("anonymized 12 customers"),
  never a raw name/email/personnummer.

## `lovable-capture.ts`

Exports a **pure, deterministic** `anonymizeRecord(record)` and a `captureLog(counts)` helper.

- `anonymizeRecord` returns a fresh deeply-anonymized copy (it never mutates its input), classifying
  each field by key-name heuristic (and by value shape as a defense-in-depth backstop):
  - names → `Sample Person NN`
  - emails → `user-NN@example.test`
  - personnummer → `YYMMDD-XXXX` (masked, non-`\d{6}-\d{4}`)
  - orgnr → `XXXXXX-XXXX` (masked, non-`\d{10}`)
  - phone → `07X-XXX XX XX` (masked, non-matching SE-mobile shape)
  - address → `Sample plats A` (no street-type-word + digit, so it does not match the address heuristic)
  - secrets (`api_key`/`password`/`token`/…) → **dropped entirely** (never masked in place)
  - öre integers, flags, ids, and every other non-PII scalar → copied **verbatim** (the business
    shape the later 9.3 comparison depends on is preserved — this is NOT over-anonymization).
- **Deterministic:** replacements are seeded/fixed (a stable FNV-1a hash of the raw value derives the
  synthetic suffix; no `Math.random`, no clock). Re-running on the same input yields byte-identical
  output — the AC2 "repeatable" obligation.

The anonymized output satisfies the same shared privacy scanner
(`tests/support/anonymization-scan.ts`, imported as `@/tests-support/anonymization-scan`) the
committed fixtures are held to.

## Usage (illustrative — synthetic input)

```ts
import { anonymizeRecord, captureLog } from "@/scripts-migration/lovable-capture";

const anonymized = sampleRecords.map(anonymizeRecord);
// Emit COUNTS only — never a raw value:
console.log(captureLog({ customers: anonymized.length }));
// The dev hand-authors the committed golden JSON from the anonymized shape, written via a canonical
// 2-space serialization so a re-run is byte-identical (see the loader-round-trip unit test).
```

The unit contract for this script lives in
`tests/unit/fixtures/golden/lovable/lovable-capture-script.test.ts` (approved-location, anonymize-at-
source, deterministic, and non-mutating checks).
