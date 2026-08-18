import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isQuoteCaptureDateExpired,
  isReviewedQuoteProofStale,
  stockholmBusinessDate,
} from "@/features/calculations/pre-quote-review";

test("Stockholm capture date changes at the Swedish midnight boundary", () => {
  assert.equal(
    stockholmBusinessDate(new Date("2026-08-18T21:59:59.000Z")),
    "2026-08-18",
  );
  assert.equal(
    stockholmBusinessDate(new Date("2026-08-18T22:00:00.000Z")),
    "2026-08-19",
  );
  assert.equal(
    isQuoteCaptureDateExpired(
      "2026-08-18",
      new Date("2026-08-18T22:00:00.000Z"),
    ),
    true,
  );
});

test("a refreshed digest or capture date requires an explicit preview recapture", () => {
  const proof = { digest: "old", quoteCaptureDate: "2026-08-18" };
  assert.equal(
    isReviewedQuoteProofStale(proof, "new", "2026-08-18"),
    true,
  );
  assert.equal(
    isReviewedQuoteProofStale(proof, "old", "2026-08-19"),
    true,
  );
  assert.equal(
    isReviewedQuoteProofStale(proof, "old", "2026-08-18"),
    false,
  );
});
