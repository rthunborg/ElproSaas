import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { TenantRole } from "@/server/authz/roles";

/**
 * Story 15.1 AC2 + AC1/3 completeness, ATDD RED. All bodies intentionally skipped.
 * Provider: planned src/server/read-models/scheduling.ts; no HTTP endpoint is specified.
 * These interfaces are TEST-OWNED observations, NOT proposed production exports or URLs.
 * Activation: implement the adapter against the actual reader + existing local DB/auth
 * factories, remove skip for the current task, observe RED, then implement behavior.
 * Never implement read() by returning seed rows or by computing the expectations here.
 * Preserve the raw client-bound payload in raw; normalization must not hide leaks.
 * @seontechnologies/playwright-utils deviation: this is the project's Vitest INT lane,
 * not the Playwright runner; direct server-reader/RLS verification has no HTTP contract.
 */
type View = "schema" | "resources" | "team" | "capacity" | "personal";
type Source = "bookings" | "conflicts" | "roster" | "shifts" | "exceptions" | "calendar";
type Actor = "manager" | "own" | "peer" | "denied" | "foreign" | "anonymous";
type ReadInput = {
  readonly view: View;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly filters?: {
    readonly personId?: string;
    readonly workRoleId?: string;
    readonly jobId?: string;
    readonly customerId?: string;
  };
  // Untrusted inputs forwarded only if an actual route/action accepts them;
  // otherwise the adapter must exercise the corresponding forged request context.
  readonly tamper?: { readonly tenantId?: string; readonly personId?: string; readonly actorId?: string };
};
type BookingObservation = {
  readonly id: string;
  readonly assigneeIds: readonly string[];
  readonly assigneeLabels: readonly string[];
};
type ReadObservation = {
  readonly outcome: "ready" | "denied" | "retryable-error";
  readonly canManage: boolean;
  readonly views: readonly View[];
  readonly bookings: readonly BookingObservation[];
  readonly openConflictCount: number | null;
  readonly errorMessage: string | null;
  readonly raw: unknown;
  // Paths copied verbatim from the real descriptor, not invented by normalization.
  readonly withheld: readonly string[];
};
type ReadTrace = {
  readonly source: Source | "identity-picker" | "profiles" | "hours" | "calendar-table";
  readonly tenantId: string;
  readonly from: number;
  readonly to: number;
  readonly orderBy: string;
  readonly returnedIds: readonly string[];
  readonly failed: boolean;
};
type SeedBooking = {
  readonly id: string;
  readonly tenantId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly assigneeIds: readonly string[];
  readonly status: "planned";
  readonly jobId: string;
  readonly customerId: string;
  readonly workRoleId: string;
  readonly description: string;
};
type Scenario = {
  readonly tenantId: string;
  readonly foreignTenantId: string;
  readonly actorId: string;
  readonly ownPersonId: string;
  readonly peerPersonId: string;
  readonly foreignPersonId: string;
  readonly jobId: string;
  readonly customerId: string;
  readonly workRoleId: string;
  readonly foreignJobId: string;
  readonly foreignCustomerId: string;
  readonly foreignWorkRoleId: string;
  readonly own: SeedBooking;
  readonly peer: SeedBooking;
  readonly shared: SeedBooking;
  readonly foreign: SeedBooking;
  readonly privateMarkers: readonly string[];
};
type Options = {
  readonly managerRoles?: readonly TenantRole[];
  readonly ownRoles?: readonly TenantRole[];
  readonly deniedRoles?: readonly TenantRole[];
  readonly paging?: { readonly source: Source; readonly count: number };
};
type GestureProposal = {
  readonly kind: "create" | "move" | "resize";
  readonly bookingId?: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly assigneeIds: readonly string[];
};
type ReadHarness = {
  readonly scenario: Scenario;
  read(actor: Actor, input: ReadInput): Promise<ReadObservation>;
  // Snapshot bookings/assignees/conflicts, command outcomes and audit rows in both
  // tenants. Fixture-admin helpers may inspect/seed, never substitute for reader JWT.
  snapshotPersistence(): Promise<unknown>;
  trace(): readonly ReadTrace[];
  clearTrace(): void;
  setRoles(actor: Actor, roles: readonly TenantRole[]): Promise<void>;
  deactivateMembership(actor: Actor): Promise<void>;
  // Retains the previously issued auth session so revocation tests exercise live checks.
  // Expected IDs come from seed plans independent of the reader, including page-edge sentinels.
  expectedSourceIds(source: Source): readonly string[];
  expectedOwnOpenConflictCount(): number;
  failSourcePage(source: Source, offset: number, privateMessage: string): void;
  clearSourceFailure(): void;
  // Executes the actual existing checked save/action boundary with no preview/review
  // authority; NEVER a fake "calendar save" endpoint and never a guessed receipt field.
  tryUnreviewedSave(actor: Actor, proposal: GestureProposal): Promise<{ readonly saved: boolean }>;
  dispose(): Promise<void>;
};

const PERIOD = { startsAt: "2026-10-11T22:00:00.000000Z", endsAt: "2026-10-18T22:00:00.000000Z" };
const VIEWS: readonly View[] = ["schema", "resources", "team", "capacity", "personal"];

/** Isolated fixture intent. UUIDs avoid parallel collisions; bounds and labels are fixed goldens. */
function scenarioFactory(): Scenario {
  const tenantId = randomUUID(), foreignTenantId = randomUUID();
  const actorId = randomUUID(), ownPersonId = randomUUID(), peerPersonId = randomUUID(), foreignPersonId = randomUUID();
  const jobId = randomUUID(), customerId = randomUUID(), workRoleId = randomUUID();
  const foreignJobId = randomUUID(), foreignCustomerId = randomUUID(), foreignWorkRoleId = randomUUID();
  const booking = (overrides: Partial<SeedBooking>): SeedBooking => ({
    id: randomUUID(), tenantId, startsAt: "2026-10-12T06:30:00.000000Z", endsAt: "2026-10-12T08:00:00.000000Z",
    assigneeIds: [ownPersonId], status: "planned", jobId, customerId, workRoleId,
    description: "Elcentral och felsökning", ...overrides,
  });
  return {
    tenantId, foreignTenantId, actorId, ownPersonId, peerPersonId, foreignPersonId,
    jobId, customerId, workRoleId, foreignJobId, foreignCustomerId, foreignWorkRoleId,
    own: booking({}), peer: booking({ assigneeIds: [peerPersonId] }),
    shared: booking({ assigneeIds: [ownPersonId, peerPersonId] }),
    foreign: booking({ tenantId: foreignTenantId, assigneeIds: [foreignPersonId], jobId: foreignJobId,
      customerId: foreignCustomerId, workRoleId: foreignWorkRoleId, description: "OTHER_TENANT_BOOKING_SECRET" }),
    // Wire these to ACTUAL existing private columns/identity labels in the DB fixture.
    // Do not seed made-up columns; not every marker belongs to the same relation.
    privateMarkers: ["PEER_IDENTITY_SECRET", "FOREIGN_IDENTITY_SECRET", "PRIVATE_CONTACT_SECRET", "PRIVATE_MONEY_SECRET"],
  };
}

async function createHarness(_scenario: Scenario, _options: Options): Promise<ReadHarness> {
  throw new Error("ATDD_UNBOUND: wire the actual scheduling reader, local role-aware DB fixtures, raw payload capture and transport trace; no production read API exists yet");
}

async function withHarness(options: Options, run: (h: ReadHarness) => Promise<void>): Promise<void> {
  const h = await createHarness(scenarioFactory(), options);
  try { await run(h); } finally { await h.dispose(); }
}
function request(view: View = "schema", extras: Partial<ReadInput> = {}): ReadInput { return { view, ...PERIOD, ...extras }; }
function sortedIds(rows: readonly BookingObservation[]): string[] { return rows.map(row => row.id).sort(); }

describe("15.1 scheduling authenticated read boundary (ATDD RED, unbound)", () => {
  for (const role of ["tenant_admin", "projektledare"] as const) {
    test.skip(`[P0][15.1-INT-001][AC2] ${role} receives all five views and exact current-tenant bookings`, async () => {
      // Given real same/other tenant bookings and a manager whose self profile is the own fixture.
      await withHarness({ managerRoles: [role] }, async h => {
        for (const view of VIEWS) {
          // When the actual server reader receives the same period in each view.
          const result = await h.read("manager", request(view));
          const expected = view === "personal" ? [h.scenario.own.id, h.scenario.shared.id] :
            [h.scenario.own.id, h.scenario.peer.id, h.scenario.shared.id];
          // Then personal intersects authenticated self; all planner projections retain the shared set.
          expect({ outcome: result.outcome, canManage: result.canManage, views: result.views, ids: sortedIds(result.bookings) })
            .toEqual({ outcome: "ready", canManage: true, views: VIEWS, ids: expected.sort() });
          expect(JSON.stringify(result.raw)).not.toContain(h.scenario.foreign.id);
        }
      });
    });
  }

  test.skip("[P0][15.1-INT-001][AC2] Montör receives own/shared booking IDs and only its own RLS-visible association", async () => {
    await withHarness({ ownRoles: ["montor"] }, async h => {
      const result = await h.read("own", request("personal"));
      expect({ outcome: result.outcome, canManage: result.canManage, views: result.views, ids: sortedIds(result.bookings) })
        .toEqual({ outcome: "ready", canManage: false, views: ["personal"], ids: [h.scenario.own.id, h.scenario.shared.id].sort() });
      expect(result.bookings.map(row => ({ ids: row.assigneeIds, labels: row.assigneeLabels })))
        .toEqual([{ ids: [h.scenario.ownPersonId], labels: ["Du"] }, { ids: [h.scenario.ownPersonId], labels: ["Du"] }]);
      expect(JSON.stringify(result.raw)).not.toContain(h.scenario.peerPersonId);
      // Distinct peer-only/foreign logical conflicts must not inflate own-visible count.
      expect(result.openConflictCount).toBe(h.expectedOwnOpenConflictCount());
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] own-only read neither calls identity picker nor reads profile/hours/calendar tables", async () => {
    await withHarness({ ownRoles: ["montor"] }, async h => {
      h.clearTrace();
      const result = await h.read("own", request("personal"));
      expect(result.outcome).toBe("ready");
      expect(h.trace().filter(call => ["identity-picker", "profiles", "hours", "calendar-table", "roster", "shifts", "exceptions", "calendar"].includes(call.source)))
        .toEqual([]);
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] own-only raw descriptor omits and lists restricted fields rather than emitting null/zero values", async () => {
    await withHarness({ ownRoles: ["montor"] }, async h => {
      const result = await h.read("own", request("personal"));
      // Assert the RAW production descriptor; adapters must not synthesize withheld paths.
      expect(result.raw).toMatchObject({ data: expect.any(Object), entitlements: { withheld: result.withheld } });
      expect(result.withheld.length).toBeGreaterThan(0);
      const descriptor = result.raw as { data: Record<string, unknown> };
      for (const path of result.withheld) {
        const segments = path.replace(/^data\./, "").split(".");
        let parent: unknown = descriptor.data;
        for (const segment of segments.slice(0, -1)) {
          parent = parent !== null && typeof parent === "object" ? (parent as Record<string, unknown>)[segment] : undefined;
        }
        // Missing ancestors also mean the leaf is absent; a present null leaf fails.
        expect(parent !== null && typeof parent === "object" && Object.hasOwn(parent, segments.at(-1)!)).toBe(false);
      }
      for (const marker of h.scenario.privateMarkers) expect(JSON.stringify(result.raw)).not.toContain(marker);
      expect(JSON.stringify(result.raw)).not.toMatch(/"(?:sales_price_ore|cost_price_ore|contribution_margin_ore|hourly_rate|employmentPercentage|employment_percentage)"\s*:/);
    });
  });

  for (const role of ["saljare", "ekonomi"] as const) {
    test.skip(`[P0][15.1-INT-001][AC2] ${role} is denied despite CRM/economy privileges and direct view navigation`, async () => {
      await withHarness({ deniedRoles: [role] }, async h => {
        for (const view of VIEWS) {
          h.clearTrace();
          const result = await h.read("denied", request(view));
          expect({ outcome: result.outcome, canManage: result.canManage, bookings: result.bookings, views: result.views })
            .toEqual({ outcome: "denied", canManage: false, bookings: [], views: [] });
          expect(h.trace()).toEqual([]);
          expect(result.errorMessage).toBeNull(); // Denial is not a transient read error.
        }
      });
    });
  }

  test.skip("[P0][15.1-INT-001][AC2] unauthenticated direct read has no booking, identity or management authority", async () => {
    await withHarness({}, async h => {
      h.clearTrace();
      const result = await h.read("anonymous", request());
      expect({ outcome: result.outcome, canManage: result.canManage, bookings: result.bookings })
        .toEqual({ outcome: "denied", canManage: false, bookings: [] });
      expect(h.trace()).toEqual([]);
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] secondary Montör grant preserves own-only union access under Säljare", async () => {
    await withHarness({ ownRoles: ["saljare", "montor"] }, async h => {
      const result = await h.read("own", request("personal"));
      expect({ outcome: result.outcome, canManage: result.canManage, views: result.views, ids: sortedIds(result.bookings) })
        .toEqual({ outcome: "ready", canManage: false, views: ["personal"], ids: [h.scenario.own.id, h.scenario.shared.id].sort() });
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] secondary Projektledare grant preserves manager union access under Ekonomi", async () => {
    await withHarness({ managerRoles: ["ekonomi", "projektledare"] }, async h => {
      const result = await h.read("manager", request());
      expect({ outcome: result.outcome, canManage: result.canManage, views: result.views, ids: sortedIds(result.bookings) })
        .toEqual({ outcome: "ready", canManage: true, views: VIEWS, ids: [h.scenario.own.id, h.scenario.peer.id, h.scenario.shared.id].sort() });
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] role revocation on the same authenticated session removes stale manager and own grants", async () => {
    await withHarness({ managerRoles: ["projektledare"], ownRoles: ["saljare", "montor"] }, async h => {
      expect((await h.read("manager", request())).outcome).toBe("ready");
      expect((await h.read("own", request("personal"))).outcome).toBe("ready");
      await h.setRoles("manager", ["saljare"]);
      await h.setRoles("own", ["saljare"]);
      for (const actor of ["manager", "own"] as const) {
        const result = await h.read(actor, request("personal"));
        expect({ outcome: result.outcome, canManage: result.canManage, bookings: result.bookings })
          .toEqual({ outcome: "denied", canManage: false, bookings: [] });
      }
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] inactive current membership cannot reuse previously successful scheduling reads", async () => {
    await withHarness({ managerRoles: ["tenant_admin"] }, async h => {
      expect((await h.read("manager", request())).outcome).toBe("ready");
      await h.deactivateMembership("manager");
      const result = await h.read("manager", request());
      expect({ outcome: result.outcome, canManage: result.canManage, bookings: result.bookings })
        .toEqual({ outcome: "denied", canManage: false, bookings: [] });
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] forged tenant/actor cannot select another tenant or impersonate a manager", async () => {
    await withHarness({ managerRoles: ["tenant_admin"], ownRoles: ["montor"] }, async h => {
      for (const actor of ["manager", "own"] as const) {
        const result = await h.read(actor, request("personal", { tamper: { tenantId: h.scenario.foreignTenantId, actorId: h.scenario.actorId } }));
        expect(JSON.stringify(result.raw)).not.toContain(h.scenario.foreign.id);
        expect(JSON.stringify(result.raw)).not.toContain(h.scenario.foreignPersonId);
        expect(result.bookings.every(row => [h.scenario.own.id, h.scenario.shared.id].includes(row.id))).toBe(true);
        if (actor === "own") expect(result.canManage).toBe(false);
        expect(h.trace().every(call => call.tenantId === h.scenario.tenantId)).toBe(true);
      }
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] own-only peer person/filter and planner-view tampering cannot widen the own slice", async () => {
    await withHarness({ ownRoles: ["montor"] }, async h => {
      for (const view of VIEWS) {
        const result = await h.read("own", request(view, { filters: { personId: h.scenario.peerPersonId }, tamper: { personId: h.scenario.peerPersonId } }));
        expect(result.bookings.every(row => [h.scenario.own.id, h.scenario.shared.id].includes(row.id))).toBe(true);
        expect(result.views.every(allowed => allowed === "personal")).toBe(true);
        expect(result.canManage).toBe(false);
        expect(JSON.stringify(result.raw)).not.toContain(h.scenario.peerPersonId);
      }
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] foreign person/job/customer/work-role filters never disclose foreign records or labels", async () => {
    await withHarness({ managerRoles: ["tenant_admin"] }, async h => {
      const filters: NonNullable<ReadInput["filters"]>[] = [
        { personId: h.scenario.foreignPersonId }, { jobId: h.scenario.foreignJobId },
        { customerId: h.scenario.foreignCustomerId }, { workRoleId: h.scenario.foreignWorkRoleId },
      ];
      for (const filter of filters) {
        const result = await h.read("manager", request("schema", { filters: filter }));
        expect(JSON.stringify(result.raw)).not.toContain(h.scenario.foreign.id);
        expect(JSON.stringify(result.raw)).not.toContain("OTHER_TENANT_BOOKING_SECRET");
        expect(JSON.stringify(result.raw)).not.toContain("FOREIGN_IDENTITY_SECRET");
        expect(h.trace().every(call => call.tenantId === h.scenario.tenantId)).toBe(true);
      }
    });
  });

  test.skip("[P0][15.1-INT-001][AC2] all successful view reads leave booking/conflict/outcome/audit state unchanged", async () => {
    await withHarness({ managerRoles: ["tenant_admin"], ownRoles: ["montor"] }, async h => {
      const before = await h.snapshotPersistence();
      for (const view of VIEWS) await h.read("manager", request(view));
      await h.read("own", request("personal"));
      expect(await h.snapshotPersistence()).toEqual(before);
    });
  });

  test.skip("[P0][15.1-INT-001][AC2/5] calendar create/move/resize proposals supply no mutation authority or reviewed conflict acceptance", async () => {
    await withHarness({ managerRoles: ["tenant_admin"], ownRoles: ["montor"] }, async h => {
      const before = await h.snapshotPersistence();
      // Positive-demand shared booking supplies actual overlapping/conflicting persisted facts.
      const base = { startsAt: h.scenario.shared.startsAt, endsAt: h.scenario.shared.endsAt, assigneeIds: [h.scenario.ownPersonId] };
      const proposals: GestureProposal[] = [
        { kind: "create", ...base }, { kind: "move", bookingId: h.scenario.own.id, ...base },
        { kind: "resize", bookingId: h.scenario.own.id, ...base, endsAt: "2026-10-12T09:30:00.000000Z" },
      ];
      for (const actor of ["manager", "own"] as const) {
        await h.read(actor, request("personal"));
        for (const proposal of proposals) expect(await h.tryUnreviewedSave(actor, proposal)).toEqual({ saved: false });
      }
      // The adapter must not generate a preview receipt/review decision on the caller's behalf.
      expect(await h.snapshotPersistence()).toEqual(before);
    });
  });
});

describe("15.1 complete paged read and honest failures (ATDD RED, unbound)", () => {
  for (const count of [501, 1001]) {
    test.skip(`[P0][15.1-INT-001][AC1/2] ${count} in-period bookings retain exact IDs beyond every 500-row boundary`, async () => {
      await withHarness({ managerRoles: ["tenant_admin"], paging: { source: "bookings", count } }, async h => {
        const expected = [...h.expectedSourceIds("bookings")].sort();
        const result = await h.read("manager", request());
        expect(result.outcome).toBe("ready");
        expect(sortedIds(result.bookings)).toEqual(expected);
        expect(result.bookings).toHaveLength(count);
        const pages = h.trace().filter(call => call.source === "bookings");
        expect(pages.map(page => ({ from: page.from, to: page.to, orderBy: page.orderBy })))
          .toEqual(Array.from({ length: Math.ceil(count / 500) }, (_, i) => ({ from: i * 500, to: i * 500 + 499, orderBy: "id:asc" })));
        expect(pages.flatMap(page => page.returnedIds).sort()).toEqual(expected);
      });
    });
  }

  for (const source of ["conflicts", "roster", "shifts", "exceptions", "calendar"] as const) {
    test.skip(`[P1][15.1-INT-001][AC1/2] ${source} facts use complete stable pages beyond 500 without a tenant-wide hidden fallback`, async () => {
      // Calendar requires valid rows reachable by the actual query. If period predicates
      // prevent >500 returned dates, exercise the actual shared paging helper through an
      // instrumented transport instead; record that distinction, never widen public periods.
      await withHarness({ managerRoles: ["tenant_admin"], paging: { source, count: 501 } }, async h => {
        const result = await h.read("manager", request());
        expect(result.outcome).toBe("ready");
        const pages = h.trace().filter(call => call.source === source);
        expect(pages.map(page => ({ from: page.from, to: page.to, orderBy: page.orderBy })))
          .toEqual([{ from: 0, to: 499, orderBy: "id:asc" }, { from: 500, to: 999, orderBy: "id:asc" }]);
        expect(pages.flatMap(page => page.returnedIds).sort()).toEqual([...h.expectedSourceIds(source)].sort());
        expect(pages.every(page => page.tenantId === h.scenario.tenantId)).toBe(true);
      });
    });
  }

  for (const source of ["bookings", "conflicts", "roster", "shifts", "exceptions", "calendar"] as const) {
    test.skip(`[P0][15.1-INT-001][AC1/3] failed final ${source} page is retryable, never partial/empty/conflict-free or stale-success`, async () => {
      await withHarness({ managerRoles: ["tenant_admin"], paging: { source, count: 1001 } }, async h => {
        // Given a prior successful read and a private error on the page at offset 1000.
        expect((await h.read("manager", request())).outcome).toBe("ready");
        h.clearTrace();
        h.failSourcePage(source, 1000, "PRIVATE_DATABASE_FINAL_PAGE_SECRET");
        // When the same toolbar state reads again, only the current attempt is authoritative.
        const result = await h.read("manager", request());
        // Then no partial rows, old list, denial, or zero-conflict assertion replaces failure.
        expect({ outcome: result.outcome, bookings: result.bookings, openConflictCount: result.openConflictCount })
          .toEqual({ outcome: "retryable-error", bookings: [], openConflictCount: null });
        expect(result.errorMessage).toMatch(/Försök igen/);
        expect(JSON.stringify(result.raw)).not.toContain("PRIVATE_DATABASE_FINAL_PAGE_SECRET");
        expect(h.trace().some(page => page.source === source && page.from === 1000 && page.failed)).toBe(true);
        h.clearSourceFailure();
        expect((await h.read("manager", request())).outcome).toBe("ready");
      });
    });
  }
});
