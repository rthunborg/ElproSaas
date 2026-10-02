/** Story 14.1 ATDD red-phase scaffold. */
import assert from "node:assert/strict";
import { test } from "node:test";

const capacityInputsModulePath = "../../../../src/features/resources/capacity-inputs";

test("[P0] retains data-driven absences, blocked-time exceptions, and Stockholm calendar reductions for later capacity calculation", async () => {
  const resourceModule = await import(capacityInputsModulePath) as {
    validateCapacityInputs?: (input: unknown) => { ok: boolean };
  };
  const result = resourceModule.validateCapacityInputs?.({
    timeZone: "Europe/Stockholm",
    exceptions: [
      { kind: "absence", date: "2026-10-15" },
      { kind: "blocked_time", date: "2026-10-16", start: "09:00", end: "12:00" },
    ],
    calendarDay: { date: "2026-12-24", variant: "reduced_capacity", reductionPercent: 50 },
  });

  assert.equal(result?.ok, true);
});

test("[P0] rejects invalid exception windows and invalid calendar reductions", async () => {
  const resourceModule = await import(capacityInputsModulePath) as {
    validateCapacityInputs?: (input: unknown) => { ok: boolean };
  };
  const invalidWindow = resourceModule.validateCapacityInputs?.({
    exceptions: [{ kind: "blocked_time", date: "2026-10-16", start: "13:00", end: "09:00" }],
  });
  const invalidReduction = resourceModule.validateCapacityInputs?.({
    calendarDay: { date: "2026-12-24", variant: "reduced_capacity", reductionPercent: 101 },
  });

  assert.equal(invalidWindow?.ok, false);
  assert.equal(invalidReduction?.ok, false);
});

test("[P0] rejects malformed persisted exception history without throwing", async () => {
  const resourceModule = await import(capacityInputsModulePath) as {
    validateCapacityInputs?: (input: unknown) => { ok: boolean };
  };

  assert.equal(resourceModule.validateCapacityInputs?.({ exceptions: [null] }).ok, false);
});

test("[P1] accepts a closed calendar day only when it carries no reduction percentage", async () => {
  const resourceModule = await import(capacityInputsModulePath) as {
    validateCapacityInputs?: (input: unknown) => { ok: boolean };
  };
  const closedDay = resourceModule.validateCapacityInputs?.({
    calendarDay: { date: "2026-12-25", variant: "closed" },
  });
  const closedDayWithReduction = resourceModule.validateCapacityInputs?.({
    calendarDay: { date: "2026-12-25", variant: "closed", reductionPercent: 50 },
  });

  assert.equal(closedDay?.ok, true);
  assert.equal(closedDayWithReduction?.ok, false);
});
