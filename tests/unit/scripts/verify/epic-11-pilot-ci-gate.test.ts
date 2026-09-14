import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ci = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");

test("Epic 11 NFR probe shares the bounded DB lane without becoming a historical Phase A test script", () => {
  assert.match(
    ci,
    /Database, RLS, and pilot performance tests" --max-seconds 300 -- bash -c\s+'pnpm run test:int && node --experimental-strip-types --import \.\/tests\/support\/register\.mjs scripts\/nfr\/epic-11-r1108-baseline\.ts'/,
  );
  assert.doesNotMatch(ci, /test:int:pilot/);
});
