import assert from "node:assert/strict";
import { test } from "node:test";

import { CommandError } from "@/server/commands/command-errors";
import { createRow } from "@/server/commands/calculations/rows";

function terminalQuery(result: { data: unknown[]; error: null }) {
  const query = {
    eq: () => query,
    is: () => query,
    limit: () => Promise.resolve(result),
  };
  return query;
}

test("createRow rejects at the 500-active-row application boundary before inserting", async () => {
  let insertAttempted = false;
  const db = {
    from(table: string) {
      if (table === "calculation_sections") {
        return {
          select: () => terminalQuery({
            data: [{ calculation_id: "22222222-2222-4222-8222-222222222222" }],
            error: null,
          }),
        };
      }
      if (table === "calculation_rows") {
        return {
          select: () => terminalQuery({
            data: Array.from({ length: 500 }, (_, index) => ({ id: String(index) })),
            error: null,
          }),
          insert: () => {
            insertAttempted = true;
            throw new Error("insert must not be reached at the cap");
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  await assert.rejects(
    async () => createRow.config.execute({
      db,
      input: {
        section_id: "11111111-1111-4111-8111-111111111111",
        row_type: "labor",
        quantity: 1,
        unit: "h",
        vat_rate_bp: 2500,
        included_in_invoice_total: true,
        deduction_classification: "NONE",
        vat_type: "STANDARD_VAT_25",
      },
      tenantContext: {
        userId: "33333333-3333-4333-8333-333333333333",
        tenantId: "44444444-4444-4444-8444-444444444444",
        role: "tenant_admin",
        status: "active",
        userEmail: null,
        tenantName: null,
      },
      clock: { now: () => new Date("2026-08-07T12:00:00.000Z") },
      correlationId: "55555555-5555-4555-8555-555555555555",
    } as never),
    (error: unknown) => error instanceof CommandError && error.code === "VALIDATION_FAILED",
  );
  assert.equal(insertAttempted, false);
});
