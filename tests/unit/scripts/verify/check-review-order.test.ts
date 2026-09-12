import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateReviewOrderFile, validateSuggestedReviewOrder } from "../../../../scripts/verify/check-review-order.mjs";

function withRepo(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "elpro-review-order-"));
  try { run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

function source(root: string, text = "export function save() {}\n"): void {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "src", "entry.ts"), text);
}

function trail(stop = "- `src/entry.ts:1` — `save` starts the command path") {
  return `# Story\n\n## Suggested Review Order\n\n${stop}\n\n## Tests\n\n- unrelated\n`;
}

test("accepts a real canonical stop and terminates before the next H2", () => {
  withRepo((root) => {
    source(root);
    const report = validateSuggestedReviewOrder(trail(), root);
    assert.deepEqual(report.errors, []);
    assert.equal(report.mode, "full-trail-candidate");
    assert.equal(report.refsCount, 1);
  });
});

test("rejects an absent, fenced-only, duplicate, or empty section", () => {
  withRepo((root) => {
    source(root);
    for (const markdown of [
      "# Story\n",
      "```md\n## Suggested Review Order\n- `src/entry.ts:1` — `save` example\n```\n",
      `${trail()}\n## Suggested Review Order\n- \`src/entry.ts:1\` — \`save\` duplicate\n`,
      "## Suggested Review Order\n\n## Next\n",
      "## Suggested Review Order\n\n```md\n- `src/entry.ts:1` — `save` placeholder\n```\n",
    ]) {
      assert.ok(validateSuggestedReviewOrder(markdown, root).errors.length > 0);
    }
  });
});

test("rejects a missing target, stale line, moved anchor, and repository escape", () => {
  withRepo((root) => {
    source(root, "export function renamed() {}\n");
    for (const stop of [
      "- `src/missing.ts:1` — source is missing",
      "- `src/entry.ts:2` — source line is stale",
      "- `src/entry.ts:1` — `save` anchor moved",
      "- `../outside.ts:1` — repository escape",
    ]) {
      assert.ok(validateSuggestedReviewOrder(trail(stop), root).errors.length > 0, stop);
    }
  });
});

test("checks a colon-delimited literal anchor on its cited source line", () => {
  withRepo((root) => {
    source(root, "export function renamed() {}\n");
    const report = validateSuggestedReviewOrder(
      trail("- `src/entry.ts:1` — `save`: public command entry"),
      root,
    );
    assert.match(report.errors.join("\n"), /anchor `save` was not found/);
  });
});

test("reports a directory, unreadable document, and symlink outside the repository without throwing", (t) => {
  withRepo((root) => {
    mkdirSync(join(root, "src", "directory"), { recursive: true });
    const directoryReport = validateSuggestedReviewOrder(
      trail("- `src/directory:1` — invalid directory reference"),
      root,
    );
    assert.match(directoryReport.errors.join("\n"), /regular file/);

    const documentReport = validateReviewOrderFile(join(root, "src", "directory"), root);
    assert.deepEqual(documentReport.errors, ["document cannot be read"]);

    const outside = mkdtempSync(join(tmpdir(), "elpro-review-order-outside-"));
    try {
      writeFileSync(join(outside, "entry.ts"), "export const outside = true;\n");
      try {
        // Windows directory junctions normally work without the elevated/developer
        // permission required for file symlinks, while still exercising realpath.
        symlinkSync(
          outside,
          join(root, "linked"),
          process.platform === "win32" ? "junction" : "dir",
        );
      } catch (error: unknown) {
        // An unusual locked-down host may prohibit junctions too.
        // The directory/document assertions above remain meaningful everywhere.
        if ((error as NodeJS.ErrnoException).code === "EPERM") {
          t.skip("directory-link creation is unavailable for this account");
          return;
        }
        throw error;
      }
      const linkedReport = validateSuggestedReviewOrder(
        trail("- `linked/entry.ts:1` — linked file"),
        root,
      );
      assert.match(linkedReport.errors.join("\n"), /symbolic link/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test("does not scan references outside the review-order section", () => {
  withRepo((root) => {
    source(root);
    const report = validateSuggestedReviewOrder(
      `${trail()}\n\nThe spec elsewhere cites \`../outside.ts:1\` and must not be scanned.\n`,
      root,
    );
    assert.deepEqual(report.errors, []);
  });
});
