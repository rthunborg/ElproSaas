import assert from "node:assert/strict";
import test from "node:test";

import { quotePdfDisplayName } from "@/server/commands/quotes/generate-pdf";

test("10.9: quote PDF display name is the safe canonical .pdf path segment", () => {
  assert.equal(quotePdfDisplayName("1001"), "offert-1001.pdf");

  const hostile = quotePdfDisplayName("../../kund\\offert");
  assert.ok(hostile.endsWith(".pdf"));
  assert.doesNotMatch(hostile, /[/\\]|\.\./);
});

test("10.9: quote PDF display name preserves .pdf inside the 128-code-unit bound", () => {
  const bounded = quotePdfDisplayName("😀".repeat(200));

  assert.ok(bounded.endsWith(".pdf"));
  assert.ok(bounded.length <= 128);
  assert.doesNotMatch(bounded, /[\uD800-\uDBFF]\.pdf$/);
});
