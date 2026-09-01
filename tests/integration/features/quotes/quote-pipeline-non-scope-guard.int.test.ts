/**
 * Story 10.4 — ATDD RED-PHASE scaffold: the NON-SCOPE guard (10.4-INT-03, P2, AC3; test-design-epic-10.md
 * R-1045). Pipeline data appears ONLY in the existing quote list/detail + the read-model E19 consumes
 * later (PB-D7 / FR107). This guard asserts the shipped surface grows NO new analytics surface: no new
 * nav item, no dashboard widget, no separate analytics/reports page, no manifest `widgets` entry for the
 * `quotes` module, and NO email-send path on the read-model / list path. A deferred-surface + manifest
 * scan mirroring the R-1045 mitigation.
 *
 * The pins (Task 5):
 *   - the `quotes` module in `SCOPE_MANIFEST` keeps `widgets: []` and its SINGLE `navItems`
 *     `[{ route: "/quotes" }]` — unchanged by this story;
 *   - the derived active nav route set stays the 7 Phase-A routes (no new nav module directory);
 *   - the current governed `TENANT_TABLES` count stays 27. Story 10.4 added none; the later,
 *     explicitly governed Story 10.8 authorization table accounts for the sanctioned increment;
 *   - the read-model + list source path imports NO email/notification send path (Epic 13 owns reminders).
 *
 * ── GREEN (Story 10.4 implemented) ───────────────────────────────────────────────────────────────
 * The read-model landed with NO manifest growth; the suite is unskipped. Later manifest-governed
 * stories may advance the explicit inventory pin; the read-model source scan finds no email-send path. The `existsSync` guard keeps
 * the source scan safe. If a widget/nav/analytics-page/email path is ever genuinely required, that is
 * Epic 19 / Epic 13 scope — STOP and escalate, do not grow the manifest here. The assertions are the
 * CONTRACT.
 *
 * [Source: story 10.4 AC3 + Task 5 + the ⚑ SCOPE BOUNDARY section; src/scope/manifest.ts (quotes module
 *  widgets []/one nav item); test-design-epic-10.md#10.4-INT-03, R-1045]
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SCOPE_MANIFEST } from "@/scope/manifest";

const PHASE_A_NAV_ROUTES = [
  "/dashboard",
  "/customers",
  "/calculations",
  "/quotes",
  "/jobs",
  "/files",
  "/settings",
].sort();

const READ_MODELS_DIR = path.join(process.cwd(), "src", "server", "read-models");
// Any token that would betray a notification / email send path leaking onto the read-model surface.
const EMAIL_PATH_TOKENS = /sendMail|sendEmail|nodemailer|resend|smtp|notification.*send|mailer/i;

describe("10.4-INT-03: non-scope guard — no new analytics surface / no email-send path", () => {
  it("the quotes module keeps widgets: [] (no dashboard widget grows here — Epic 19 owns widgets)", () => {
    const quotes = SCOPE_MANIFEST.modules.find((m) => m.id === "quotes");
    expect(quotes).toBeDefined();
    expect(quotes?.widgets).toEqual([]);
  });

  it("the quotes module keeps its SINGLE /quotes nav item (no new nav item)", () => {
    const quotes = SCOPE_MANIFEST.modules.find((m) => m.id === "quotes");
    expect(quotes?.navItems.map((n) => n.route)).toEqual(["/quotes"]);
  });

  it("the derived active nav route set stays the 7 Phase-A routes (no new analytics/reports page)", () => {
    const routes = SCOPE_MANIFEST.modules
      .filter((m) => m.status === "active")
      .flatMap((m) => m.navItems.map((n) => n.route))
      .sort();
    expect([...new Set(routes)]).toEqual(PHASE_A_NAV_ROUTES);
  });

  it("no active module declares any widget (the manifest widget set stays empty for E10)", () => {
    const widgets = SCOPE_MANIFEST.modules
      .filter((m) => m.status === "active")
      .flatMap((m) => m.widgets);
    expect(widgets).toEqual([]);
  });

  it("the governed tenant-table inventory stays at the current manifest count of 27", () => {
    const tenantTables = SCOPE_MANIFEST.modules
      .filter((m) => m.status === "active")
      .flatMap((m) => m.tenantTables);
    expect(new Set(tenantTables).size).toBe(27);
  });

  it("the read-model source path imports NO email/notification send path (Epic 13 owns reminders)", () => {
    expect(existsSync(READ_MODELS_DIR)).toBe(true);
    const files = readdirSync(READ_MODELS_DIR).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const src = readFileSync(path.join(READ_MODELS_DIR, f), "utf8");
      expect(src).not.toMatch(EMAIL_PATH_TOKENS);
    }
  });
});
