import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertFile,
  adminInsertFileLink,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionAttachment,
  adminInsertRow,
  adminInsertSection,
  adminSelectQuoteVersionAttachments,
  adminUpdateQuoteVersionStatus,
  cleanupFixture,
  createTwoTenantFixture,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";
import type { CommandClock } from "@/server/commands/clock";
import { runCommand } from "@/server/commands/envelope";
import { createNewQuoteVersion } from "@/server/commands/quotes";

const fixedClock: CommandClock = { now: () => new Date("2026-08-31T12:00:00.000Z") };

let stackUp = false;
let fixture: TwoTenantFixture;
let clientA: TestServerClient;

type AttachmentState =
  | "eligiblePrimary"
  | "eligibleSecondary"
  | "archived"
  | "unlinked"
  | "ineligible";
type PredecessorFixture = {
  quoteId: string;
  calculationId: string;
  predecessorId: string;
  files: Record<AttachmentState, string>;
};

async function seedPredecessorWithAttachmentStates(): Promise<PredecessorFixture> {
  const tenantId = fixture.tenantA.id;
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `carry-forward-${crypto.randomUUID().slice(0, 8)}`,
  });
  const calculationId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: "carry-forward source calculation",
  });
  const sectionId = await adminInsertSection({ tenant_id: tenantId, calculation_id: calculationId });
  await adminInsertRow({
    tenant_id: tenantId,
    section_id: sectionId,
    row_type: "labor",
    quantity: 1,
    unit: "h",
    unit_cost_ore: 10000,
    unit_sell_ore: 20000,
    vat_rate_bp: 2500,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const predecessorId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calculationId,
    version_number: 1,
    quote_number: 9001,
    status: "draft",
  });

  const eligiblePrimary = await adminInsertFile({
    tenant_id: tenantId,
    display_name: "eligible-primary-original.pdf",
    lifecycle_state: "linked",
  });
  const eligibleSecondary = await adminInsertFile({
    tenant_id: tenantId,
    display_name: "eligible-secondary-original.pdf",
    lifecycle_state: "linked",
  });
  const archived = await adminInsertFile({
    tenant_id: tenantId,
    display_name: "archived-original.pdf",
    lifecycle_state: "linked",
  });
  const unlinked = await adminInsertFile({
    tenant_id: tenantId,
    display_name: "unlinked-original.pdf",
    lifecycle_state: "linked",
  });
  const ineligible = await adminInsertFile({
    tenant_id: tenantId,
    display_name: "deleted-original.pdf",
    lifecycle_state: "deleted",
  });
  const files = { eligiblePrimary, eligibleSecondary, archived, unlinked, ineligible };

  const predecessorSnapshots: ReadonlyArray<readonly [AttachmentState, string, number]> = [
    ["eligiblePrimary", eligiblePrimary, 10],
    ["eligibleSecondary", eligibleSecondary, 20],
    ["archived", archived, 30],
    ["unlinked", unlinked, 40],
    ["ineligible", ineligible, 50],
  ];
  for (const [state, fileId, sortOrder] of predecessorSnapshots) {
    await adminInsertQuoteVersionAttachment({
      tenant_id: tenantId,
      quote_version_id: predecessorId,
      file_id: fileId,
      display_name: `${state}-predecessor-snapshot.pdf`,
      sort_order: sortOrder,
    });
  }

  for (const fileId of Object.values(files)) {
    await adminInsertFileLink({
      tenant_id: tenantId,
      file_id: fileId,
      owner_type: "calculation",
      owner_id: calculationId,
      purpose: "calculation_attachment",
    });
  }
  await adminQuery(
    `update public.files
        set lifecycle_state = 'archived', archived_at = statement_timestamp()
      where id = $1`,
    [archived],
  );
  await adminQuery(
    `update public.file_links set archived_at = statement_timestamp()
      where owner_type = 'calculation' and owner_id = $1 and file_id = $2
        and purpose = 'calculation_attachment'`,
    [calculationId, unlinked],
  );

  // The successor command is the production path under test. This only arranges its historical
  // sent predecessor, which must already be immutable before a successor can be created.
  await adminUpdateQuoteVersionStatus(predecessorId, "sent");
  return { quoteId, calculationId, predecessorId, files };
}

async function createSuccessor(predecessorId: string, attachmentFileIds?: readonly string[]) {
  return runCommand(createNewQuoteVersion, {
    client: clientA as never,
    input: {
      quote_version_id: predecessorId,
      ...(attachmentFileIds === undefined ? {} : { attachment_file_ids: attachmentFileIds }),
    },
    clock: fixedClock,
    correlationId: crypto.randomUUID(),
  });
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  fixture = await createTwoTenantFixture();
  clientA = await makeAuthedServerClient(fixture.adminA);
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
  await closeAdminPool();
});

describe("Story 10.9 successor attachment carry-forward", () => {
  it("[P0] omitting attachment_file_ids carries the eligible intersection as frozen display-name/sort-order snapshots without changing the predecessor", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedPredecessorWithAttachmentStates();
    const predecessorBefore = await adminSelectQuoteVersionAttachments(seed.predecessorId);

    const result = await createSuccessor(seed.predecessorId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const successorBeforeRename = await adminSelectQuoteVersionAttachments(result.data.targetId);
    expect(
      successorBeforeRename.map(({ file_id, display_name, sort_order }) => ({
        file_id,
        display_name,
        sort_order,
      })),
    ).toEqual([
      {
        file_id: seed.files.eligiblePrimary,
        display_name: "eligible-primary-original.pdf",
        sort_order: 0,
      },
      {
        file_id: seed.files.eligibleSecondary,
        display_name: "eligible-secondary-original.pdf",
        sort_order: 1,
      },
    ]);

    // A later source-file rename must not rewrite either the successor's display-name snapshot or
    // its selection order. The predecessor's historical rows are also byte-stable across successor
    // creation; only the parent version lifecycle may advance to superseded.
    await adminQuery(
      `update public.files
          set display_name = case id
            when $1 then 'eligible-primary-renamed.pdf'
            when $2 then 'eligible-secondary-renamed.pdf'
          end
        where id in ($1, $2)`,
      [seed.files.eligiblePrimary, seed.files.eligibleSecondary],
    );
    expect(await adminSelectQuoteVersionAttachments(seed.predecessorId)).toEqual(predecessorBefore);
    expect(await adminSelectQuoteVersionAttachments(result.data.targetId)).toEqual(successorBeforeRename);
  });

  it("[P0] an explicit eligible subset reselects only that file and records its new frozen order", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedPredecessorWithAttachmentStates();
    const result = await createSuccessor(seed.predecessorId, [seed.files.eligibleSecondary]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      (await adminSelectQuoteVersionAttachments(result.data.targetId)).map(
        ({ file_id, display_name, sort_order }) => ({ file_id, display_name, sort_order }),
      ),
    ).toEqual([
      {
        file_id: seed.files.eligibleSecondary,
        display_name: "eligible-secondary-original.pdf",
        sort_order: 0,
      },
    ]);
  });

  it("[P0] explicit [] is an intentional copy-none choice", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const seed = await seedPredecessorWithAttachmentStates();
    const result = await createSuccessor(seed.predecessorId, []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await adminSelectQuoteVersionAttachments(result.data.targetId)).toEqual([]);
  });

  it("[P0] an explicit foreign or nonexistent file id fails closed instead of being silently omitted", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const foreign = await adminInsertFile({ tenant_id: fixture.tenantB.id, lifecycle_state: "linked" });
    for (const fileId of [foreign, crypto.randomUUID()]) {
      const seed = await seedPredecessorWithAttachmentStates();
      const result = await createSuccessor(seed.predecessorId, [fileId]);
      expect(result.ok, fileId).toBe(false);
      if (!result.ok) expect(result.code, fileId).toBe("TENANT_ACCESS_DENIED");
      const versions = await adminQuery<{ count: string }>(
        `select count(*)::text as count from public.quote_versions where quote_id = $1`,
        [seed.quoteId],
      );
      expect(versions[0]?.count, fileId).toBe("1");
    }
  });
});
