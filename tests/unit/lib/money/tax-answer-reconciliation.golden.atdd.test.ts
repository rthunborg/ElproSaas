/** Story 10.6 structured golden masters. Active by design: no skip or surface gate. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import * as calculationTotals from "@/features/calculations/totals";
import * as money from "@/lib/money";
import * as quotePdf from "@/lib/quote-pdf/view-model";
import * as quoteSnapshot from "@/lib/quote-snapshot/build";
import * as quoteTaxCompatibility from "@/lib/quote-snapshot/tax-compat";
import { assertNoPii } from "@/tests-support/anonymization-scan";

type UnknownFunction = (...args: unknown[]) => unknown;
type JsonObject = Record<string, unknown>;

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN = resolve(HERE, "../../../fixtures/golden");
const surface = {
  ...money,
  ...calculationTotals,
  ...quoteSnapshot,
  ...quoteTaxCompatibility,
  ...quotePdf,
} as Record<string, unknown>;

function readFixture(relativePath: string): { raw: string; value: JsonObject } {
  const raw = readFileSync(resolve(GOLDEN, relativePath), "utf8");
  assert.ok(!raw.includes("\r\n"), `${relativePath} must use LF line endings`);
  const value = JSON.parse(raw) as JsonObject;
  assertNoPii(value, relativePath);
  return { raw, value };
}

function requireFunction(name: string): UnknownFunction {
  const candidate = surface[name];
  assert.equal(typeof candidate, "function", `golden requires canonical ${name}`);
  return candidate as UnknownFunction;
}

function unwrap(result: unknown): unknown {
  if (typeof result === "object" && result !== null && "ok" in result) {
    const typed = result as { readonly ok: unknown; readonly value?: unknown };
    assert.equal(typed.ok, true, `expected golden operation to succeed: ${JSON.stringify(result)}`);
    return typed.value;
  }
  return result;
}

function assertExpectedSubset(actual: unknown, expected: unknown, path = "result"): void {
  if (Array.isArray(expected)) {
    assert.deepEqual(actual, expected, path);
    return;
  }
  if (typeof expected === "object" && expected !== null) {
    assert.equal(typeof actual, "object", `${path} must be an object`);
    assert.notEqual(actual, null, `${path} must be non-null`);
    for (const [key, value] of Object.entries(expected as JsonObject)) {
      assertExpectedSubset((actual as JsonObject)[key], value, `${path}.${key}`);
    }
    return;
  }
  assert.deepEqual(actual, expected, path);
}

function assertManifest(fixture: JsonObject): void {
  const cases = fixture.cases as readonly JsonObject[];
  const manifest = fixture.coverageManifest as JsonObject;
  assert.ok(Array.isArray(cases) && cases.length > 0, "golden must contain live cases");
  assert.equal(typeof manifest, "object");
  assert.deepEqual(
    Object.keys(manifest).sort(),
    cases.map((entry) => String(entry.id)).sort(),
    "coverageManifest keys must exactly match executable case IDs",
  );
}

describe("Story 10.6 — re-derived structured goldens", () => {
  test("[10.6-GOLDEN-01][P0] money truth is driven through canonical category/tax authorities", () => {
    const { raw, value } = readFixture("money/tax-answer-reconciliation-v2.json");
    assertManifest(value);
    assert.ok(!/personnummer|password|api_key/i.test(raw), "money fixture must be PII/secret free");
    const cases = value.cases as readonly JsonObject[];
    for (const entry of cases) {
      const operation = String(entry.operation);
      const result = unwrap(requireFunction(operation)(entry.input));
      assertExpectedSubset(result, entry.expected, String(entry.id));
    }
  });

  test("[10.6-GOLDEN-02][P0] calculation rows pin independent properties and reconciled summaries", () => {
    const { raw, value } = readFixture("calculations/tax-answer-reconciliation-v2.json");
    assertManifest(value);
    assert.ok(!/personnummer|password|api_key/i.test(raw), "calculation fixture must be PII/secret free");
    const reconcile = requireFunction("computeReconciledDocumentTotals");
    for (const entry of value.cases as readonly JsonObject[]) {
      const result = unwrap(reconcile({ rows: entry.rows, standardRateBp: 2500 }));
      assertExpectedSubset(result, entry.expected, String(entry.id));
    }
  });

  test("[10.6-GOLDEN-03][P0] legacy v1 remains literal while fresh v2 captures frozen reconciled truth", () => {
    const { value } = readFixture("snapshots/tax-answer-reconciliation-v1-v2.json");
    assert.deepEqual(Object.keys(value.coverageManifest as JsonObject).sort(), ["freshV2", "legacyV1"]);
    const legacy = value.legacyV1 as JsonObject;
    const adaptedLegacy = unwrap(
      requireFunction("adaptQuoteTaxSnapshot")(legacy.source),
    );
    assertExpectedSubset(adaptedLegacy, legacy.expected, "legacyV1");

    const fresh = value.freshV2 as JsonObject;
    const source = fresh.source as JsonObject;
    const taxInput = unwrap(requireFunction("parseTaxInputSnapshot")(fresh.taxInput));
    const taxAnswer = unwrap(requireFunction("buildTaxAnswerSnapshotV2")({
      rows: (source.lines as readonly JsonObject[]).map((line, index) => ({
        id: `golden-line-${index}`,
        netOre: line.lineNetOre,
        vatType: line.vatType,
        rateBp: line.vatRateBp,
        includedInInvoiceTotal: line.includedInInvoiceTotal,
        deductionClassification: line.deductionClassification,
        summaryCategory:
          line.rowType === "labor" || line.rowType === "material"
            ? line.rowType
            : "other",
      })),
      taxInput,
      quoteCaptureDate: String(fresh.capturedAt).slice(0, 10),
      customerEligibilityPosture: (source.customer as JsonObject).customer_type,
    })) as JsonObject;
    const built = unwrap(
      requireFunction("buildQuoteVersionSnapshot")(
        {
          ...source,
          taxRuleVersion: (taxAnswer.taxRuleVersions as readonly string[]).join("+"),
          taxAnswerSnapshot: taxAnswer,
          calculatedDeductionOre: taxAnswer.calculatedDeductionOre,
          claimDeductionOre: taxAnswer.claimDeductionOre,
          payableOre: taxAnswer.payableOre,
          netOre: taxAnswer.netOre,
          vatOre: taxAnswer.vatOre,
          grossOre: taxAnswer.grossOre,
          deductionOre: taxAnswer.deductionOre,
        },
        { capturedAt: fresh.capturedAt },
      ),
    );
    assertExpectedSubset(built, fresh.expected, "freshV2");
    assert.equal(Object.isFrozen(built), true, "fresh v2 snapshot must be frozen");
  });

  test("[10.6-GOLDEN-04][P0] PDF model carries exact reverse-charge text and frozen totals only", () => {
    const { value } = readFixture("quote-pdf/tax-answer-reconciliation-v1-v2.json");
    assertManifest(value);
    const buildViewModel = requireFunction("buildQuotePdfViewModel");
    for (const entry of value.cases as readonly JsonObject[]) {
      const snapshot = entry.snapshot as JsonObject;
      let pdfInput = snapshot;
      if (snapshot.snapshotSchemaVersion === 2) {
        const taxInput = unwrap(requireFunction("parseTaxInputSnapshot")(entry.taxInput));
        const taxAnswer = unwrap(requireFunction("buildTaxAnswerSnapshotV2")({
          rows: (snapshot.lines as readonly JsonObject[]).map((line, index) => ({
            id: `golden-pdf-line-${index}`,
            netOre: line.lineNetOre,
            vatType: line.vatType,
            rateBp: line.vatRateBp,
            includedInInvoiceTotal: line.includedInInvoiceTotal,
            deductionClassification: line.deductionClassification,
            summaryCategory:
              line.rowType === "labor" || line.rowType === "material"
                ? line.rowType
                : "other",
          })),
          taxInput,
          quoteCaptureDate: String(snapshot.capturedAt).slice(0, 10),
          customerEligibilityPosture: "company",
        })) as JsonObject;
        pdfInput = {
          ...snapshot,
          taxRuleVersion: (taxAnswer.taxRuleVersions as readonly string[]).join("+"),
          taxAnswerSnapshot: taxAnswer,
          calculatedDeductionOre: taxAnswer.calculatedDeductionOre,
          claimDeductionOre: taxAnswer.claimDeductionOre,
          payableOre: taxAnswer.payableOre,
          netOre: taxAnswer.netOre,
          vatOre: taxAnswer.vatOre,
          grossOre: taxAnswer.grossOre,
          deductionOre: taxAnswer.deductionOre,
        };
      }
      const viewModel = buildViewModel(pdfInput) as JsonObject;
      if (entry.expectedTaxAnswer) {
        assertExpectedSubset(viewModel.taxAnswer, entry.expectedTaxAnswer, `${entry.id}.taxAnswer`);
      }
      const rendered = JSON.stringify(viewModel);
      for (const token of entry.mustAppear as readonly string[]) {
        assert.ok(rendered.includes(token), `${entry.id}: missing required PDF token ${token}`);
      }
      for (const token of entry.mustNotAppear as readonly string[]) {
        assert.ok(!rendered.includes(token), `${entry.id}: forbidden PDF token leaked: ${token}`);
      }
    }
  });

  test("[10.6-GOLDEN-05][P0] acceptance golden carries one valid frozen V2 answer in the shared privacy gate", () => {
    const { value } = readFixture("acceptance/tax-answer-v2-acceptance-job.json");
    const snapshot = value.quoteSnapshot as JsonObject;
    const parsedInput = requireFunction("parseTaxInputSnapshot")(value.calculationTaxInput);
    const parsedAnswer = requireFunction("parseTaxAnswerSnapshotV2")(snapshot.taxAnswerSnapshot);
    const taxInput = unwrap(parsedInput) as JsonObject;
    const taxAnswer = unwrap(parsedAnswer) as JsonObject;
    assert.equal(taxInput.deductionChoice, "NONE");
    assert.equal(taxAnswer.vatOre, 5_001);
    assert.equal(taxAnswer.payableOre, 25_003);
    assert.equal(snapshot.payableOre, taxAnswer.payableOre);
  });
});
