import assert from "node:assert/strict";
import { test } from "node:test";

import { isGenericFileArchiveForbidden } from "@/server/commands/files/file-db";

test("generic archive refuses quote PDFs owned by the quote lifecycle", () => {
  assert.equal(isGenericFileArchiveForbidden("quote_pdf"), true);
});

test("generic archive remains available for ordinary uploaded files", () => {
  assert.equal(isGenericFileArchiveForbidden(null), false);
  assert.equal(isGenericFileArchiveForbidden("acceptance_evidence"), false);
});
