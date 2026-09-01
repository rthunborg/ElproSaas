/** Pure acceptance contract for the bounded post-reset recovery verifier. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { isResetInspectionComplete } from "../../../../scripts/verify/check-local-supabase-reset.mjs";

const completeInspection = {
  ledgerMatches: true,
  auditFixtureTable: true,
  auditFixtureFunction: true,
  auditFixtureTrigger: true,
  attestationFixture: true,
  authHealthy: true,
};

test("[10.8][P0] reset recovery requires the complete audit table/function/trigger fixture", () => {
  assert.equal(isResetInspectionComplete(completeInspection), true);

  for (const missing of Object.keys(completeInspection)) {
    assert.equal(
      isResetInspectionComplete({ ...completeInspection, [missing]: false }),
      false,
      `${missing}=false must reject reset recovery`,
    );
  }

  assert.equal(
    isResetInspectionComplete({
      ...completeInspection,
      auditFixtureFunction: undefined,
      auditFixtureTrigger: undefined,
    }),
    false,
    "the old table-only evidence must never recover a reset",
  );
});
