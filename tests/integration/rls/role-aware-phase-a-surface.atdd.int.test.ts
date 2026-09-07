/**
 * Story 11.2 ATDD RED scaffold. The suite remains skipped until the additive
 * role-aware policy migration, catalog agreement adapter, and isolated fixtures land.
 */
import { describe, expect, test } from "vitest";

import {
  PERMISSION_MATRIX,
  SENSITIVE_FIELD_MATRIX,
} from "@/server/authz/permission-matrix";

type Role = "tenant_admin" | "projektledare" | "montor" | "saljare" | "ekonomi";
type ModuleId =
  | "foundation"
  | "dashboard"
  | "crm"
  | "settings"
  | "calculations"
  | "quotes"
  | "jobs"
  | "files";

type RoleAwareFixture = {
  readonly catalogCases: () => ReadonlyArray<{
    readonly role: Role;
    readonly module: ModuleId;
    readonly route: string;
    readonly table: string | null;
    readonly canRead: boolean;
    readonly canWrite: boolean;
  }>;
  readonly as: (role: Role) => {
    readonly routeVisible: (route: string) => Promise<boolean>;
    readonly rlsRead: (table: string) => Promise<{ readonly rows: unknown[]; readonly error: string | null }>;
    readonly rlsWrite: (table: string) => Promise<{ readonly error: string | null }>;
    readonly dashboardRead: () => Promise<{ readonly allowed: boolean }>;
    readonly dashboardCommand: () => Promise<{ readonly error: string | null }>;
  };
  readonly auditCount: () => Promise<number>;
  readonly invokeDeniedCommandWithTargetLookup: () => Promise<{
    readonly ok: false;
    readonly targetFound: false;
    readonly errorCode: "PERMISSION_DENIED";
  }>;
  readonly legacyAdminRoleUnion: () => Promise<readonly Role[]>;
  readonly invalidMembershipContext: () => Promise<{
    readonly roles: readonly unknown[];
    readonly activeMembership: boolean;
  }>;
  readonly resolveCatalogAccess: (
    context: { readonly roles: readonly unknown[]; readonly activeMembership: boolean },
    module: ModuleId,
  ) => Promise<{ readonly canRead: boolean; readonly canWrite: boolean }>;
  readonly quoteProjection: (role: Role) => Promise<{
    readonly data: Record<string, unknown>;
    readonly entitlements: { readonly withheld: readonly string[] };
  }>;
  readonly unauthorizedJobMembershipProbe: (role: Exclude<Role, "tenant_admin">) => Promise<{
    readonly rows: unknown[];
    readonly errorCode: string | null;
    readonly response: unknown;
  }>;
};

// Future fixture contract: seed isolated two-tenant records, each closed role,
// legacy scalar Admin, membership-role unions, and representative Phase A rows.
// It is deliberately declared rather than imported until Story 11.2 implements it.
declare function createRoleAwarePhaseASurfaceFixture(): Promise<RoleAwareFixture>;

const TARGETS: Record<ModuleId, { readonly route: string; readonly table: string | null }> = {
  foundation: { route: "/settings", table: "tenant_memberships" },
  dashboard: { route: "/dashboard", table: null },
  crm: { route: "/customers", table: "customers" },
  settings: { route: "/settings", table: "company_settings" },
  calculations: { route: "/calculations", table: "calculations" },
  quotes: { route: "/quotes", table: "quotes" },
  jobs: { route: "/jobs", table: "jobs" },
  files: { route: "/files", table: "files" },
};

describe("Story 11.2 role-aware Phase A surface (ATDD RED)", () => {
  test.skip("[P0] policy catalog and each seeded role × active module agree on route and RLS access", async () => {
    const fixture = await createRoleAwarePhaseASurfaceFixture();
    expect(Object.keys(PERMISSION_MATRIX).sort()).toEqual(Object.keys(TARGETS).sort());

    for (const entry of fixture.catalogCases()) {
      const target = TARGETS[entry.module];
      expect({ route: entry.route, table: entry.table }).toEqual(target);
      expect(await fixture.as(entry.role).routeVisible(target.route)).toBe(entry.canRead);

      if (target.table === null) {
        expect((await fixture.as(entry.role).dashboardRead()).allowed).toBe(entry.canRead);
        expect((await fixture.as(entry.role).dashboardCommand()).error).toBe(
          entry.canWrite ? null : "PERMISSION_DENIED",
        );
      } else {
        const read = await fixture.as(entry.role).rlsRead(target.table);
        const write = await fixture.as(entry.role).rlsWrite(target.table);
        expect(read.rows.length > 0).toBe(entry.canRead);
        expect(read.error).toBe(entry.canRead ? null : "RLS_DENIED");
        expect(write.error).toBe(entry.canWrite ? null : "RLS_DENIED");
      }
    }
  });

  test.skip("[P0] exercises one denied RLS read and write for every denied catalog path", async () => {
    const fixture = await createRoleAwarePhaseASurfaceFixture();

    for (const entry of fixture.catalogCases().filter((item) => !item.canRead || !item.canWrite)) {
      const target = TARGETS[entry.module];
      if (target.table === null) {
        expect((await fixture.as(entry.role).dashboardRead()).allowed).toBe(false);
        expect((await fixture.as(entry.role).dashboardCommand()).error).toBe("PERMISSION_DENIED");
        continue;
      }
      if (!entry.canRead) {
        expect(await fixture.as(entry.role).rlsRead(target.table)).toEqual({
          rows: [],
          error: "RLS_DENIED",
        });
      }
      if (!entry.canWrite) {
        expect(await fixture.as(entry.role).rlsWrite(target.table)).toEqual({
          error: "RLS_DENIED",
        });
      }
    }
  });

  test.skip("[P0] denies an unentitled command before target lookup and appends no audit event", async () => {
    const fixture = await createRoleAwarePhaseASurfaceFixture();
    const auditCountBefore = await fixture.auditCount();

    expect(await fixture.invokeDeniedCommandWithTargetLookup()).toEqual({
      ok: false,
      targetFound: false,
      errorCode: "PERMISSION_DENIED",
    });
    expect(await fixture.auditCount()).toBe(auditCountBefore);
  });

  test.skip("[P0] preserves legacy Admin and role-union access while invalid membership contexts fail closed", async () => {
    const fixture = await createRoleAwarePhaseASurfaceFixture();
    expect(await fixture.legacyAdminRoleUnion()).toEqual([
      "tenant_admin",
      "projektledare",
      "saljare",
    ]);

    const invalid = await fixture.invalidMembershipContext();
    for (const moduleId of Object.keys(TARGETS) as ModuleId[]) {
      expect(await fixture.resolveCatalogAccess(invalid, moduleId)).toEqual({
        canRead: false,
        canWrite: false,
      });
    }
  });

  test.skip("[P1] structurally omits and declares every money field withheld from Montör and Säljare", async () => {
    const fixture = await createRoleAwarePhaseASurfaceFixture();
    for (const role of ["montor", "saljare"] as const) {
      const projection = await fixture.quoteProjection(role);
      for (const field of Object.keys(SENSITIVE_FIELD_MATRIX.quotes)) {
        const entitled = SENSITIVE_FIELD_MATRIX.quotes[
          field as keyof typeof SENSITIVE_FIELD_MATRIX.quotes
        ].roles.includes(role);
        if (!entitled) {
          expect(projection.data).not.toHaveProperty(field);
          expect(projection.entitlements.withheld).toContain(`quotes.${field}`);
        }
      }
    }
  });

  test.skip("[P1] exposes no job_members or E16 assignment inference path to non-admin roles", async () => {
    const fixture = await createRoleAwarePhaseASurfaceFixture();
    for (const role of ["projektledare", "montor", "saljare", "ekonomi"] as const) {
      const probe = await fixture.unauthorizedJobMembershipProbe(role);
      expect(probe.rows).toEqual([]);
      expect(probe.errorCode).toMatch(/FORBIDDEN|RLS_DENIED|42P01/);
      expect(JSON.stringify(probe.response)).not.toMatch(
        /job[_-]?members?|e16|assigned[_-]?member/i,
      );
    }
  });
});
