/**
 * Epic 12 12.X-PERF-001: a non-gating, local-only pilot baseline.
 *
 * This harness measures two actual authenticated Supabase RPC boundaries:
 * - provision_tenant: the elapsed local API/database round trip for one approved
 *   provisioning request.
 * - operator_console_projection: the elapsed local API/database round trip for
 *   the console read-model over the documented pilot fixture.
 *
 * It does not measure a Next.js route, browser rendering, Auth-provider email
 * delivery, or database-internal statement count. The latter is intentionally
 * reported as unobserved rather than inferred from a REST/RPC request count.
 *
 * Run only against the existing local stack:
 *   $env:SUPABASE_TEST_REQUIRED='1'
 *   node --experimental-strip-types --import ./tests/support/register.mjs scripts/nfr/epic-12-performance-baseline.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { canonicalizeProvisioningRequest, createProvisioningPreview } from "@/server/commands/provisioning/validation";
import { signProvisioningAttestation, type ProvisioningAttestation } from "@/server/provisioning/attestation";
import { findProvisioningBaseline } from "@/server/provisioning/baselines";
import { closeAdminPool, adminQuery, adminSession } from "../../tests/factories/admin-sql";
import {
  admin,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
} from "../../tests/factories/tenants/core";
import {
  assertLocalStack,
  isLocalStackReachable,
  LOCAL_SUPABASE_DB_URL,
  LOCAL_SUPABASE_URL,
  LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID,
  LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET,
} from "../../tests/support/test-env";

const PROVISIONING_SAMPLES = 12;
const CONSOLE_WARMUPS = 3;
const CONSOLE_SAMPLES = 12;
const OUTPUT = resolve(process.cwd(), process.env.EPIC12_PERF_OUTPUT ?? "_bmad-output/test-artifacts/epic-12-performance-baseline.json");

type Distribution = {
  readonly sampleCount: number;
  readonly minMs: number;
  readonly medianMs: number;
  readonly p90Ms: number;
  readonly maxMs: number;
  readonly samplesMs: readonly number[];
};

type ProvisionedFixture = {
  readonly tenantId: string;
  readonly normalizedOrganizationNumber: string;
};

type StrictProvisioningRequest = {
  readonly schema_version: 1;
  readonly request_id: string;
  readonly legal_name: string;
  readonly country_code: "SE";
  readonly organization_number: string;
  readonly vat_registration_number: string;
  readonly first_admin_name: string;
  readonly first_admin_email: string;
  readonly baseline_profile_id: string;
  readonly baseline_profile_version: number;
  readonly subscription_plan_id: string;
  readonly subscription_status: "active";
  readonly included_user_count: number;
  readonly additional_user_price_ore: number;
  readonly contract_start_date: string;
};

function exactLocalTarget(): void {
  if (LOCAL_SUPABASE_URL !== "http://127.0.0.1:54321") {
    throw new Error(`12.X-PERF-001 requires http://127.0.0.1:54321; received ${LOCAL_SUPABASE_URL}.`);
  }
  const database = new URL(LOCAL_SUPABASE_DB_URL);
  if (database.protocol !== "postgresql:" || database.hostname !== "127.0.0.1" || database.port !== "54322" || database.pathname !== "/postgres") {
    throw new Error("12.X-PERF-001 requires PostgreSQL at 127.0.0.1:54322/postgres.");
  }
}

function percentile(sorted: readonly number[], ratio: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]!;
}

function distribution(samples: readonly number[]): Distribution {
  if (samples.length === 0 || samples.some((sample) => !Number.isFinite(sample) || sample < 0)) {
    throw new Error("Benchmark samples must be finite, non-negative measurements.");
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[Math.floor(middle)]!;
  return {
    sampleCount: sorted.length,
    minMs: sorted[0]!,
    medianMs: median,
    p90Ms: percentile(sorted, 0.9),
    maxMs: sorted.at(-1)!,
    samplesMs: samples,
  };
}

function luhnCheckDigit(stem: string): string {
  const sum = [...stem].reduce((total, digit, index) => {
    const doubled = Number(digit) * (index % 2 === 0 ? 2 : 1);
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return String((10 - (sum % 10)) % 10);
}

async function createPilotProvisioningRequest(): Promise<StrictProvisioningRequest> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const digits = crypto.randomUUID().replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
    const organizationNumber = `556${digits}${luhnCheckDigit(`556${digits}`)}`;
    const input: StrictProvisioningRequest = {
      schema_version: 1,
      request_id: crypto.randomUUID(),
      legal_name: `Performance pilot ${organizationNumber} AB`,
      country_code: "SE",
      organization_number: organizationNumber,
      vat_registration_number: `SE${organizationNumber}01`,
      first_admin_name: "Performance Pilot Admin",
      first_admin_email: `pilot-${organizationNumber}@example.test`,
      baseline_profile_id: "standard-se",
      baseline_profile_version: 1,
      subscription_plan_id: "pro",
      subscription_status: "active",
      included_user_count: 5,
      additional_user_price_ore: 12_500,
      contract_start_date: "2026-10-01",
    };
    try {
      canonicalizeProvisioningRequest(input);
      return input;
    } catch { /* Retry a new synthetic Swedish organization identity. */ }
  }
  throw new Error("Unable to construct a valid synthetic pilot provisioning request.");
}

function approvedProvisioningPayload(input: StrictProvisioningRequest, actorUserId: string): Record<string, unknown> {
  const baseline = findProvisioningBaseline(input.baseline_profile_id, input.baseline_profile_version);
  if (!baseline) throw new Error("Pilot provisioning baseline is unavailable.");
  const canonical = canonicalizeProvisioningRequest(input);
  const preview = createProvisioningPreview(input, baseline);
  const issuedAt = new Date().toISOString();
  const attestation: ProvisioningAttestation = {
    action: "provision",
    actorUserId,
    requestId: input.request_id,
    requestHash: canonical.canonicalRequestHash,
    organizationNumber: canonical.normalizedOrganizationNumber,
    previewHash: preview.preview_hash,
    firstAdminEmail: canonical.firstAdminEmail,
    explicitApproval: true,
    baselineId: baseline.id,
    baselineVersion: baseline.version,
    baselineContentHash: baseline.contentHash,
    tokenHash: "0".repeat(64),
    reservationId: "",
    dispatchGeneration: 0,
    approvalGeneration: 1,
    outcome: "",
    keyId: LOCAL_TEST_PROVISIONING_ATTESTATION_KEY_ID,
    issuedAt,
    expiresAt: new Date(Date.parse(issuedAt) + 120_000).toISOString(),
  };
  return {
    p_action: "provision",
    p_request: {
      request: input,
      preview_hash: preview.preview_hash,
      explicit_approval: true,
      attestation,
      attestation_signature: signProvisioningAttestation(attestation, LOCAL_TEST_PROVISIONING_ATTESTATION_SECRET),
    },
  };
}

async function cleanupProvisionedTenants(tenantIds: readonly string[]): Promise<void> {
  if (tenantIds.length === 0) return;
  await adminSession(async ({ query }) => {
    await query("begin");
    try {
      // Audit immutability prevents ordinary DELETE. This session-local switch is
      // limited to this harness's generated tenant ids and restored before tenant
      // deletion, matching the existing provisioning fixture teardown contract.
      await query("set local session_replication_role = replica");
      await query("delete from public.audit_events where tenant_id = any($1::uuid[])", [tenantIds]);
      await query("set local session_replication_role = origin");
      await query("delete from public.tenant_provisioning_requests where tenant_id = any($1::uuid[])", [tenantIds]);
      await query("delete from public.tenants where id = any($1::uuid[])", [tenantIds]);
      await query("commit");
    } catch (error) {
      await query("rollback");
      throw error;
    }
  });
}

async function main(): Promise<void> {
  if (process.env.SUPABASE_TEST_REQUIRED !== "1") {
    throw new Error("Set SUPABASE_TEST_REQUIRED=1: 12.X-PERF-001 must fail loudly when its local dependency is unavailable.");
  }
  exactLocalTarget();
  assertLocalStack();
  if (!(await isLocalStackReachable())) throw new Error("Local Supabase Auth at 127.0.0.1:54321 is unreachable.");

  const fixture = await createTwoTenantFixture();
  const provisioned: ProvisionedFixture[] = [];
  try {
    const operatorSeed = await admin().from("platform_operators").insert({ user_id: fixture.adminA.id, granted_by: fixture.adminA.id });
    if (operatorSeed.error) throw new Error(`Pilot platform-operator fixture failed: ${operatorSeed.error.message}`);
    const client = await makeAuthedServerClient(fixture.adminA);
    const operatorCheck = await client.rpc("is_platform_operator");
    if (operatorCheck.error || operatorCheck.data !== true) throw new Error("Pilot operator precondition was denied.");
    const beforePilotList = await client.rpc("operator_console_projection", { p_tenant_id: null });
    if (beforePilotList.error || !Array.isArray(beforePilotList.data)) throw new Error("Pilot pre-existing console-list observation failed.");
    const preexistingConsoleRowsBeforePilot = beforePilotList.data.length;

    const provisioningSamplesMs: number[] = [];
    for (let index = 0; index < PROVISIONING_SAMPLES; index += 1) {
      const input = await createPilotProvisioningRequest();
      const canonical = canonicalizeProvisioningRequest(input);
      const startedAt = performance.now();
      const response = await client.rpc("provision_tenant", approvedProvisioningPayload(input, fixture.adminA.id));
      provisioningSamplesMs.push(performance.now() - startedAt);
      if (response.error) throw new Error(`provision_tenant sample ${index + 1} failed: ${response.error.code ?? response.error.message}`);
      const data = response.data as { tenantId?: string; provisioningState?: string } | null;
      if (!data?.tenantId || data.provisioningState !== "pending_first_admin_invite") {
        throw new Error(`provision_tenant sample ${index + 1} did not return the expected pending first-Admin state.`);
      }
      provisioned.push({ tenantId: data.tenantId, normalizedOrganizationNumber: canonical.normalizedOrganizationNumber });
    }

    const tenantIds = provisioned.map(({ tenantId }) => tenantId);
    const persisted = await adminQuery<{
      id: string;
      country_code: string;
      normalized_organization_number: string;
      provisioning_state: string;
      invited_count: string;
    }>(
      `select t.id, t.country_code, t.normalized_organization_number, t.provisioning_state,
              count(m.id)::text as invited_count
       from public.tenants t
       left join public.tenant_memberships m on m.tenant_id = t.id and m.status = 'invited'
       where t.id = any($1::uuid[])
       group by t.id`,
      [tenantIds],
    );
    const expectedNumbers = new Set(provisioned.map(({ normalizedOrganizationNumber }) => normalizedOrganizationNumber));
    if (persisted.length !== PROVISIONING_SAMPLES || persisted.some((row) => row.country_code !== "SE" || !expectedNumbers.has(row.normalized_organization_number) || row.provisioning_state !== "pending_first_admin_invite" || row.invited_count !== "1")) {
      throw new Error("Pilot provisioning persistence did not retain every canonical identity and invited first-Admin state.");
    }

    const syntheticIdentities = new Set([...expectedNumbers].map((number) => `SE:${number}`));
    const listSyntheticRowCount = (rows: readonly Record<string, unknown>[]) => rows.filter((row) => syntheticIdentities.has(String(row.canonical_organisation_identity))).length;
    const firstConsoleList = await client.rpc("operator_console_projection", { p_tenant_id: null });
    const firstListRows = firstConsoleList.data as Array<Record<string, unknown>> | null;
    if (firstConsoleList.error || !Array.isArray(firstListRows) || listSyntheticRowCount(firstListRows) !== PROVISIONING_SAMPLES) {
      throw new Error("The real operator_console_projection list did not contain every generated canonical identity.");
    }
    const observedConsoleListRows = firstListRows.length;
    const observedNonSyntheticConsoleListRows = observedConsoleListRows - PROVISIONING_SAMPLES;

    // The local database is shared with other bounded verification work, so the
    // unfiltered console list can contain unrelated disposable rows. Targeting
    // each generated tenant keeps this pilot's read dataset exact without a reset.
    for (const expected of provisioned) {
      const response = await client.rpc("operator_console_projection", { p_tenant_id: expected.tenantId });
      const rows = response.data as Array<Record<string, unknown>> | null;
      if (response.error || !Array.isArray(rows) || rows.length !== 1 || rows[0]?.canonical_organisation_identity !== `SE:${expected.normalizedOrganizationNumber}`) {
        throw new Error("A real operator_console_projection detail result did not contain its generated canonical identity.");
      }
    }

    for (let index = 0; index < CONSOLE_WARMUPS; index += 1) {
      const response = await client.rpc("operator_console_projection", { p_tenant_id: null });
      const rows = response.data as Array<Record<string, unknown>> | null;
      if (response.error || !Array.isArray(rows) || listSyntheticRowCount(rows) !== PROVISIONING_SAMPLES) throw new Error("Console-list warmup failed.");
    }
    const consoleListSamplesMs: number[] = [];
    for (let index = 0; index < CONSOLE_SAMPLES; index += 1) {
      const startedAt = performance.now();
      const response = await client.rpc("operator_console_projection", { p_tenant_id: null });
      consoleListSamplesMs.push(performance.now() - startedAt);
      const rows = response.data as Array<Record<string, unknown>> | null;
      if (response.error || !Array.isArray(rows) || listSyntheticRowCount(rows) !== PROVISIONING_SAMPLES) throw new Error(`Console-list sample ${index + 1} failed.`);
    }

    for (let index = 0; index < CONSOLE_WARMUPS; index += 1) {
      const tenant = provisioned[index % provisioned.length]!;
      const response = await client.rpc("operator_console_projection", { p_tenant_id: tenant.tenantId });
      if (response.error || !Array.isArray(response.data) || response.data.length !== 1) throw new Error("Console warmup failed.");
    }
    const consoleSamplesMs: number[] = [];
    for (let index = 0; index < CONSOLE_SAMPLES; index += 1) {
      const tenant = provisioned[index % provisioned.length]!;
      const startedAt = performance.now();
      const response = await client.rpc("operator_console_projection", { p_tenant_id: tenant.tenantId });
      consoleSamplesMs.push(performance.now() - startedAt);
      if (response.error || !Array.isArray(response.data) || response.data.length !== 1) throw new Error(`Console sample ${index + 1} failed.`);
    }

    const [databaseVersion] = await adminQuery<{ version: string }>("select current_setting('server_version') as version");
    const report = {
      schemaVersion: 1,
      benchmark: "12.X-PERF-001",
      measuredAt: new Date().toISOString(),
      status: "measured_non_gating",
      environment: {
        target: "local loopback Supabase only",
        apiUrl: "http://127.0.0.1:54321",
        databaseTarget: "127.0.0.1:54322/postgres",
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        postgres: databaseVersion?.version ?? "unavailable",
      },
      dataset: {
        preexistingFixtureTenants: 2,
        platformOperators: 1,
        provisionedConsoleRows: PROVISIONING_SAMPLES,
        totalPilotTenantRows: 2 + PROVISIONING_SAMPLES,
        operatorConsoleListRowsBeforeSyntheticFixture: preexistingConsoleRowsBeforePilot,
        operatorConsoleListRowsObservedDuringMeasurement: observedConsoleListRows,
        syntheticConsoleListRowsObservedDuringMeasurement: PROVISIONING_SAMPLES,
        nonSyntheticConsoleListRowsObservedDuringMeasurement: observedNonSyntheticConsoleListRows,
        normalizedCountry: "SE",
        firstAdminState: "invited / pending_first_admin_invite",
      },
      provisioning: {
        measuredLayer: "authenticated client to provision_tenant RPC local API/database round trip",
        coldCandidate: { sampleNumber: 1, elapsedMs: provisioningSamplesMs[0] },
        subsequentSamples: distribution(provisioningSamplesMs.slice(1)),
        allSamples: distribution(provisioningSamplesMs),
        observedRequestsPerMeasuredProvision: {
          provisionTenantRpc: 1,
          serverPreviewRpc: 0,
          reservationRpc: 0,
          providerDeliveryRequests: 0,
          totalObservedRpcRequests: 1,
        },
      },
      consoleListRead: {
        measuredLayer: "authenticated client to unfiltered operator_console_projection list RPC local API/database round trip",
        warmupRequests: CONSOLE_WARMUPS,
        measuredSamples: distribution(consoleListSamplesMs),
        observedRequestsPerMeasuredRead: {
          operatorConsoleProjectionRpc: 1,
          totalObservedRpcRequests: 1,
        },
      },
      consoleDetailRead: {
        measuredLayer: "authenticated client to operator_console_projection detail RPC local API/database round trip",
        warmupRequests: CONSOLE_WARMUPS,
        measuredSamples: distribution(consoleSamplesMs),
        observedRequestsPerMeasuredRead: {
          operatorConsoleProjectionRpc: 1,
          totalObservedRpcRequests: 1,
        },
      },
      queryCountInterpretation: {
        applicationOrReadModelRequestCount: "Observed RPC dispatches above; this is an HTTP/API boundary count.",
        databaseInternalSqlStatementCount: "unobserved; no SQL count is inferred from RPC dispatches.",
      },
      validation: {
        provisioningNormalizedIdentityAndFinalState: "verified for every generated tenant",
        consoleRows: "verified as server-produced operator_console_projection results for every generated canonical identity",
      },
      limitations: [
        "The first provisioning sample is a cold candidate after fixture setup; no cache, process, or service restart was performed, so it is not a clean cold-start experiment.",
        "This excludes Next.js route rendering, browser hydration, platform-operator action-wrapper authorization, and invitation-provider delivery.",
        "The list metric contains the absolute observed local list shape, including any unrelated disposable rows; synthetic and non-synthetic row counts are recorded separately.",
        "This is a sequential local pilot dataset, not a throughput, concurrency, capacity, hosted-environment, or production SLO measurement.",
        "No numeric pass/fail threshold is asserted by this harness.",
      ],
      cleanup: "Scoped generated provisioning tenants, associated provisioning rows/audit rows, platform operator, base tenants, and test Auth users are removed in finally.",
    } as const;
    await mkdir(dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ output: OUTPUT, provisioning: report.provisioning.allSamples, consoleList: report.consoleListRead.measuredSamples, consoleDetail: report.consoleDetailRead.measuredSamples }, null, 2));
  } finally {
    try {
      await cleanupProvisionedTenants(provisioned.map(({ tenantId }) => tenantId));
      if (provisioned.length > 0) {
        const [residual] = await adminQuery<{ count: string }>(
          "select count(*)::text as count from public.tenants where id = any($1::uuid[])",
          [provisioned.map(({ tenantId }) => tenantId)],
        );
        if (residual?.count !== "0") throw new Error("Scoped pilot fixture cleanup left provisioned tenant rows behind.");
      }
    } finally {
      try {
        await admin().from("platform_operators").delete().eq("user_id", fixture.adminA.id);
        await cleanupFixture(fixture);
      } finally {
        await closeAdminPool();
      }
    }
  }
}

await main();
