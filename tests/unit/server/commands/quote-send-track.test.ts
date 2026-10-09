import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateSendGate } from "@/features/quotes/send-gate";
import { quoteSendCustomerDataTrack } from "@/server/commands/quotes/send-track";

const values = [undefined, "demo", "real_customer", "", "invalid", "DEMO", " demo", "demo "] as const;

for (const current of values) {
  for (const legacy of values) {
    test(`quote send track: canonical=${String(current)}, legacy=${String(legacy)}`, () => {
      // The only permitted demo cases are canonical-only, legacy-only, or matching exact opt-ins.
      const expected = (current === "demo" && (legacy === undefined || legacy === "demo")) ||
        (current === undefined && legacy === "demo") ? "demo" : "real_customer";
      const track = quoteSendCustomerDataTrack({
        KOPPLAS_QUOTE_SEND_TRACK: current,
        ELPRO_QUOTE_SEND_TRACK: legacy,
      });
      assert.equal(track, expected);
      const gate = evaluateSendGate({
        warningsSnapshot: [{ code: "TAX_SIGN_OFF_REQUIRED", severity: "warning", message: "Unresolved tax" }],
        signOff: { requiresSignOff: true, termsApprovedAt: null, customerDataTrack: track },
      });
      assert.equal(gate.canSend, expected === "demo");
      assert.equal(gate.blockers.some((issue) => issue.code === "TAX_SIGN_OFF_REQUIRED"), expected !== "demo");
    });
  }
}
