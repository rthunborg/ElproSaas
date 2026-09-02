import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260831124310_story_10_8_quote_review_authorization.sql",
  ),
  "utf8",
);

test("successor review locks the source quote version before calculation-backed rows", () => {
  const start = migration.indexOf(
    "create or replace function public.authorize_quote_successor_review(",
  );
  const end = migration.indexOf("revoke execute on function", start);
  const definition = migration.slice(start, end);

  const quoteVersionLock = definition.indexOf(
    "select qv.calculation_id into v_source_calculation_id",
  );
  const calculationLock = definition.indexOf(
    "perform public.assert_story_10_6_line_sources",
  );

  assert.ok(quoteVersionLock >= 0, "source quote-version lock must be present");
  assert.ok(calculationLock >= 0, "calculation-backed line lock must be present");
  assert.ok(
    quoteVersionLock < calculationLock,
    "quote-version lock must precede calculation-backed row locks",
  );
});
