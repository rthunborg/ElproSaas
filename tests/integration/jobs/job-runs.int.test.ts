import { describe, expect, test } from "vitest";

type JobRunContractHarness = {
  inspectCatalog(): Promise<{
    forceRls: boolean;
    tenantScoped: boolean;
    hasRequiredConstraints: boolean;
    hasRunLookupIndex: boolean;
    publicMutationGrants: string[];
    tenantTables: string[];
  }>;
  writeAsContainedService(): Promise<{ run: { tenant_id: string; producer: string }; audit: { actor_user_id: string | null; command: string; correlation_id: string } }>;
  assertTenantACannotAccessTenantB(): Promise<void>;
};
const redPhaseJobRunsHarness = (): JobRunContractHarness => {
  throw new Error("Story 13.1 job_runs integration harness is not implemented yet.");
};

describe("13.1 job_runs migration and system audit contract (RED)", () => {
  test.skip("[P0] fresh reset exposes forced RLS, narrow grants, protected schema, and H4 enrollment", async () => {
    const contract = await redPhaseJobRunsHarness().inspectCatalog();

    expect(contract.forceRls).toBe(true);
    expect(contract.tenantScoped).toBe(true);
    expect(contract.hasRequiredConstraints).toBe(true);
    expect(contract.hasRunLookupIndex).toBe(true);
    expect(contract.publicMutationGrants).toEqual([]);
    expect(contract.tenantTables).toContain("job_runs");
  });

  test.skip("[P0] contained producer writes record a null-actor audit and attributable job run", async () => {
    const { run, audit } = await redPhaseJobRunsHarness().writeAsContainedService();

    expect(run.tenant_id).toBe("fixture-tenant-a");
    expect(run.producer).toBe("notifications.dispatch");
    expect(audit.actor_user_id).toBeNull();
    expect(audit.command).toBe("jobs.notifications.dispatch");
    expect(audit.correlation_id).toBe("job-run-correlation-1");
  });

  test.skip("[P1] tenant canaries cannot read or mutate another tenant's job run or system audit", async () => {
    await expect(redPhaseJobRunsHarness().assertTenantACannotAccessTenantB()).resolves.toBeUndefined();
  });
});
