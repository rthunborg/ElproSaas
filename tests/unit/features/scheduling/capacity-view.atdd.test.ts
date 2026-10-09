import test from "node:test";
import assert from "node:assert/strict";

/** Test adapter only; bind the real display adapter and existing capacity engine.
 * Named minutes below are independent domain goldens, not implementation outputs. */
type CapacityPort = {
  week(input: { shifts: number[]; breakMinutes: number[]; holidayMinutes?: number; absenceMinutes?: number; blockedMinutes?: number; bufferMinutes?: number; demand: number }): { budget: number; demand: number; balance: number; occupancy: number | null; overbooked: boolean };
  cell(input: { budget: number | null; bookings: { id: string; minutes: number; visible: boolean; status: string }[] }): { budget: number | null; demand: number | null; occupancy: number | null; balance: number | null; state: string; drillIds: string[] };
  clippedDemand(input: { date: string; person: string; bookings: { id: string; start: string; end: string; people: string[]; status: string }[] }): number;
};
function production(): CapacityPort { throw new Error("15.1 ATDD wiring required: real capacity display adapter, full unfiltered demand and validated schedule facts"); }
test.skip("[15.1-UNIT-001 AC7 P1] Given four full versus five short days, actual breaks produce distinct budgets", () => {
  const port = production();
  assert.deepEqual([port.week({ shifts: [480, 480, 480, 480, 0], breakMinutes: [30, 30, 30, 30, 0], demand: 600 }), port.week({ shifts: [384, 384, 384, 384, 384], breakMinutes: [30, 30, 30, 30, 30], demand: 600 })], [{ budget: 1800, demand: 600, balance: 1200, occupancy: 600 / 1800 * 100, overbooked: false }, { budget: 1770, demand: 600, balance: 1170, occupancy: 600 / 1770 * 100, overbooked: false }]);
});
test.skip("[15.1-UNIT-002 AC7 P1] Given disjoint holiday absence blocked and buffer reductions, subtract each once", () => {
  assert.deepEqual(production().week({ shifts: [480, 480, 480, 480, 480], breakMinutes: [30, 30, 30, 30, 30], holidayMinutes: 450, absenceMinutes: 120, blockedMinutes: 60, bufferMinutes: 30, demand: 1800 }), { budget: 1590, demand: 1800, balance: -210, occupancy: 1800 / 1590 * 100, overbooked: true });
});
for (const budget of [0, -30]) {
  test.skip(`[15.1-COMP-002 AC7 P1] Given budget ${budget}, positive demand is drillable without Infinity or NaN`, () => {
    assert.deepEqual(production().cell({ budget, bookings: [{ id: "b1", minutes: 60, visible: true, status: "planned" }] }), { budget, demand: 60, occupancy: null, balance: budget - 60, state: "overbooked-no-capacity", drillIds: ["b1"] });
  });
}
test.skip("[15.1-COMP-002 AC7 P1] Given restrictive block filters, capacity and overbooking drilldown include hidden demand", () => {
  assert.deepEqual(production().cell({ budget: 120, bookings: [{ id: "visible", minutes: 90, visible: true, status: "planned" }, { id: "hidden", minutes: 90, visible: false, status: "planned" }, { id: "cancelled", minutes: 600, visible: true, status: "cancelled" }] }), { budget: 120, demand: 180, occupancy: 150, balance: -60, state: "overbooked", drillIds: ["visible", "hidden"] });
});
test.skip("[15.1 AC7 P1] Given incomplete facts, display unavailable rather than zero capacity", () => {
  assert.deepEqual(production().cell({ budget: null, bookings: [] }), { budget: null, demand: null, occupancy: null, balance: null, state: "unavailable", drillIds: [] });
});
test.skip("[15.1 AC7 P1] Given midnight-spanning overlapping demand, clip each booking additively by local day", () => {
  assert.equal(production().clippedDemand({ date: "2026-10-12", person: "p1", bookings: [
    { id: "overnight", start: "2026-10-11T21:30:00Z", end: "2026-10-11T22:30:00Z", people: ["p1", "p2"], status: "planned" },
    { id: "overlap", start: "2026-10-11T22:00:00Z", end: "2026-10-11T22:30:00Z", people: ["p1"], status: "planned" },
    { id: "peer", start: "2026-10-11T22:00:00Z", end: "2026-10-11T23:00:00Z", people: ["p2"], status: "planned" },
    { id: "cancelled", start: "2026-10-11T22:00:00Z", end: "2026-10-12T22:00:00Z", people: ["p1"], status: "cancelled" },
  ] }), 60);
});
