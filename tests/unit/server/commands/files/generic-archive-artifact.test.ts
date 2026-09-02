import assert from "node:assert/strict";
import { test } from "node:test";

import { isGenericFileArchiveForbidden } from "@/server/commands/files/file-db";

test("generic archive refuses current or in-flight quote PDFs", () => {
  assert.equal(isGenericFileArchiveForbidden("quote_pdf", "draft"), true);
  assert.equal(isGenericFileArchiveForbidden("quote_pdf", "linked"), true);
});

test("generic archive preserves archive-over-delete for locked sent quote PDFs", () => {
  assert.equal(isGenericFileArchiveForbidden("quote_pdf", "locked"), false);
});

test("generic archive remains available for ordinary uploaded files", () => {
  assert.equal(isGenericFileArchiveForbidden(null, "draft"), false);
  assert.equal(isGenericFileArchiveForbidden("acceptance_evidence", "linked"), false);
});
