import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanJobsContainment } from "../../../../scripts/verify/check-service-role-containment.mjs";

test("[P0] jobs containment rejects an unverified JWT or alternate scheduler lane", () => {
  const root = mkdtempSync(join(tmpdir(), "elpro-jobs-"));
  const dir = join(root, "src", "server", "jobs"); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "bad.ts"), "const x = decodeJwt(token); // pg_cron");
  assert.equal(scanJobsContainment(root).violations.length, 1);
});
