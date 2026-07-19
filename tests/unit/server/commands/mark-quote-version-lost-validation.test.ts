/**
 * Story 10.2 — ATDD RED-PHASE scaffold: the PURE reason validator `validateMarkQuoteVersionLost`
 * (10.2-UNIT-02, P0, AC1, R-1013/R-1050).
 *
 * `validateMarkQuoteVersionLost` is the input-shape guard the command envelope runs BEFORE any DB
 * access (architecture §5 step 4) for the mark-lost path. It is pure (no I/O), so the fast
 * `node --test` gate protects its branches WITHOUT a database. It mirrors
 * `validateMarkQuoteVersionLifecycle`/`validateMarkQuoteVersionSent` and returns a `ValidationResult`.
 *
 * The load-bearing rules (Task 4.1 — kept in lockstep with `src/server/commands/quotes/validation.ts`):
 *   - `quote_version_id` REQUIRED + UUID-shaped (a value the DB would reject as 22P02 fails as
 *     VALIDATION here, not as an opaque server error);
 *   - `outcome ∈ {forlorad, avbojd}` — the ASCII machine tokens (Förlorad/Avböjd are UI labels);
 *   - `category ∈ {pris, konkurrent, tidplan, uteblivet_svar, annat}` — the strawman list (UXB-A5);
 *   - `note` is REQUIRED (non-empty after trim) WHEN `category === 'annat'`; otherwise optional and
 *     coarse-bounded; a whitespace-only note on `annat` FAILS (free-text-only was rejected — it would
 *     kill hit-rate analytics);
 *   - the validator NEVER echoes raw values in the failure message (returns the stable
 *     `VALIDATION_FAILED` code — no outcome/category/note leaked), and a client-supplied
 *     `tenant_id`/`status`/`created_at` is NEVER read (tenant is the RESOLVED tenant; status is
 *     server-owned) — smuggled keys must not appear on the validated data.
 *
 * ── WHY the top `describe` is skipped (RED PHASE) ─────────────────────────────────────────────────
 * `validateMarkQuoteVersionLost` does NOT exist yet (Task 4.1 is the DEV phase). To keep the file
 * TYPE-CHECKING today WITHOUT importing a non-existent export, the validator is declared as a LOCAL
 * `notYetImplemented()` placeholder; the whole suite is `describe(..., { skip })` so the placeholder
 * is never invoked. GREEN phase: delete the placeholder + the ValidationResult shim, add
 *   `import { validateMarkQuoteVersionLost } from "@/server/commands/quotes/validation";`
 * remove `{ skip }`, and re-run. Assertions are the CONTRACT — do not weaken them.
 *
 * Runner: `node --test` (`pnpm test:unit`) — PURE, NO DB, NO PII, NO clock.
 * Mirrors `mark-quote-version-sent-validation.test.ts` (6.4) + `lifecycle-transition.test.ts` (6.5).
 *
 * [Source: story 10.2 AC1 + Task 4.1 + Dev Notes "Reuse — do NOT reinvent";
 *  test-design-epic-10.md#10.2-UNIT-02, R-1013; src/server/commands/quotes/validation.ts]
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_UPPER = "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE";

// ── RED-PHASE PLACEHOLDER (delete in green — see header) ───────────────────────────────────────
type ValidationResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: "VALIDATION_FAILED"; readonly message: string };

interface MarkLostInput {
  readonly quote_version_id: string;
  readonly outcome: "forlorad" | "avbojd";
  readonly category: "pris" | "konkurrent" | "tidplan" | "uteblivet_svar" | "annat";
  readonly note?: string | null;
}

function notYetImplemented(): never {
  throw new Error(
    "Story 10.2 validateMarkQuoteVersionLost not implemented — replace the placeholder + remove { skip } in the green phase",
  );
}
// GREEN: `import { validateMarkQuoteVersionLost } from "@/server/commands/quotes/validation";`
const validateMarkQuoteVersionLost = (raw: unknown): ValidationResult<MarkLostInput> => {
  void raw;
  return notYetImplemented();
};

describe(
  "10.2-UNIT-02: validateMarkQuoteVersionLost (RED — Story 10.2 not implemented)",
  { skip: "ATDD red phase — Story 10.2 (mark-lost validator) not implemented" },
  () => {
    // ── Happy path ─────────────────────────────────────────────────────────────────────────
    test("accepts a forlorad + a non-annat category with NO note (note optional off-annat)", () => {
      const r = validateMarkQuoteVersionLost({
        quote_version_id: UUID_A,
        outcome: "forlorad",
        category: "pris",
      });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.data.outcome, "forlorad");
      assert.equal(r.data.category, "pris");
    });

    test("accepts an avbojd + annat WITH a non-empty note", () => {
      const r = validateMarkQuoteVersionLost({
        quote_version_id: UUID_UPPER,
        outcome: "avbojd",
        category: "annat",
        note: "kunden valde en annan lösning",
      });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.data.note, "kunden valde en annan lösning");
    });

    test("accepts every strawman category token", () => {
      for (const category of ["pris", "konkurrent", "tidplan", "uteblivet_svar", "annat"] as const) {
        const note = category === "annat" ? "obligatorisk fritext" : undefined;
        const r = validateMarkQuoteVersionLost({
          quote_version_id: UUID_A,
          outcome: "forlorad",
          category,
          note,
        });
        assert.equal(r.ok, true, `category ${category} must validate`);
      }
    });

    // ── note-on-annat is REQUIRED (the analytics-honesty rule) ───────────────────────────────
    test("[VALIDATION_FAILED] annat WITHOUT a note is rejected (note required on annat)", () => {
      const r = validateMarkQuoteVersionLost({
        quote_version_id: UUID_A,
        outcome: "forlorad",
        category: "annat",
      });
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.code, "VALIDATION_FAILED");
    });

    test("[VALIDATION_FAILED] annat with a WHITESPACE-only note is rejected (trim before the emptiness check)", () => {
      for (const note of ["", "   ", "\t\n"]) {
        const r = validateMarkQuoteVersionLost({
          quote_version_id: UUID_A,
          outcome: "avbojd",
          category: "annat",
          note,
        });
        assert.equal(r.ok, false, `annat note ${JSON.stringify(note)} must fail`);
      }
    });

    // ── closed-vocabulary negatives ──────────────────────────────────────────────────────────
    test("[VALIDATION_FAILED] an outcome outside {forlorad, avbojd} is rejected (incl. UI labels / rejected token)", () => {
      for (const outcome of ["Förlorad", "Avböjd", "lost", "rejected", "", "won"]) {
        const r = validateMarkQuoteVersionLost({
          quote_version_id: UUID_A,
          outcome,
          category: "pris",
        });
        assert.equal(r.ok, false, `outcome ${JSON.stringify(outcome)} must fail`);
      }
    });

    test("[VALIDATION_FAILED] a category outside the strawman set is rejected", () => {
      for (const category of ["Pris", "price", "budget", "", "other"]) {
        const r = validateMarkQuoteVersionLost({
          quote_version_id: UUID_A,
          outcome: "forlorad",
          category,
          note: "n",
        });
        assert.equal(r.ok, false, `category ${JSON.stringify(category)} must fail`);
      }
    });

    test("[VALIDATION_FAILED] a missing / non-uuid quote_version_id is rejected", () => {
      for (const raw of [
        { outcome: "forlorad", category: "pris" },
        { quote_version_id: null, outcome: "forlorad", category: "pris" },
        { quote_version_id: "not-a-uuid", outcome: "forlorad", category: "pris" },
        { quote_version_id: `${UUID_A}-extra`, outcome: "forlorad", category: "pris" },
      ]) {
        const r = validateMarkQuoteVersionLost(raw);
        assert.equal(r.ok, false, `${JSON.stringify(raw)} must fail`);
      }
    });

    test("[VALIDATION_FAILED] a non-record raw value is rejected (never crashes)", () => {
      for (const raw of [null, undefined, 42, "x", true, [] as unknown]) {
        const r = validateMarkQuoteVersionLost(raw);
        assert.equal(r.ok, false, `non-record ${String(raw)} must fail`);
      }
    });

    // ── never leaks; never reads server-owned keys ──────────────────────────────────────────
    test("the failure message NEVER echoes the raw outcome/category/note (no PII / free-text leak)", () => {
      const r = validateMarkQuoteVersionLost({
        quote_version_id: UUID_A,
        outcome: "won",
        category: "annat",
        note: "personnummer 900101-1234 nämns här",
      });
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.doesNotMatch(r.message, /won|annat|900101|personnummer/i);
    });

    test("a client-supplied tenant_id / status / created_at is STRIPPED (server-owned; never carried)", () => {
      const r = validateMarkQuoteVersionLost({
        quote_version_id: UUID_A,
        outcome: "forlorad",
        category: "pris",
        tenant_id: "99999999-9999-9999-9999-999999999999",
        status: "lost",
        created_at: "2000-01-01T00:00:00.000Z",
      });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      const asRecord = r.data as unknown as Record<string, unknown>;
      for (const smuggled of ["tenant_id", "status", "created_at"]) {
        assert.equal(smuggled in asRecord, false, `smuggled key "${smuggled}" must be stripped`);
      }
    });
  },
);
