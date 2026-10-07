/**
 * Skipped RED structural/semantic SSR only; no focus movement, CSS viewport,
 * interaction, command persistence or calendar host execution credit.
 * Existing react-dom/server lane, no jsdom/RTL/CT dependency.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, test, expect } from "vitest";
import { binding, booking, controlNames, editor, PERSON, PERSON_2, warning,
  type Preview, type PreviewState } from "@/tests-support/booking-editor-contract";

describe("Story 14.4 booking editor — structural RED", () => {
  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-001 renders a named modal sheet with approved controls and no recurrence", () => {
    const html = renderToStaticMarkup(binding("Editor")(editor()));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/aria-label(?:ledby)?="[^"]+"/);
    expect(html).toContain('data-testid="booking-editor-sheet"');
    expect(controlNames(html)).toEqual(expect.arrayContaining(["assigneeIds", "workRoleId", "startsAt", "endsAt", "allDay", "description", "status"]));
    expect(controlNames(html)).not.toEqual(expect.arrayContaining(["recurrencePattern"]));
    expect(html).not.toMatch(/<(?:button|label|legend)\b[^>]*>[^<]*(?:Återkommande|Endast detta tillfälle|Detta och kommande)/);
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-002 binds approved fields and multi-person draft with availability and role filter", () => {
    const request = editor({ draft: booking({ assigneeIds: [PERSON, PERSON_2], status: "cancelled",
      workRoleId: PERSON_2, description: "Behåll oskickad anteckning" }) });
    const html = renderToStaticMarkup(binding("Editor")(request));
    expect(controlNames(html)).toEqual(expect.arrayContaining(["assigneeIds", "workRoleId", "startsAt", "endsAt", "allDay",
      "jobId", "customerId", "facilityId", "contactId", "description", "status"]));
    expect(html).toContain("Behåll oskickad anteckning");
    expect(html).toContain(PERSON);
    expect(html).toContain(PERSON_2);
    expect(html).toMatch(/value="cancelled"[^>]*selected|selected[^>]*value="cancelled"/);
    expect(html).toContain("Tillgänglig");
    expect(html).toContain('data-testid="booking-work-role-filter"');
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-002 standalone draft renders all four optional connection pickers without required", () => {
    const html = renderToStaticMarkup(binding("Editor")(editor()));
    for (const name of ["jobId", "customerId", "facilityId", "contactId"]) {
      const tag = html.match(new RegExp('<(?:select|input)\\b[^>]*name="' + name + '"[^>]*>'))?.[0];
      expect(tag, name + " optional picker").toBeDefined();
      expect(tag).not.toMatch(/\brequired(?:=|\s|>)/);
    }
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-002 reusable person/start/end prefill is rendered without a calendar host", () => {
    const html = renderToStaticMarkup(binding("Editor")(editor({
      prefill: { personId: PERSON_2, startsAt: "2026-10-12T08:00:00.000000Z", endsAt: "2026-10-12T09:30:00.000000Z" } })));
    expect(html).toContain(PERSON_2);
    expect(html).toContain('value="2026-10-12T10:00"');
    expect(html).toContain('value="2026-10-12T11:30"');
    expect(html).not.toContain('data-testid="scheduling-time-grid"');
    expect(html).not.toContain('data-testid="resources-calendar-timeline"');
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-004 warning explains rule/person/window/collision and accessible timeline without color", () => {
    const item = warning();
    const preview: Preview = { requestId: "current", status: "ready", warnings: [item], availabilityLabel: "Upptagen" };
    const html = renderToStaticMarkup(binding("Panel")(preview));
    for (const label of [item.ruleLabel, item.personLabel, item.windowLabel, item.collisionLabel]) expect(html).toContain(label);
    expect(html).toContain('data-testid="booking-conflict-timeline"');
    expect(html).toMatch(/aria-label(?:ledby)?="[^"]+"/);
    expect(html).toContain(item.startsAt);
    expect(html).toContain(item.endsAt);
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-004 failed preview visibly remains unknown with an explicit retry", () => {
    const html = renderToStaticMarkup(binding("Panel")({ requestId: "current", status: "error",
      warnings: [], availabilityLabel: "Okänd", errorMessage: "Konfliktkontrollen kunde inte slutföras." }));
    expect(html).toContain("Konfliktkontrollen kunde inte slutföras.");
    expect(html).toContain("Okänd");
    expect(html).toContain("Försök igen");
    expect(html).not.toContain("Inga konflikter");
    expect(html).not.toContain("Tillgänglig");
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-003 latest response wins when an older success arrives last", () => {
    const newest = warning({ personLabel: "Nora Senaste" });
    const state: PreviewState = { currentRequestId: "new", reviewed: false,
      preview: { requestId: "new", status: "ready", warnings: [newest], availabilityLabel: "Upptagen" } };
    const result = binding("advancePreview")(state, { kind: "response", requestId: "old",
      preview: { requestId: "old", status: "ready", warnings: [warning({ personLabel: "Elin Föråldrad" })], availabilityLabel: "Upptagen" } });
    expect(result).toEqual(state);
    const html = renderToStaticMarkup(binding("Panel")(result.preview));
    expect(html).toContain("Nora Senaste");
    expect(html).not.toContain("Elin Föråldrad");
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-003 obsolete failed response cannot replace newest warning set", () => {
    const state: PreviewState = { currentRequestId: "new", reviewed: true,
      preview: { requestId: "new", status: "ready", warnings: [warning()], availabilityLabel: "Upptagen" } };
    const result = binding("advancePreview")(state, { kind: "response", requestId: "old",
      preview: { requestId: "old", status: "error", warnings: [], availabilityLabel: "Okänd", errorMessage: "Gammalt fel" } });
    expect(result).toEqual(state);
    expect(renderToStaticMarkup(binding("Panel")(result.preview))).not.toContain("Gammalt fel");
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test.skip("[P1] 14.4-COMP-003 changed candidate immediately retires old warnings and explicit review while pending", () => {
    const state: PreviewState = { currentRequestId: "old", reviewed: true,
      preview: { requestId: "old", status: "ready", warnings: [warning()], availabilityLabel: "Upptagen" } };
    const result = binding("advancePreview")(state, { kind: "candidateChanged", requestId: "new" });
    expect(result.currentRequestId).toBe("new");
    expect(result.reviewed).toBe(false);
    expect(result.preview.status).toBe("pending");
    expect(result.preview.warnings).toEqual([]);
    const html = renderToStaticMarkup(binding("Panel")(result.preview));
    expect(html).not.toContain("Dubbelbokning");
    expect(html).not.toContain("Inga konflikter");
  });
});
