/**
 * Story 10.4 — the NON-SCOPE guard (10.4-INT-03, P2, AC3; test-design-epic-10.md R-1045).
 * The E10 read-model shipped without a new analytics/nav/email surface. Story 19.1 now consumes
 * that read-model through the explicitly approved `quote-pipeline` dashboard widget (PB-D7 / FR107).
 * Keep the widget inventory exact: only that sanctioned E19 registration may exist; no separate
 * analytics/reports page, extra quote nav item, or email-send path may grow here.
 *
 * The current manifest-governed pins:
 *   - the `quotes` module declares only `quote-pipeline` and its SINGLE `/quotes` nav item;
 *   - the complete active widget inventory contains only the approved Story 19.1 widget;
 *   - the derived active nav route set stays at the existing Phase-A routes;
 *   - the governed `TENANT_TABLES` set derives from active manifest modules;
 *   - the read-model source path imports NO email/notification send path (Epic 13 owns reminders).
 *
 * Later manifest-governed stories may advance these explicit inventory pins. This guard preserves
 * the E10 boundary while admitting the owner-approved E19 consumer; extra widgets still fail loudly.
 * The source scan remains unskipped, and the `existsSync` guard keeps it safe.
 *
 * [Source: story 10.4 AC3 + Task 5; test-design-epic-10.md#10.4-INT-03, R-1045;
 *  spec-19-1-dashboard-framework-and-quote-pipeline.md, Boundaries / Evidence]
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { SCOPE_MANIFEST } from "@/scope/manifest";
import { TENANT_TABLES } from "../../rls/tenant-table-inventory";

const PHASE_A_NAV_ROUTES = [
  "/admin/users",
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
  it("the quotes module declares only the approved Story 19.1 quote-pipeline widget", () => {
    const quotes = SCOPE_MANIFEST.modules.find((m) => m.id === "quotes");
    expect(quotes).toBeDefined();
    expect(quotes?.widgets).toEqual(["quote-pipeline"]);
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

  it("the active widget inventory contains only the approved Story 19.1 quote-pipeline widget", () => {
    const widgets = SCOPE_MANIFEST.modules
      .filter((m) => m.status === "active")
      .flatMap((m) => m.widgets);
    expect(widgets).toEqual(["quote-pipeline"]);
  });

  it("the governed tenant-table inventory derives from the active manifest modules", () => {
    const activeManifestTenantTables = SCOPE_MANIFEST.modules
      .filter((m) => m.status === "active")
      .flatMap((m) => m.tenantTables);
    expect([...TENANT_TABLES].sort()).toEqual(
      [...new Set(activeManifestTenantTables)].sort(),
    );
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
