import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { COMMAND_CAPABILITIES } from "@/server/commands/envelope";
import {
  scanCommandDeclarations,
  scanProductionCommandDeclarations,
  validateProductionCommandEnrollment,
} from "../../../support/authz/command-enrollment";

test("[P0] every production defineCommand declaration has exactly one registry enrollment", () => {
  const declarations = scanProductionCommandDeclarations();
  assert.ok(declarations.length > 0, "expected production command declarations");
  validateProductionCommandEnrollment(declarations, COMMAND_CAPABILITIES);
});

test("[P0] source enrollment verification rejects an omitted registry row even with an explicit capability", () => {
  const declarations = scanCommandDeclarations(`
    import { defineCommand } from "../envelope";
    export const command = defineCommand({
      command: "fixture.explicit-but-omitted",
      capability: { module: "crm", capability: "Customers.Create" },
    });
  `, "src/server/commands/fixture.ts");

  assert.throws(
    () => validateProductionCommandEnrollment(declarations, {}),
    /command capability enrollment missing for production declaration: fixture\.explicit-but-omitted/,
  );
});

test("[P0] production discovery traverses declarations outside the commands folder", () => {
  const projectRoot = mkdtempSync(join(tmpdir(), "elpro-command-enrollment-"));
  try {
    const featureDirectory = join(projectRoot, "src", "features");
    mkdirSync(featureDirectory, { recursive: true });
    writeFileSync(join(featureDirectory, "feature-command.ts"), `
    import { defineCommand } from "@/server/commands/envelope";
    export const command = defineCommand({ command: "feature.command" });
    `);
    const declarations = scanProductionCommandDeclarations(projectRoot);

    assert.equal(declarations.length, 1);
    assert.equal(declarations[0]?.command, "feature.command");
    assert.throws(
      () => validateProductionCommandEnrollment(declarations, {}),
      /command capability enrollment missing for production declaration: feature\.command/,
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("[P0] source enrollment verification rejects duplicate declarations, stale entries, and explicit-capability drift", () => {
  const duplicate = scanCommandDeclarations(`
    import { defineCommand as declare } from "../envelope";
    export const one = declare({ command: "fixture.duplicate" });
    export const two = declare({ command: "fixture.duplicate" });
  `, "src/server/commands/fixture.ts");
  assert.throws(() => validateProductionCommandEnrollment(duplicate, { "fixture.duplicate": { module: "crm", capability: "Customers.Create" } }), /duplicate production command declaration/);

  const explicit = scanCommandDeclarations(`
    import { defineCommand } from "../envelope";
    export const command = defineCommand({
      command: "fixture.drift",
      capability: { module: "crm", capability: "Customers.Create" },
    });
  `, "src/server/commands/fixture.ts");
  assert.throws(() => validateProductionCommandEnrollment(explicit, { "fixture.drift": { module: "crm", capability: "Customers.Edit" } }), /command capability enrollment drift/);
  assert.throws(() => validateProductionCommandEnrollment([], { "fixture.stale": { module: "crm", capability: "Customers.Create" } }), /has no production declaration/);
});
