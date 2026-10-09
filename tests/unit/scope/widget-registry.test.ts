/**
 * Story 19.1 ATDD — actual widget registry / manifest coherence.
 * Provisional export/property names below are harness contracts, not product decisions.
 * Align names with the implemented registry while retaining these behavioral assertions.
 * Actual product registry and validator imports are evaluated inside each case.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

type Module = {
  id: string; label: string; wave: "A" | "B1b"; status: "active" | "pending";
  epic?: "E10"; activatedAt?: string;
  navItems: []; tenantTables: []; widgets: string[]; notificationCategories: [];
  publicSurfaces: []; fileOwnerTypes: [];
};
type Manifest = { modules: Module[] };
type Registration = {
  id: string; moduleId: string; requiredCapability: string;
  load: unknown; component: unknown;
};
type Violation = { rule: string; detail: string };
type Validate = (manifest: Manifest, options: {
  permissionMatrix: unknown; widgetRegistry: readonly Registration[];
}) => Violation[];

function moduleFactory(overrides: Partial<Module> = {}): Module {
  return {
    id: "quotes", label: "Offerter", wave: "B1b", status: "active",
    epic: "E10", activatedAt: "2026-07-08", navItems: [], tenantTables: [],
    widgets: ["quote-pipeline"], notificationCategories: [], publicSurfaces: [],
    fileOwnerTypes: [], ...overrides,
  };
}
function registrationFactory(overrides: Partial<Registration> = {}): Registration {
  // Synthetic loader/component references are fixtures ONLY, never the real-set oracle.
  return {
    id: "quote-pipeline", moduleId: "quotes", requiredCapability: "Quotes.View",
    load: async () => undefined, component: () => null, ...overrides,
  };
}
const MATRIX = { quotes: { "Quotes.View": { roles: ["tenant_admin", "projektledare", "saljare"] } } };

async function loadValidator(): Promise<Validate> {
  const name = "@/scope/manifest-schema";
  const source = await import(name) as { validateManifestCoherence: Validate };
  assert.equal(typeof source.validateManifestCoherence, "function");
  return source.validateManifestCoherence;
}

test("[P1] 19.1-UNIT-001 AC1 actual loader/component registrations equal the active manifest union", async () => {
  const registryName = "@/scope/widget-registry";
  const manifestName = "@/scope/manifest";
  const matrixName = "@/server/authz/permission-matrix";
  const { WIDGET_REGISTRY } = await import(registryName) as { WIDGET_REGISTRY: Registration[] };
  const { SCOPE_MANIFEST } = await import(manifestName) as { SCOPE_MANIFEST: Manifest };
  const { PERMISSION_MATRIX } = await import(matrixName) as { PERMISSION_MATRIX: unknown };
  assert.ok(Array.isArray(WIDGET_REGISTRY), "inspect actual production registrations, not a shadow id list");
  const declared = SCOPE_MANIFEST.modules.filter((m) => m.status === "active").flatMap((m) => m.widgets);
  assert.deepEqual([...declared].sort(), ["quote-pipeline"]);
  assert.deepEqual(WIDGET_REGISTRY.map((r) => r.id).sort(), [...declared].sort());
  assert.equal(WIDGET_REGISTRY.length, 1);
  const pipeline = WIDGET_REGISTRY[0];
  assert.equal(pipeline.moduleId, "quotes");
  assert.equal(pipeline.requiredCapability, "Quotes.View");
  assert.equal(typeof pipeline.load, "function", "actual loader is registered");
  assert.equal(typeof pipeline.component, "function", "actual presentation is registered");
  const validate = await loadValidator();
  assert.deepEqual(validate(SCOPE_MANIFEST, { permissionMatrix: PERMISSION_MATRIX, widgetRegistry: WIDGET_REGISTRY }), []);
});

// Each negative mutates a coherent positive control. Without the positive assertion,
// an unrelated existing manifest error could make every negative vacuously pass.
const negativeCases: {
  label: string;
  change: (m: Manifest, r: Registration[], matrix: Record<string, unknown>) => void;
}[] = [
  { label: "missing implementation for a declared widget", change: (_m, r) => { r.splice(0); } },
  { label: "orphan registration absent from the manifest", change: (_m, r) => { r.push(registrationFactory({ id: "unowned-fixture" })); } },
  { label: "duplicate actual registration", change: (_m, r) => { r.push(registrationFactory()); } },
  { label: "registration uses pending producer with no declared live surface", change: (m) => { m.modules[0].status = "pending"; m.modules[0].widgets = []; } },
  { label: "registration names an unknown producer", change: (_m, r) => { r[0].moduleId = "unknown-fixture"; } },
  { label: "capability absent from producing module", change: (_m, r) => { r[0].requiredCapability = "Quotes.UnknownFixture"; } },
  { label: "capability belongs only to another module", change: (_m, r, matrix) => {
    r[0].requiredCapability = "Dashboard.View";
    matrix.dashboard = { "Dashboard.View": { roles: ["tenant_admin"] } };
  } },
  { label: "platform capability masquerades as tenant content", change: (_m, r, matrix) => {
    r[0].requiredCapability = "Platform.Operator.Access";
    matrix.quotes = { "Platform.Operator.Access": { roles: [], scope: "platform", tenantGrantable: false, tenantRoles: [] } };
  } },
  { label: "missing registered loader", change: (_m, r) => { r[0].load = undefined; } },
  { label: "missing registered presentation", change: (_m, r) => { r[0].component = undefined; } },
];
for (const scenario of negativeCases) {
  test("[P1] 19.1-UNIT-002 AC1 rejects " + scenario.label, async () => {
    const validate = await loadValidator();
    const manifest: Manifest = { modules: [moduleFactory()] };
    const registry = [registrationFactory()];
    const matrix: Record<string, unknown> = structuredClone(MATRIX);
    assert.deepEqual(validate(manifest, { permissionMatrix: matrix, widgetRegistry: registry }), []);
    scenario.change(manifest, registry, matrix);
    const violations = validate(manifest, { permissionMatrix: matrix, widgetRegistry: registry });
    assert.ok(violations.length > 0, scenario.label + " must fail the actual coherence gate");
    assert.ok(violations.some((v) => /widget|quote-pipeline|Quotes|Platform/i.test(v.detail)),
      "failure must identify widget coherence, not an unrelated invariant");
  });
}
