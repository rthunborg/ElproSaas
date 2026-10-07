/**
 * Skipped RED new editor scope contract with actual manifest continuity.
 * RED is the missing real editor binding, not the already-passing manifest.
 * Checks rendered controls/links; no product source scans or UI execution claim.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SCOPE_MANIFEST } from "@/scope/manifest";
import { binding, controlNames, editor } from "@/tests-support/booking-editor-contract";

// RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
test("[P0] 14.4-GOV-001 editor stays within active resources and exposes no recurrence/E15 controls or navigation", { skip: true }, () => {
  const html = renderToStaticMarkup(binding("Editor")(editor()));
  const resources = SCOPE_MANIFEST.modules.find((module) => module.id === "resources");
  const scheduling = SCOPE_MANIFEST.modules.find((module) => module.id === "scheduling");
  assert.equal(resources?.status, "active");
  assert.equal(scheduling?.status, "pending");
  for (const surface of ["navItems", "tenantTables", "widgets", "notificationCategories", "publicSurfaces", "fileOwnerTypes"] as const) {
    assert.deepEqual(scheduling?.[surface], [], surface);
  }
  const controls = controlNames(html);
  assert.ok(controls.includes("assigneeIds"), "real booking controls must render before absence has meaning");
  for (const forbidden of ["recurrencePattern", "recurrenceUntil", "occurrenceScope", "reportTime", "resolveConflict", "calendarFeed", "notifyAssignees"]) {
    assert.equal(controls.includes(forbidden), false, forbidden);
  }
  assert.doesNotMatch(html, /data-testid="(?:scheduling-time-grid|resources-calendar-timeline|conflict-resolver|time-report-form)"/);
  assert.doesNotMatch(html, /href="\/(?:planning|scheduling|my-day|time-reports|calendar-feed)(?:[/?#"])/);
});
