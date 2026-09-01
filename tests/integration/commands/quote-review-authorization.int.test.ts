import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminInsertCalculation,
  adminInsertCustomer,
  adminInsertFile,
  adminInsertQuote,
  adminInsertQuoteVersion,
  adminInsertQuoteVersionAttachment,
  cleanupFixture,
  createTwoTenantFixture,
  makeAnonServerClient,
  makeAuthedServerClient,
  type TestServerClient,
  type TwoTenantFixture,
} from "../../factories/tenants";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import {
  establishCurrentQuotePdf,
  LOCAL_TEST_QUOTE_PDF_KEY_ID,
  quotePdfSendAttestation,
  type QuotePdfSendAttestationRpcArgs,
} from "../../support/quote-pdf";
import { isLocalStackReachable, isLocalStorageReachable } from "../../support/test-env";
import { skipUnlessStack, skipUnlessStorage } from "../../support/stack-gate";

let stackUp = false;
let storageUp = false;
let fixture: TwoTenantFixture;
let clientA: TestServerClient;
let clientB: TestServerClient;
let anon: TestServerClient;
let quoteA: { quoteId: string; versionId: string };
let quoteB: { quoteId: string; versionId: string };

type ReviewAuthorizationMutationSnapshot = {
  actor_user_id: string;
  source_revision: string;
  correlation_id: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_target_id: string | null;
};

async function readReviewAuthorizationMutationSnapshot(
  authorizationId: string,
): Promise<ReviewAuthorizationMutationSnapshot> {
  const rows = await adminQuery<ReviewAuthorizationMutationSnapshot>(
    `select actor_user_id, source_revision::text as source_revision, correlation_id,
            expires_at::text as expires_at, consumed_at::text as consumed_at,
            consumed_target_id
       from public.quote_review_authorizations
      where id = $1`,
    [authorizationId],
  );
  const row = rows[0];
  if (!row) throw new Error("review authorization mutation snapshot returned no row");
  return row;
}

async function expectPrivilegedAuthorizationMutationRejected(input: {
  authorizationId: string;
  sql: string;
  params?: readonly unknown[];
}): Promise<void> {
  const before = await readReviewAuthorizationMutationSnapshot(input.authorizationId);
  await expect(adminQuery(input.sql, input.params)).rejects.toMatchObject({ code: "QV401" });
  await expect(readReviewAuthorizationMutationSnapshot(input.authorizationId)).resolves.toEqual(before);
}

async function seedDraft(
  tenantId: string,
  label: string,
): Promise<{ quoteId: string; versionId: string }> {
  const customerId = await adminInsertCustomer({
    tenant_id: tenantId,
    customer_type: "company",
    display_name: `${label}-customer`,
  });
  const calculationId = await adminInsertCalculation({
    tenant_id: tenantId,
    customer_id: customerId,
    title: `${label}-calculation`,
  });
  const quoteId = await adminInsertQuote({ tenant_id: tenantId, customer_id: customerId });
  const versionId = await adminInsertQuoteVersion({
    tenant_id: tenantId,
    quote_id: quoteId,
    calculation_id: calculationId,
    company_name: `${label}-company`,
  });
  return { quoteId, versionId };
}

async function seedFinalSendAuthorization(input: {
  tenantId: string;
  actorUserId: string;
  quoteId: string;
  versionId: string;
  state: "valid" | "expired" | "consumed";
}): Promise<{ id: string; correlationId: string }> {
  const correlationId = crypto.randomUUID();
  const timeExpression = input.state === "expired"
    ? "statement_timestamp() - interval '16 minutes'"
    : "statement_timestamp()";
  const consumedExpression = input.state === "consumed" ? "statement_timestamp()" : "null";
  const consumedTargetExpression = input.state === "consumed" ? "$4::uuid" : "null";
  const rows = await adminQuery<{ id: string }>(
    `insert into public.quote_review_authorizations (
       tenant_id, actor_user_id, purpose, quote_id, target_quote_version_id,
       source_revision, correlation_id, issued_at, expires_at,
       consumed_at, consumed_target_id
     ) values (
       $1, $2, 'final_send', $3, $4,
       public.story_10_8_quote_version_source_revision($1, $4), $5,
       ${timeExpression}, ${timeExpression} + interval '15 minutes',
       ${consumedExpression}, ${consumedTargetExpression}
     ) returning id`,
    [input.tenantId, input.actorUserId, input.quoteId, input.versionId, correlationId],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("review authorization seed returned no id");
  return { id, correlationId };
}

async function consumeFinalSend(
  client: TestServerClient,
  input: {
    tenantId: string;
    actorUserId: string;
    versionId: string;
    authorizationId: string;
    correlationId: string;
    sentAt?: string;
    attestation?: QuotePdfSendAttestationRpcArgs;
  },
) {
  return client.rpc("mark_quote_version_sent", {
    p_tenant_id: input.tenantId,
    p_quote_version_id: input.versionId,
    p_authorization_id: input.authorizationId,
    p_sent_at: input.sentAt ?? "2026-08-31T12:00:00.000Z",
    p_channel: null,
    p_reference: null,
    p_actor_user_id: input.actorUserId,
    p_correlation_id: input.correlationId,
    ...(input.attestation ?? {
      p_attestation_key_id: LOCAL_TEST_QUOTE_PDF_KEY_ID,
      p_attestation_issued_at: "1970-01-01T00:00:00.000Z",
      p_attestation_expires_at: "1970-01-01T00:05:00.000Z",
      p_attestation_signature: "0".repeat(64),
    }),
  });
}

/** Create the exact authenticated, current PDF state required by final-send gating. */
async function establishCurrentPdf(input: {
  tenantId: string;
  actorUserId: string;
  versionId: string;
  client: TestServerClient;
}): Promise<void> {
  await establishCurrentQuotePdf({
    client: input.client, tenantId: input.tenantId, quoteVersionId: input.versionId,
    actorUserId: input.actorUserId, occurredAt: "2026-08-31T11:00:00.000Z",
  });
}

async function assertNoPartial(
  versionId: string,
  authorizationId: string,
  correlationId: string,
) {
  const version = await adminQuery<{ status: string }>(
    `select status from public.quote_versions where id = $1`,
    [versionId],
  );
  const authority = await adminQuery<{ consumed_at: string | null }>(
    `select consumed_at::text from public.quote_review_authorizations where id = $1`,
    [authorizationId],
  );
  const audit = await adminQuery<{ count: string }>(
    `select count(*)::text as count from public.audit_events where correlation_id = $1`,
    [correlationId],
  );
  expect(version[0]?.status).toBe("draft");
  expect(authority[0]?.consumed_at).toBeNull();
  expect(Number(audit[0]?.count)).toBe(0);
}

async function readAuditTimestamp(correlationId: string): Promise<Date> {
  const rows = await adminQuery<{ created_at: string | Date }>(
    `select created_at from public.audit_events where correlation_id = $1`,
    [correlationId],
  );
  expect(rows).toHaveLength(1);
  const value = rows[0]?.created_at;
  const timestamp = new Date(value instanceof Date ? value.toISOString() : value);
  expect(Number.isNaN(timestamp.getTime())).toBe(false);
  return timestamp;
}

async function readDatabaseNow(): Promise<Date> {
  const rows = await adminQuery<{ database_now: string | Date }>(
    `select statement_timestamp() as database_now`,
  );
  const value = rows[0]?.database_now;
  const timestamp = new Date(value instanceof Date ? value.toISOString() : String(value));
  expect(Number.isNaN(timestamp.getTime())).toBe(false);
  return timestamp;
}

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
  if (!stackUp) return;
  storageUp = await isLocalStorageReachable();
  fixture = await createTwoTenantFixture();
  [clientA, clientB, anon] = await Promise.all([
    makeAuthedServerClient(fixture.adminA),
    makeAuthedServerClient(fixture.adminB),
    makeAnonServerClient(),
  ]);
  quoteA = await seedDraft(fixture.tenantA.id, "authority-a");
  quoteB = await seedDraft(fixture.tenantB.id, "authority-b");
});

afterAll(async () => {
  if (fixture) await cleanupFixture(fixture);
  await closeAdminPool();
});

describe("Story 10.8 one-time quote review authorization", () => {
  it("[P0] issues, consumes, and then rejects replay of a valid final-send authority with exactly one send audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    if (skipUnlessStorage(testCtx, storageUp)) return;
    const target = await seedDraft(fixture.tenantA.id, `final-send-${crypto.randomUUID()}`);
    await establishCurrentPdf({
      tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id,
      versionId: target.versionId, client: clientA,
    });
    const correlationId = crypto.randomUUID();
    const issued = await clientA.rpc("authorize_quote_final_send", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: target.versionId,
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: correlationId,
    });
    expect(issued.error).toBeNull();
    const authorizationId = issued.data as string;
    expect(typeof authorizationId).toBe("string");
    if (typeof authorizationId !== "string") return;
    const attestation = await quotePdfSendAttestation({
      client: clientA,
      tenantId: fixture.tenantA.id,
      quoteVersionId: target.versionId,
      actorUserId: fixture.adminA.id,
      correlationId,
    });

    const sent = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id,
      versionId: target.versionId, authorizationId, correlationId,
      sentAt: "1900-01-01T00:00:00.000Z",
      attestation,
    });
    expect(sent.error).toBeNull();
    const sentEvent = await adminQuery<{ occurred_at: string | Date }>(
      `select occurred_at from public.quote_events
        where quote_version_id = $1 and event_type = 'sent'
        order by occurred_at desc limit 1`,
      [target.versionId],
    );
    const sentOccurredAt = sentEvent[0]?.occurred_at;
    const sentAt = new Date(
      sentOccurredAt instanceof Date ? sentOccurredAt.toISOString() : String(sentOccurredAt),
    );
    expect(Math.abs((await readDatabaseNow()).getTime() - sentAt.getTime())).toBeLessThan(30_000);
    const sentVersion = await adminQuery<{ status: string; updated_at: string | Date }>(
      `select status, updated_at from public.quote_versions where id = $1`,
      [target.versionId],
    );
    expect(sentVersion[0]?.status).toBe("sent");
    const sentUpdatedAt = sentVersion[0]?.updated_at;
    const sentVersionUpdatedAt = new Date(
      sentUpdatedAt instanceof Date ? sentUpdatedAt.toISOString() : String(sentUpdatedAt),
    );
    expect(
      Math.abs((await readDatabaseNow()).getTime() - sentVersionUpdatedAt.getTime()),
    ).toBeLessThan(30_000);
    expect(
      Math.abs((await readDatabaseNow()).getTime() - (await readAuditTimestamp(correlationId)).getTime()),
    ).toBeLessThan(30_000);
    const audits = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.audit_events where correlation_id = $1`,
      [correlationId],
    );
    expect(Number(audits[0]?.count)).toBe(1);

    const replay = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id,
      versionId: target.versionId, authorizationId, correlationId,
    });
    expect(replay.error?.code).toBe("QV401");
    const auditsAfterReplay = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.audit_events where correlation_id = $1`,
      [correlationId],
    );
    expect(Number(auditsAfterReplay[0]?.count)).toBe(1);
  });

  it("[P0] rejects expiry without consuming, mutating, or auditing", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "expired",
    });
    const result = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteA.versionId,
      authorizationId: auth.id,
      correlationId: auth.correlationId,
    });
    expect(result.error?.code).toBe("QV401");
    await assertNoPartial(quoteA.versionId, auth.id, auth.correlationId);
  });

  it("[P0] distinguishes a valid authority blocked by the missing-current-PDF gate from a provenance failure", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const target = await seedDraft(fixture.tenantA.id, `pdf-gate-${crypto.randomUUID()}`);
    const correlationId = crypto.randomUUID();
    const issued = await clientA.rpc("authorize_quote_final_send", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: target.versionId,
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: correlationId,
    });
    expect(issued.error).toBeNull();
    const authorizationId = issued.data as string;
    if (typeof authorizationId !== "string") return;
    const result = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id, actorUserId: fixture.adminA.id,
      versionId: target.versionId, authorizationId, correlationId,
    });
    expect(result.error?.code).toBe("PFD10");
    await assertNoPartial(target.versionId, authorizationId, correlationId);
  });

  it("[P0] rejects replay before any lifecycle write or duplicate audit", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "consumed",
    });
    const result = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteA.versionId,
      authorizationId: auth.id,
      correlationId: auth.correlationId,
    });
    expect(result.error?.code).toBe("QV401");
    const status = await adminQuery<{ status: string }>(
      `select status from public.quote_versions where id = $1`,
      [quoteA.versionId],
    );
    const audit = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.audit_events where correlation_id = $1`,
      [auth.correlationId],
    );
    expect(status[0]?.status).toBe("draft");
    expect(Number(audit[0]?.count)).toBe(0);
  });

  it("[P0] any customer-visible source change invalidates the authority", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });
    await adminQuery(
      `update public.quote_versions set intro_text = 'changed-after-review' where id = $1`,
      [quoteA.versionId],
    );
    const result = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteA.versionId,
      authorizationId: auth.id,
      correlationId: auth.correlationId,
    });
    expect(result.error?.code).toBe("QV401");
    await assertNoPartial(quoteA.versionId, auth.id, auth.correlationId);
  });

  it("[P0] attachment lifecycle changes invalidate the authority", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const fileId = await adminInsertFile({
      tenant_id: fixture.tenantA.id,
      display_name: "reviewed-attachment.pdf",
      lifecycle_state: "linked",
    });
    await adminInsertQuoteVersionAttachment({
      tenant_id: fixture.tenantA.id,
      quote_version_id: quoteA.versionId,
      file_id: fileId,
      display_name: "reviewed-attachment.pdf",
    });
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });

    await adminQuery(
      `update public.files
          set lifecycle_state = 'archived', archived_at = statement_timestamp()
        where id = $1`,
      [fileId],
    );
    const result = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteA.versionId,
      authorizationId: auth.id,
      correlationId: auth.correlationId,
    });

    expect(result.error?.code).toBe("QV401");
    await assertNoPartial(quoteA.versionId, auth.id, auth.correlationId);
  });

  it("[P0] forged actor and cross-tenant target both fail closed", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const foreignActor = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminB.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });
    const actorResult = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteA.versionId,
      authorizationId: foreignActor.id,
      correlationId: foreignActor.correlationId,
    });
    expect(actorResult.error?.code).toBe("QV401");
    await assertNoPartial(quoteA.versionId, foreignActor.id, foreignActor.correlationId);

    const foreignTenant = await seedFinalSendAuthorization({
      tenantId: fixture.tenantB.id,
      actorUserId: fixture.adminB.id,
      quoteId: quoteB.quoteId,
      versionId: quoteB.versionId,
      state: "valid",
    });
    const tenantResult = await consumeFinalSend(clientA, {
      tenantId: fixture.tenantB.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteB.versionId,
      authorizationId: foreignTenant.id,
      correlationId: foreignTenant.correlationId,
    });
    expect(tenantResult.error?.code).toBe("42501");
  });

  it("[P0] anon cannot issue or consume an authorization", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const issue = await anon.rpc("authorize_quote_final_send", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: quoteA.versionId,
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: crypto.randomUUID(),
    });
    expect(issue.error?.code).toBe("42501");

    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });
    const consume = await consumeFinalSend(anon, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      versionId: quoteA.versionId,
      authorizationId: auth.id,
      correlationId: auth.correlationId,
    });
    expect(consume.error?.code).toBe("42501");
    await assertNoPartial(quoteA.versionId, auth.id, auth.correlationId);
  });

  it("[P0] privileged SQL cannot alter an unconsumed authorization's attested facts or expiry", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });

    await expectPrivilegedAuthorizationMutationRejected({
      authorizationId: auth.id,
      sql: `update public.quote_review_authorizations
               set actor_user_id = $2
             where id = $1`,
      params: [auth.id, fixture.adminB.id],
    });
    await expectPrivilegedAuthorizationMutationRejected({
      authorizationId: auth.id,
      sql: `update public.quote_review_authorizations
               set source_revision = '{"tampered":true}'::jsonb
             where id = $1`,
      params: [auth.id],
    });
    await expectPrivilegedAuthorizationMutationRejected({
      authorizationId: auth.id,
      sql: `update public.quote_review_authorizations
               set correlation_id = $2
             where id = $1`,
      params: [auth.id, crypto.randomUUID()],
    });
    await expectPrivilegedAuthorizationMutationRejected({
      authorizationId: auth.id,
      sql: `update public.quote_review_authorizations
               set expires_at = expires_at + interval '1 minute'
             where id = $1`,
      params: [auth.id],
    });
  });

  it("[P0] privileged SQL cannot mutate a consumed authorization or its consumption pair", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "consumed",
    });

    await expectPrivilegedAuthorizationMutationRejected({
      authorizationId: auth.id,
      sql: `update public.quote_review_authorizations
               set consumed_at = consumed_at + interval '1 minute'
             where id = $1`,
      params: [auth.id],
    });
  });

  it("[P0] authenticated direct authorization mutation is denied by grants separately from the trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });
    const before = await readReviewAuthorizationMutationSnapshot(auth.id);

    const result = await clientA
      .from("quote_review_authorizations")
      .update({ correlation_id: crypto.randomUUID() })
      .eq("id", auth.id);

    expect(result.error?.code).toBe("42501");
    await expect(readReviewAuthorizationMutationSnapshot(auth.id)).resolves.toEqual(before);
  });

  it("[P0] authenticated direct INSERT/UPDATE/DELETE is 42501 on every protected quote table", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const tables = [
      "tenant_counters",
      "quotes",
      "quote_versions",
      "quote_version_lines",
      "quote_version_attachments",
      "quote_events",
      "quote_lost_reasons",
    ] as const;
    for (const table of tables) {
      const insert = await clientA.from(table).insert({ tenant_id: fixture.tenantA.id });
      expect(insert.error?.code, `${table} INSERT`).toBe("42501");
      const update = await clientA
        .from(table)
        .update({ tenant_id: fixture.tenantA.id })
        .eq("tenant_id", fixture.tenantA.id);
      expect(update.error?.code, `${table} UPDATE`).toBe("42501");
      const remove = await clientA
        .from(table)
        .delete()
        .eq("tenant_id", fixture.tenantA.id);
      expect(remove.error?.code, `${table} DELETE`).toBe("42501");
    }
  });

  it("[P0] raw authenticated RPC rejects overlong draft text without a write, and ignores spoofed lifecycle/audit times", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const target = await seedDraft(fixture.tenantA.id, `direct-boundary-${crypto.randomUUID()}`);
    const overlongCorrelationId = crypto.randomUUID();
    const before = await adminQuery<{ intro_text: string | null; customer_notes: string | null }>(
      `select intro_text, customer_notes from public.quote_versions where id = $1`,
      [target.versionId],
    );
    const rejected = await clientA.rpc("update_draft_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: target.versionId,
      p_patch: { intro_text: "x".repeat(5001) },
      p_occurred_at: "1900-01-01T00:00:00.000Z",
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: overlongCorrelationId,
    });
    expect(rejected.error?.code).toBe("23514");
    await expect(
      adminQuery<{ intro_text: string | null; customer_notes: string | null }>(
        `select intro_text, customer_notes from public.quote_versions where id = $1`,
        [target.versionId],
      ),
    ).resolves.toEqual(before);
    const rejectedAudits = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.audit_events where correlation_id = $1`,
      [overlongCorrelationId],
    );
    expect(Number(rejectedAudits[0]?.count)).toBe(0);

    const updateCorrelationId = crypto.randomUUID();
    const updated = await clientA.rpc("update_draft_quote_version", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: target.versionId,
      p_patch: { customer_notes: "y".repeat(5000) },
      p_occurred_at: "1900-01-01T00:00:00.000Z",
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: updateCorrelationId,
    });
    expect(updated.error).toBeNull();
    const updateAuditAt = await readAuditTimestamp(updateCorrelationId);
    expect(Math.abs((await readDatabaseNow()).getTime() - updateAuditAt.getTime())).toBeLessThan(30_000);
    expect(updateAuditAt.toISOString()).not.toBe("1900-01-01T00:00:00.000Z");

    const sent = await seedDraft(fixture.tenantA.id, `lost-spoof-${crypto.randomUUID()}`);
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [sent.versionId]);
    const lostCorrelationId = crypto.randomUUID();
    const lost = await clientA.rpc("mark_quote_version_lost", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: sent.versionId,
      p_outcome: "forlorad",
      p_category: "pris",
      p_note: "timestamp authority proof",
      p_occurred_at: "1900-01-01T00:00:00.000Z",
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: lostCorrelationId,
    });
    expect(lost.error).toBeNull();
    const lostEvent = await adminQuery<{ occurred_at: string | Date }>(
      `select occurred_at from public.quote_events
        where quote_version_id = $1 and event_type = 'lost'
        order by occurred_at desc limit 1`,
      [sent.versionId],
    );
    expect(lostEvent).toHaveLength(1);
    const lostAt = new Date(
      lostEvent[0]?.occurred_at instanceof Date
        ? lostEvent[0].occurred_at.toISOString()
        : String(lostEvent[0]?.occurred_at),
    );
    expect(Math.abs((await readDatabaseNow()).getTime() - lostAt.getTime())).toBeLessThan(30_000);
    const lostVersion = await adminQuery<{ status: string; updated_at: string | Date }>(
      `select status, updated_at from public.quote_versions where id = $1`,
      [sent.versionId],
    );
    expect(lostVersion[0]?.status).toBe("lost");
    const lostUpdatedAt = lostVersion[0]?.updated_at;
    const updatedAt = new Date(
      lostUpdatedAt instanceof Date ? lostUpdatedAt.toISOString() : String(lostUpdatedAt),
    );
    expect(Math.abs((await readDatabaseNow()).getTime() - updatedAt.getTime())).toBeLessThan(30_000);
    expect(
      Math.abs((await readDatabaseNow()).getTime() - (await readAuditTimestamp(lostCorrelationId)).getTime()),
    ).toBeLessThan(30_000);
  });

  it("[P0] direct acceptance preserves a historical accepted_at but rejects future evidence before mutation", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const target = await seedDraft(fixture.tenantA.id, `acceptance-time-${crypto.randomUUID()}`);
    await adminQuery(`update public.quote_versions set status = 'sent' where id = $1`, [target.versionId]);
    const price = await adminQuery<{ payable_ore: string }>(
      `select payable_ore::text from public.quote_versions where id = $1`,
      [target.versionId],
    );
    const payableOre = Number(price[0]?.payable_ore);
    expect(Number.isSafeInteger(payableOre)).toBe(true);
    const correlationId = crypto.randomUUID();
    const result = await clientA.rpc("accept_quote_and_create_job", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: target.versionId,
      p_accepted_at: "2099-01-01T00:00:00.000Z",
      p_accepted_price_ore: payableOre,
      p_source_sent_total_ore: payableOre,
      p_channel: null,
      p_adjustment_reason: null,
      p_evidence_file_id: null,
      p_evidence_reference: null,
      p_notes: null,
      p_planned_start_date: null,
      p_planned_end_date: null,
      p_title: null,
      p_fault_inject: null,
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: correlationId,
    });
    expect(result.error?.code).toBe("23514");
    const state = await adminQuery<{ status: string }>(
      `select status from public.quote_versions where id = $1`,
      [target.versionId],
    );
    expect(state[0]?.status).toBe("sent");
    const audits = await adminQuery<{ count: string }>(
      `select count(*)::text as count from public.audit_events where correlation_id = $1`,
      [correlationId],
    );
    expect(Number(audits[0]?.count)).toBe(0);

    const historicalCorrelationId = crypto.randomUUID();
    const historical = await clientA.rpc("accept_quote_and_create_job", {
      p_tenant_id: fixture.tenantA.id,
      p_quote_version_id: target.versionId,
      p_accepted_at: "2026-08-01T09:15:00.000Z",
      p_accepted_price_ore: payableOre,
      p_source_sent_total_ore: payableOre,
      p_channel: null,
      p_adjustment_reason: null,
      p_evidence_file_id: null,
      p_evidence_reference: null,
      p_notes: null,
      p_planned_start_date: null,
      p_planned_end_date: null,
      p_title: null,
      p_fault_inject: null,
      p_actor_user_id: fixture.adminA.id,
      p_correlation_id: historicalCorrelationId,
    });
    expect(historical.error).toBeNull();
    const acceptance = await adminQuery<{ accepted_at: string | Date }>(
      `select accepted_at from public.quote_acceptances where quote_version_id = $1`,
      [target.versionId],
    );
    const acceptedAt = acceptance[0]?.accepted_at;
    expect(acceptedAt instanceof Date ? acceptedAt.toISOString() : String(acceptedAt))
      .toBe("2026-08-01T09:15:00.000Z");
    expect(
      Math.abs((await readDatabaseNow()).getTime() - (await readAuditTimestamp(historicalCorrelationId)).getTime()),
    ).toBeLessThan(30_000);
  });

  it("[P0] Tenant B cannot consume Tenant A's valid authorization", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const auth = await seedFinalSendAuthorization({
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminA.id,
      quoteId: quoteA.quoteId,
      versionId: quoteA.versionId,
      state: "valid",
    });
    const result = await consumeFinalSend(clientB, {
      tenantId: fixture.tenantA.id,
      actorUserId: fixture.adminB.id,
      versionId: quoteA.versionId,
      authorizationId: auth.id,
      correlationId: auth.correlationId,
    });
    expect(result.error?.code).toBe("42501");
    await assertNoPartial(quoteA.versionId, auth.id, auth.correlationId);
  });
});
