/**
 * Story 14.1 ATDD red-phase command scaffold. The dynamic imports intentionally
 * postpone module resolution until a developer activates an individual scenario.
 */
import { expect, test } from "vitest";

const personProfilesModulePath = "../../../src/server/commands/resources/person-profiles";
const workHoursModulePath = "../../../src/server/commands/resources/work-hours";
const calendarDaysModulePath = "../../../src/server/commands/resources/calendar-days";

test.skip("[P0] creates at most one profile for a membership and accepts only an active same-tenant default work role", async () => {
  const commands = await import(personProfilesModulePath) as {
    createOrUpdatePersonProfile?: (input: unknown) => Promise<{ ok: boolean; profileId?: string }>;
  };
  expect(commands.createOrUpdatePersonProfile).toBeDefined();

  const first = await commands.createOrUpdatePersonProfile?.({
    membershipId: "fixture-tenant-a-membership",
    defaultWorkRoleId: "fixture-tenant-a-active-work-role",
  });
  const duplicate = await commands.createOrUpdatePersonProfile?.({
    membershipId: "fixture-tenant-a-membership",
    defaultWorkRoleId: "fixture-tenant-b-work-role",
  });

  expect(first?.ok).toBe(true);
  expect(duplicate?.ok).toBe(false);
});

test.skip("[P0] rejects invalid normalized schedules and calendar inputs without partially persisting profile, hours, or calendar rows", async () => {
  const workHours = await import(workHoursModulePath) as {
    savePersonWorkHours?: (input: unknown) => Promise<{ ok: boolean }>;
  };
  const calendarDays = await import(calendarDaysModulePath) as {
    saveTenantCalendarDay?: (input: unknown) => Promise<{ ok: boolean }>;
  };
  const hours = await workHours.savePersonWorkHours?.({
    membershipId: "fixture-tenant-a-membership",
    shifts: [{ weekday: 1, start: "07:00", end: "16:00" }, { weekday: 1, start: "15:00", end: "18:00" }],
  });
  const calendar = await calendarDays.saveTenantCalendarDay?.({
    date: "2026-12-24",
    variant: "reduced_capacity",
    reductionPercent: 101,
  });

  expect(hours?.ok).toBe(false);
  expect(calendar?.ok).toBe(false);
});

test.skip("[P0] resolves tenant identity from membership and rejects client-supplied or foreign tenant identity", async () => {
  const commands = await import(personProfilesModulePath) as {
    createOrUpdatePersonProfile?: (input: unknown) => Promise<{ ok: boolean }>;
  };
  const result = await commands.createOrUpdatePersonProfile?.({
    tenantId: "forged-tenant-b-id",
    membershipId: "fixture-tenant-a-membership",
    defaultWorkRoleId: "fixture-tenant-a-active-work-role",
  });
  expect(result?.ok).toBe(false);
});
