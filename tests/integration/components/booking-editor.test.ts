/**
 * Structural/semantic SSR only; no focus movement, CSS viewport,
 * interaction, command persistence or calendar host execution credit.
 * Existing react-dom/server lane, no jsdom/RTL/CT dependency.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, test, expect, vi } from "vitest";
import { createElement } from "react";
import { BookingEditor } from "@/components/resources/BookingEditor";
import { BookingEntry, bookingSummaryDraft } from "@/components/resources/BookingEntry";
import { validateUpdateBooking } from "@/server/commands/bookings/validation";
vi.mock("next/navigation", () => ({useRouter: () => ({refresh: vi.fn()})}));
import { BookingConflictPanel, advanceBookingPreview, type BookingPreviewDisplay } from "@/components/resources/BookingConflictPanel";
vi.mock("@/features/resources/booking-actions", () => ({ previewBookingAction: vi.fn(), saveBookingAction: vi.fn() }));
import { booking, controlNames, editor, PERSON, PERSON_2, warning,
  type Preview, type PreviewState } from "@/tests-support/booking-editor-contract";

const production = {
  Editor: (request: ReturnType<typeof editor>) => createElement(BookingEditor, {open: true, onClose: () => {}, draft: request.draft, prefill: request.prefill, initialPreview: request.preview,
    options: {canManage: true, error: null, people: [{id: PERSON, label: "Elin Test", defaultWorkRoleId: null, workRoleIds: []}, {id: PERSON_2, label: "Nora Test", defaultWorkRoleId: PERSON_2, workRoleIds: [PERSON_2]}], workRoles: [{id: PERSON_2,label: "Installatör"}], jobs: [], customers: [], facilities: [], contacts: []}}),
  Panel: (preview: BookingPreviewDisplay) => createElement(BookingConflictPanel, {preview}),
  advancePreview: advanceBookingPreview,
};
function binding<K extends keyof typeof production>(name: K): (typeof production)[K] { return production[name]; }
describe("Story 14.4 booking editor — structural and state semantics", () => {
  test("Round2 archived current work role remains explicit with no active alternatives",()=>{
    const html=renderToStaticMarkup(createElement(BookingEditor,{open:true,onClose:()=>{},bookingId:PERSON_2,draft:{...booking(),workRoleId:PERSON_2},
      options:{canManage:true,error:null,people:[],workRoles:[],jobs:[],customers:[],facilities:[],contacts:[]}}));
    expect(html).toContain("Nuvarande arbetsroll (ej tillgänglig för nya val)");expect(html).toMatch(/option value="[^"]+" disabled="" selected=""/);
    expect(html).toContain('option value="">Ingen arbetsroll');expect(html).toContain('data-testid="booking-options-retry"');
  });
  test("Round1 failed host authority renders safe retry without booking controls or data", () => {
    const html=renderToStaticMarkup(createElement(BookingEntry,{canManage:false,canView:false,error:"Bokningsuppgifterna kunde inte läsas.",
      bookings:[],openConflictCount:0,options:{canManage:false,error:null,people:[],workRoles:[],jobs:[],customers:[],facilities:[],contacts:[]}}));
    expect(html).toContain('role="alert"'); expect(html).toContain("Försök igen");
    expect(html).not.toContain("booking-entry-toolbar"); expect(html).not.toContain("booking-edit"); expect(html).not.toContain("booking-conflict-chip");
  });
  test("Round1 current archived references are visibly selected but unavailable for new selection", () => {
    const html=renderToStaticMarkup(createElement(BookingEditor,{open:true,onClose:()=>{},bookingId:PERSON_2,
      draft:{...booking(),jobId:PERSON_2,customerId:PERSON,facilityId:PERSON_2,contactId:PERSON},
      options:{canManage:true,error:null,people:[],workRoles:[],jobs:[],customers:[],facilities:[],contacts:[]}}));
    expect(html.match(/Nuvarande koppling/g)).toHaveLength(4);
    expect(html).toMatch(/option value="[^"]+" disabled="" selected=""/);
  });
  test("reopening a summary projects only valid command facts and exact microseconds", () => {
    const original=booking(); const draft=bookingSummaryDraft({...original,id: PERSON,openConflictCount: 4});
    expect(draft).toEqual(original);
    expect(validateUpdateBooking({...draft,bookingId: PERSON,commandId: PERSON_2}).ok).toBe(true);
    expect(draft.startsAt).toBe("2026-10-12T06:00:00.123456Z");
  });
  test("existing assignment remains visible when its person is absent from new-booking options", () => {
    const html=renderToStaticMarkup(createElement(BookingEditor,{open:true,onClose:()=>{},bookingId:PERSON_2,draft:booking(),
      options:{canManage:true,error:null,people:[],workRoles:[],jobs:[],customers:[],facilities:[],contacts:[]}}));
    expect(html).toContain(`data-testid="booking-assignee-option-${PERSON}"`);
    expect(html).toContain("nuvarande tilldelning");
    expect(html).toMatch(/name="assigneeIds"[^>]*checked/);
  });
  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test("[P1] 14.4-COMP-001 renders a named modal sheet with approved controls and no recurrence", () => {
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
  test("[P1] 14.4-COMP-002 binds approved fields and multi-person draft with availability and role filter", () => {
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
  test("[P1] 14.4-COMP-002 standalone draft renders all four optional connection pickers without required", () => {
    const html = renderToStaticMarkup(binding("Editor")(editor()));
    for (const name of ["jobId", "customerId", "facilityId", "contactId"]) {
      const tag = html.match(new RegExp('<(?:select|input)\\b[^>]*name="' + name + '"[^>]*>'))?.[0];
      expect(tag, name + " optional picker").toBeDefined();
      expect(tag).not.toMatch(/\brequired(?:=|\s|>)/);
    }
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test("[P1] 14.4-COMP-002 reusable person/start/end prefill is rendered without a calendar host", () => {
    const html = renderToStaticMarkup(binding("Editor")(editor({
      prefill: { personId: PERSON_2, startsAt: "2026-10-12T08:00:00.000000Z", endsAt: "2026-10-12T09:30:00.000000Z" } })));
    expect(html).toContain(PERSON_2);
    expect(html).toContain('value="2026-10-12T10:00"');
    expect(html).toContain('value="2026-10-12T11:30"');
    expect(html).not.toContain('data-testid="scheduling-time-grid"');
    expect(html).not.toContain('data-testid="resources-calendar-timeline"');
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test("[P1] 14.4-COMP-004 warning explains rule/person/window/collision and accessible timeline without color", () => {
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
  test("[P1] 14.4-COMP-004 failed preview visibly remains unknown with an explicit retry", () => {
    const html = renderToStaticMarkup(binding("Panel")({ requestId: "current", status: "error",
      warnings: [], availabilityLabel: "Okänd", errorMessage: "Konfliktkontrollen kunde inte slutföras." }));
    expect(html).toContain("Konfliktkontrollen kunde inte slutföras.");
    expect(html).toContain("Okänd");
    expect(html).toContain("Försök igen");
    expect(html).not.toContain("Inga konflikter");
    expect(html).not.toMatch(/>Tillgänglig</);
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test("[P1] 14.4-COMP-003 latest response wins when an older success arrives last", () => {
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
  test("[P1] 14.4-COMP-003 obsolete failed response cannot replace newest warning set", () => {
    const state: PreviewState = { currentRequestId: "new", reviewed: true,
      preview: { requestId: "new", status: "ready", warnings: [warning()], availabilityLabel: "Upptagen" } };
    const result = binding("advancePreview")(state, { kind: "response", requestId: "old",
      preview: { requestId: "old", status: "error", warnings: [], availabilityLabel: "Okänd", errorMessage: "Gammalt fel" } });
    expect(result).toEqual(state);
    expect(renderToStaticMarkup(binding("Panel")(result.preview))).not.toContain("Gammalt fel");
  });

  // RED: missing actual production binding; activate task-by-task and confirm failure before implementation.
  test("[P1] 14.4-COMP-003 changed candidate immediately retires old warnings and explicit review while pending", () => {
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
