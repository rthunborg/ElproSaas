import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../../../..");
const scanner = resolve(root, "scripts/verify/check-operator-console-isolation.mjs");
const runOperatorConsoleIsolationCheck = () => execFileSync(process.execPath, [scanner], { cwd: root, encoding: "utf8" });

test("[P0] 12.2-STATIC-001 accepts the checked-in operator surface without tenant shell or navigation imports", () => {
  assert.doesNotThrow(runOperatorConsoleIsolationCheck);
});

test("[P0] 12.2-STATIC-001 accepts independent platform gates for page, read-model, and actions", () => {
  assert.doesNotThrow(runOperatorConsoleIsolationCheck);
});
