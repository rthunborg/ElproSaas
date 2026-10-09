import test from "node:test";
import assert from "node:assert/strict";

/** Story 15.1 RED scaffolds. Bind adapters to final production exports before activation.
 * These are test-port contracts, not proposed production signatures. No fake projection
 * implementation or successful default is supplied. Skips are not executed coverage. */
type Booking = { id: string; start: string; end: string; people: string[]; role: string | null; job: string; customer: string; status: string };
type Filters = { people?: string[]; roles?: string[]; jobs?: string[]; customers?: string[] };
type ViewPort = {
  project(input: { bookings: Booking[]; start: string; end: string; filters: Filters; self: string }): { schema: string[]; resources: Record<string, string[]>; team: Record<string, string[]>; uniqueCount: number; personal: string[] };
  period(date: string, mode: "week" | "day" | "month"): { start: string; end: string };
  selection(first: string, last: string, person?: string): { start: string; end: string; person?: string };
  reassignment(bookings: Booking[], people: { id: string; profile: "active" | "archived" | "missing"; membership: "active" | "inactive" }[]): string[];
};
function production(): ViewPort { throw new Error("15.1 ATDD wiring required: bind final pure view/period/slot exports; do not return expected fixtures"); }
const b = (id: string, start: string, end: string, people = ["p1"], role: string | null = "electrician"): Booking => ({ id, start, end, people, role, job: "j1", customer: "c1", status: "planned" });

test.skip("[15.1 AC1 P1] Given half-open bounds, all projections exclude touching edges and count multi-assignee IDs once", () => {
  const bookings = [b("touch-start", "2026-10-11T21:00:00Z", "2026-10-11T22:00:00Z"), b("inside", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", ["p1", "p2"]), b("touch-end", "2026-10-12T22:00:00Z", "2026-10-12T23:00:00Z")];
  const result = production().project({ bookings, start: "2026-10-11T22:00:00Z", end: "2026-10-12T22:00:00Z", filters: {}, self: "p2" });
  assert.deepEqual(result, { schema: ["inside"], resources: { p1: ["inside"], p2: ["inside"] }, team: { electrician: ["inside"] }, uniqueCount: 1, personal: ["inside"] });
});
test.skip("[15.1 AC1 P1] Given category filters, use AND across categories and intersect own agenda", () => {
  const input = { bookings: [b("own", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z"), b("peer", "2026-10-12T09:00:00Z", "2026-10-12T10:00:00Z", ["p2"]), { ...b("other-job", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z"), job: "j2" }], start: "2026-10-11T22:00:00Z", end: "2026-10-12T22:00:00Z", filters: { jobs: ["j1"], customers: ["c1"], roles: ["electrician"] }, self: "p1" };
  const result = production().project(input);
  assert.deepEqual({ schema: result.schema, personal: result.personal }, { schema: ["own", "peer"], personal: ["own"] });
});
for (const [date, start, end] of [["2026-03-29", "2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z"], ["2026-10-25", "2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z"]]) {
  test.skip(`[15.1 AC1 P1] Given Stockholm DST day ${date}, local day uses independent UTC boundaries`, () => {
    assert.deepEqual(production().period(date!, "day"), { start, end });
  });
}
test.skip("[15.1 AC1 P1] Given Sunday, week starts Monday and month respects Stockholm boundaries", () => {
  const port = production();
  assert.deepEqual({ week: port.period("2026-10-18", "week"), month: port.period("2026-10-18", "month") }, { week: { start: "2026-10-11T22:00:00Z", end: "2026-10-18T22:00:00Z" }, month: { start: "2026-09-30T22:00:00Z", end: "2026-10-31T23:00:00Z" } });
});
test.skip("[15.1 AC4 P0] Given reverse 30-minute slot drag, normalize interval and retain selected person", () => {
  assert.deepEqual(production().selection("2026-10-12T10:00:00Z", "2026-10-12T08:30:00Z", "p2"), { start: "2026-10-12T08:30:00Z", end: "2026-10-12T10:30:00Z", person: "p2" });
});
test.skip("[15.1 AC6 P1] Given lifecycle facts, reassignment is independent of active-picker absence", () => {
  const bookings = [b("archived", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", ["p1", "p2"]), b("inactive", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", ["p3"]), b("missing", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", ["p4"]), b("healthy", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z", ["p1"])];
  assert.deepEqual(production().reassignment(bookings, [{ id: "p1", profile: "active", membership: "active" }, { id: "p2", profile: "archived", membership: "active" }, { id: "p3", profile: "active", membership: "inactive" }, { id: "p4", profile: "missing", membership: "active" }]), ["archived", "inactive", "missing"]);
});
