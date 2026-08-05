/**
 * Story 10.6 integration acceptance front door. These active checks fail until the additive
 * migration and every existing write/read path expose the same reconciled tax fields. The green
 * phase keeps these source-shape checks and adds the seeded local-Supabase value/lock assertions
 * listed in the Story 10.6 ATDD checklist.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function readRepoFile(relativePath: string): string {
  const path = resolve(ROOT, relativePath);
  expect(existsSync(path), `${relativePath} must exist`).toBe(true);
  return readFileSync(path, "utf8");
}

function storyMigration(): string {
  const directory = resolve(ROOT, "supabase/migrations");
  const matches = readdirSync(directory)
    .filter((name) => /tax_answer_reconciliation|tax-answer-reconciliation/i.test(name))
    .sort();
  expect(matches, "Story 10.6 requires exactly one forward-only additive migration").toHaveLength(1);
  return readFileSync(resolve(directory, matches[0]!), "utf8");
}

function expectAll(source: string, tokens: readonly string[], context: string): void {
  for (const token of tokens) {
    expect(source, `${context} must carry ${token}`).toContain(token);
  }
}

describe("Story 10.6 — tax answer persistence and frozen-source integration", () => {
  it("[10.6-INT-01][P0] additive migration and both quote RPC payloads have exact new-field parity", () => {
    const migration = storyMigration();
    expectAll(
      migration,
      [
        "included_in_invoice_total",
        "deduction_classification",
        "vat_type",
        "buyer_vat_number",
        "snapshot_schema_version",
        "REVERSE_CHARGE_CONSTRUCTION",
        "GREEN_CHARGING_MATERIAL",
      ],
      "migration",
    );
    expect(migration.match(/create\s+table/gi) ?? [], "reconciliation adds no tenant table").toHaveLength(0);

    const quoteRpcSources = readdirSync(resolve(ROOT, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8"))
      .join("\n");
    expectAll(
      quoteRpcSources,
      ["create_quote_version", "create_new_quote_version", "snapshot_schema_version", "buyer_vat_number"],
      "initial/new-version RPC union",
    );
  });

  it("[10.6-INT-02][P0] row commands persist visibility, inclusion, classification, and VAT type independently", () => {
    const source = [
      readRepoFile("src/server/commands/calculations/rows.ts"),
      readRepoFile("src/server/commands/calculations/validation.ts"),
      readRepoFile("src/server/commands/calculations/calc-db.ts"),
    ].join("\n");
    expectAll(
      source,
      ["is_hidden", "included_in_invoice_total", "deduction_classification", "vat_type"],
      "calculation row command/validation/DB projection",
    );
    expect(source).toContain("ROT_LABOR");
    expect(source).toContain("REVERSE_CHARGE_CONSTRUCTION");
  });

  it("[10.6-INT-03][P0] sent/accepted locks cover every new parent and child tax-visible field", () => {
    const migration = storyMigration();
    expectAll(
      migration,
      [
        "enforce_quote_version_sent_lock",
        "enforce_quote_version_line_sent_lock",
        "included_in_invoice_total",
        "deduction_classification",
        "vat_type",
        "buyer_vat_number",
        "snapshot_schema_version",
      ],
      "sent-lock migration",
    );
    expect(migration).not.toMatch(/update\s+quote_versions[\s\S]+where\s+status\s+in\s*\(\s*'sent'\s*,\s*'accepted'/i);
  });

  it("[10.6-INT-04][P0] historical v1 is read compatibly while both fresh paths use the shared v2 builder", () => {
    const builder = readRepoFile("src/server/commands/quotes/snapshot-build.ts");
    const createInitial = readRepoFile("src/server/commands/quotes/quotes.ts");
    const createNew = readRepoFile("src/server/commands/quotes/new-version.ts");
    expectAll(builder, ["buildFreshQuoteSnapshot", "snapshotSchemaVersion", "taxRuleVersion"], "shared snapshot builder");
    expect(createInitial).toContain("buildFreshQuoteSnapshot");
    expect(createNew).toContain("buildFreshQuoteSnapshot");
    expect(builder).toMatch(/snapshotSchemaVersion[^\n]+2/);
  });

  it("[10.6-INT-05][P0] PDF and acceptance consume frozen payable/reverse-charge snapshot facts", () => {
    const pdfSource = [
      readRepoFile("src/lib/quote-pdf/view-model.ts"),
      readRepoFile("src/server/commands/quotes/generate-pdf.ts"),
    ].join("\n");
    const acceptanceSource = [
      readRepoFile("src/server/commands/quotes/accept.ts"),
      readRepoFile("src/server/commands/quotes/accept-and-create-job.ts"),
    ].join("\n");
    expectAll(
      pdfSource,
      ["Omvänd betalningsskyldighet", "buyerVatNumber", "payableOre", "snapshotSchemaVersion"],
      "PDF frozen projection",
    );
    expectAll(
      acceptanceSource,
      ["acceptedPriceOre", "payableOre", "snapshotSchemaVersion"],
      "acceptance/job frozen source",
    );
  });
});
