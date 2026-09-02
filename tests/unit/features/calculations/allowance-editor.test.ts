import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_PERSON_ALLOWANCE_SLOTS,
  addAllowanceEditorSlot,
  initializeAllowanceEditorSlots,
  removeAllowanceEditorSlot,
} from "@/features/calculations/allowance-editor";

test("allowance editor initializes legacy slots by array order without retaining their identifiers", () => {
  const slots = initializeAllowanceEditorSlots([
    { slot: "Anna Andersson", remainingRotAllowanceOre: 1_000_000 },
    { slot: "198001011234", remainingGreenAllowanceOre: 2_000_000 },
    { slot: "LEGACY_CUSTOM", remainingCombinedRotRutAllowanceOre: 3_000_000 },
  ]);

  assert.equal(slots.length, 3);
  assert.deepEqual(slots.map((slot) => slot.source), [
    { remainingRotAllowanceOre: 1_000_000 },
    { remainingGreenAllowanceOre: 2_000_000 },
    { remainingCombinedRotRutAllowanceOre: 3_000_000 },
  ]);
  for (const slot of slots) {
    assert.equal("slot" in (slot.source ?? {}), false);
  }
});

test("allowance editor adds a third person and removes one without losing later values", () => {
  const initial = initializeAllowanceEditorSlots([
    { slot: "PERSON_1", remainingRotAllowanceOre: 1_000_000 },
    { slot: "PERSON_2", remainingGreenAllowanceOre: 2_000_000 },
  ]);
  const withThird = addAllowanceEditorSlot(initial, "new-3");
  assert.equal(withThird.length, 3);
  assert.equal(withThird[2]?.key, "new-3");

  const withoutFirst = removeAllowanceEditorSlot(withThird, initial[0]!.key);
  assert.equal(withoutFirst.length, 2);
  assert.equal(withoutFirst[0]?.source?.remainingGreenAllowanceOre, 2_000_000);
  assert.equal(withoutFirst[1]?.key, "new-3");
});

test("allowance editor supports exactly 50 people and refuses a fifty-first", () => {
  let slots = initializeAllowanceEditorSlots([]);
  for (let number = slots.length + 1; number <= MAX_PERSON_ALLOWANCE_SLOTS; number += 1) {
    slots = addAllowanceEditorSlot(slots, `new-${number}`);
  }
  assert.equal(slots.length, 50);
  assert.strictEqual(addAllowanceEditorSlot(slots, "new-51"), slots);
});
