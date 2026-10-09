import test from "node:test";
import assert from "node:assert/strict";

type Scope = { user: string; tenant: string; view: string };
type Preferences = { period: string; date: string; people: string[] };
type PreferencePort = { save(scope: Scope, value: Preferences, storage: Map<string, string>): void; restore(scope: Scope, storage: Map<string, string>, eligiblePeople: string[]): { value: Preferences; reset: boolean }; defaults(view: string): Preferences; deniedStorage(scope: Scope): Preferences };
function production(): PreferencePort { throw new Error("15.1 ATDD wiring required: final versioned toolbar preference adapter with injected storage"); }
test.skip("[15.1-COMP-001 AC3 P1] Given user tenant and view switches, restore only exact scoped preference", () => {
  const port = production(), storage = new Map<string, string>(), scope = { user: "u1", tenant: "t1", view: "Schema" }, value = { period: "day", date: "2026-10-12", people: ["p1"] };
  port.save(scope, value, storage);
  assert.deepEqual([port.restore(scope, storage, ["p1"]).value, ...[{ ...scope, user: "u2" }, { ...scope, tenant: "t2" }, { ...scope, view: "Resurser" }].map(other => port.restore(other, storage, ["p1"]).value)], [value, port.defaults("Schema"), port.defaults("Schema"), port.defaults("Resurser")]);
});
test.skip("[15.1-COMP-001 AC3 P1] Given unavailable restored person, reset visibly to valid defaults", () => {
  const port = production(), storage = new Map<string, string>(), scope = { user: "u1", tenant: "t1", view: "Schema" };
  port.save(scope, { period: "day", date: "2026-10-12", people: ["archived"] }, storage);
  assert.deepEqual(port.restore(scope, storage, ["p1"]), { value: port.defaults("Schema"), reset: true });
});
test.skip("[15.1-COMP-001 AC3 P1] Given corrupt storage values, recover valid defaults without blocking reads", () => {
  const port = production(), storage = new Map<string, string>(), scope = { user: "u1", tenant: "t1", view: "Schema" };
  port.save(scope, { period: "day", date: "2026-10-12", people: [] }, storage);
  for (const key of storage.keys()) storage.set(key, "{corrupt");
  assert.deepEqual(port.restore(scope, storage, []), { value: port.defaults("Schema"), reset: true });
});
test.skip("[15.1 AC3 P1] Given storage denial, connected read can use safe view defaults", () => {
  const port = production();
  assert.deepEqual(port.deniedStorage({ user: "u1", tenant: "t1", view: "Min kalender" }), port.defaults("Min kalender"));
});
