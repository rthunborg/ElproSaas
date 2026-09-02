import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

let stackUp = false;

beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});

afterAll(async () => {
  await closeAdminPool();
});

const EMPTY_SEARCH_PATH = 'search_path=""';

describe("Story 10.9 quote PDF validity migration reset", () => {
  it("[P0] reconstructs the Node golden-vector attestation bytes with pgcrypto HMAC", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ payload: string; signature: string }>(
      `select encode(public.quote_pdf_attestation_payload(
          '00000000-0000-4000-8000-000000000001'::uuid,
          '00000000-0000-4000-8000-000000000002'::uuid,
          '00000000-0000-4000-8000-000000000003'::uuid,
          '00000000-0000-4000-8000-000000000004'::uuid,
          repeat('a', 64), 'tenant-files',
          '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000004/offert-1.pdf',
          repeat('b', 64), 42, 'application/pdf',
          '00000000-0000-4000-8000-000000000005'::uuid, 'test_v1',
          '2026-08-31T12:34:56.789Z'::timestamptz,
          '2026-08-31T12:39:56.789Z'::timestamptz,
          '2026-08-31T12:34:56.789Z'::timestamptz
        ), 'hex') as payload,
        encode(extensions.hmac(public.quote_pdf_attestation_payload(
          '00000000-0000-4000-8000-000000000001'::uuid,
          '00000000-0000-4000-8000-000000000002'::uuid,
          '00000000-0000-4000-8000-000000000003'::uuid,
          '00000000-0000-4000-8000-000000000004'::uuid,
          repeat('a', 64), 'tenant-files',
          '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000004/offert-1.pdf',
          repeat('b', 64), 42, 'application/pdf',
          '00000000-0000-4000-8000-000000000005'::uuid, 'test_v1',
          '2026-08-31T12:34:56.789Z'::timestamptz,
          '2026-08-31T12:39:56.789Z'::timestamptz,
          '2026-08-31T12:34:56.789Z'::timestamptz
        ), convert_to('local-test-only-quote-pdf-attestation-secret-v1', 'UTF8'), 'sha256'), 'hex') as signature`,
    );
    expect(rows).toEqual([{
      payload: "33303a656c70726f2e71756f74652d7064662e6174746573746174696f6e2e763133363a30303030303030302d303030302d343030302d383030302d30303030303030303030303133363a30303030303030302d303030302d343030302d383030302d30303030303030303030303233363a30303030303030302d303030302d343030302d383030302d30303030303030303030303333363a30303030303030302d303030302d343030302d383030302d30303030303030303030303436343a6161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616131323a74656e616e742d66696c657338363a30303030303030302d303030302d343030302d383030302d3030303030303030303030312f30303030303030302d303030302d343030302d383030302d3030303030303030303030342f6f66666572742d312e70646636343a62626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262626262323a343231353a6170706c69636174696f6e2f70646633363a30303030303030302d303030302d343030302d383030302d303030303030303030303035373a746573745f763132343a323032362d30382d33315431323a33343a35362e3738395a32343a323032362d30382d33315431323a33393a35362e3738395a32343a323032362d30382d33315431323a33343a35362e3738395a",
      signature: "a6114318c48686198dc45f65bdfb5f8803bfd6140204585e6aaa524d36e1bdc0",
    }]);
  });

  it("[P0] replaces the broad lifecycle RPCs with attributable signatures and correct grants", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const expected = new Map<string, { args: string; result?: string; definer: boolean; authenticated: boolean }>([
      ["quote_version_content_fingerprint", { args: "uuid", definer: false, authenticated: false }],
      ["assert_quote_pdf_current_for_send", { args: "uuid", definer: false, authenticated: false }],
      ["assert_quote_pdf_storage_object", { args: "uuid, uuid", definer: true, authenticated: false }],
      ["start_quote_pdf_render", { args: "uuid, uuid, uuid, uuid, timestamp with time zone, text", definer: true, authenticated: true }],
      ["reserve_quote_pdf_file", { args: "uuid, uuid, uuid, text, text, bigint, text, uuid", result: "uuid", definer: true, authenticated: true }],
      ["complete_quote_pdf_render", { args: "uuid, uuid, uuid, timestamp with time zone, uuid, uuid, text, text, text, text", definer: true, authenticated: true }],
      ["fail_quote_pdf_render", { args: "uuid, uuid, uuid, timestamp with time zone, uuid, uuid", definer: true, authenticated: true }],
    ]);
    const rows = await adminQuery<{
      oid: string;
      proname: string;
      args: string;
      result: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select p.oid::text, p.proname, pg_get_function_identity_arguments(p.oid) as args,
              pg_get_function_result(p.oid) as result,
              p.prosecdef, p.proconfig
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = any($1::text[])`,
      [[...expected.keys()]],
    );
    expect(rows).toHaveLength(expected.size);
    for (const row of rows) {
      const contract = expected.get(row.proname);
      expect(contract, row.proname).toBeDefined();
      expect(row.args.replace(/p_[a-z0-9_]+ /g, ""), row.proname).toBe(contract?.args);
      if (contract?.result) expect(row.result, row.proname).toBe(contract.result);
      expect(row.prosecdef, row.proname).toBe(contract?.definer);
      expect(row.proconfig, row.proname).toContain(EMPTY_SEARCH_PATH);
      if (row.proname === "quote_version_content_fingerprint") {
        expect(row.proconfig).toContain("TimeZone=UTC");
      }
      const privileges = await adminQuery<{ authenticated: boolean; anon: boolean; public_role: boolean; service: boolean }>(
        `select has_function_privilege('authenticated', $1::oid, 'execute') as authenticated,
                has_function_privilege('anon', $1::oid, 'execute') as anon,
                has_function_privilege('public', $1::oid, 'execute') as public_role,
                has_function_privilege('service_role', $1::oid, 'execute') as service`,
        [row.oid],
      );
      expect(privileges[0]).toEqual({
        authenticated: contract?.authenticated ?? false,
        anon: false,
        public_role: false,
        service: false,
      });
    }

    const obsolete = await adminQuery<{ old_start: string | null; old_complete: string | null; old_fail: string | null }>(
      `select
         to_regprocedure('public.start_quote_pdf_render(uuid,uuid)')::text as old_start,
         to_regprocedure('public.complete_quote_pdf_render(uuid,uuid,uuid,timestamptz)')::text as old_complete,
         to_regprocedure('public.fail_quote_pdf_render(uuid,uuid,timestamptz)')::text as old_fail`,
    );
    expect(obsolete).toEqual([{ old_start: null, old_complete: null, old_fail: null }]);
  });

  it("[P0] reset constrains artifact_kind and keeps quote_pdf reservation out of direct file inserts", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const artifact = await adminQuery<{ nullable: boolean; type: string; check_definition: string }>(
      `select not a.attnotnull as nullable,
              pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
              pg_get_constraintdef(c.oid) as check_definition
         from pg_attribute a
         join pg_class r on r.oid = a.attrelid
         join pg_namespace n on n.oid = r.relnamespace
         join pg_constraint c on c.conrelid = r.oid and c.contype = 'c'
        where n.nspname = 'public' and r.relname = 'files' and a.attname = 'artifact_kind'
          and pg_get_constraintdef(c.oid) like '%artifact_kind%'`,
    );
    expect(artifact).toHaveLength(1);
    expect(artifact[0]).toMatchObject({ nullable: true, type: "text" });
    expect(artifact[0]?.check_definition).toContain("quote_pdf");

    const insertPolicy = await adminQuery<{ with_check: string }>(
      `select with_check from pg_policies
        where schemaname = 'public' and tablename = 'files' and policyname = 'files_insert_own'`,
    );
    expect(insertPolicy).toHaveLength(1);
    expect(insertPolicy[0]?.with_check).toContain("artifact_kind");
    expect(insertPolicy[0]?.with_check).toMatch(/artifact_kind\s+IS\s+NULL/i);
  });

  it("[P0] reset recreates deterministic parent trigger ordering and complete child invalidation coverage", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const triggers = await adminQuery<{ table_name: string; trigger_name: string }>(
      `select c.relname as table_name, t.tgname as trigger_name
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
        where c.oid in ('public.quote_versions'::regclass,
                        'public.quote_version_lines'::regclass,
                        'public.quote_version_attachments'::regclass)
          and not t.tgisinternal
        order by c.relname, t.tgname`,
    );
    const versionNames = triggers
      .filter((trigger) => trigger.table_name === "quote_versions")
      .map((trigger) => trigger.trigger_name);
    expect(versionNames).toContain("a10_quote_versions_invalidate_pdf");
    expect(versionNames).toContain("z10_quote_versions_bind_pdf_render");
    expect(versionNames).not.toContain("quote_versions_invalidate_stale_pdf");
    expect(versionNames).not.toContain("quote_versions_bind_pdf_render_fingerprint");
    expect(versionNames.indexOf("a10_quote_versions_invalidate_pdf"))
      .toBeLessThan(versionNames.indexOf("z10_quote_versions_bind_pdf_render"));

    for (const tableName of ["quote_version_lines", "quote_version_attachments"]) {
      expect(
        triggers.some((trigger) =>
          trigger.table_name === tableName && trigger.trigger_name.endsWith("_invalidate_stale_pdf"),
        ),
        tableName,
      ).toBe(true);
    }
  });

  it("[P0] Storage object updates are fail-closed once matching file metadata exists", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const policies = await adminQuery<{ qual: string; with_check: string }>(
      `select qual, with_check
         from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname = 'tenant_files_objects_update_own'`,
    );
    expect(policies).toHaveLength(1);
    for (const expression of [policies[0]?.qual, policies[0]?.with_check]) {
      // pg_get_expr may omit the schema for relations on the active search path.
      expect(expression).toMatch(/NOT\s*\(\s*EXISTS\s*\(/i);
      expect(expression).toMatch(/FROM\s+(?:public\.)?files\s+f\b/i);
      expect(expression).toMatch(/f\.bucket_id\s*=\s*(?:storage\.)?objects\.bucket_id\b/i);
      expect(expression).toMatch(/f\.object_path\s*=\s*(?:storage\.)?objects\.name\b/i);
    }
  });

  it("[P0] reset installs the quote-PDF Storage immutability trigger with its PFD10 guard", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const trigger = await adminQuery<{
      trigger_name: string;
      trigger_definition: string;
      function_definition: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select t.tgname as trigger_name,
              pg_get_triggerdef(t.oid) as trigger_definition,
              pg_get_functiondef(p.oid) as function_definition,
              p.prosecdef,
              p.proconfig
         from pg_trigger t
         join pg_proc p on p.oid = t.tgfoid
        where t.tgrelid = 'storage.objects'::regclass
          and t.tgname = 'quote_pdf_storage_object_immutability'
          and not t.tgisinternal`,
    );
    expect(trigger).toHaveLength(1);
    expect(trigger[0]).toMatchObject({
      trigger_name: "quote_pdf_storage_object_immutability",
      prosecdef: false,
    });
    expect(trigger[0]?.proconfig).toContain(EMPTY_SEARCH_PATH);
    expect(trigger[0]?.trigger_definition).toMatch(/BEFORE INSERT OR UPDATE ON storage\.objects/i);
    expect(trigger[0]?.function_definition).toContain("PFD10");
    expect(trigger[0]?.function_definition).toContain("quote PDF Storage bytes are immutable");
  });

  it("[P0] PDF lifecycle RPC definitions permit rendering only while the quote version is draft", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ proname: string; definition: string }>(
      `select p.proname, pg_get_functiondef(p.oid) as definition
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = any($1::text[])
        order by p.proname`,
      [["start_quote_pdf_render", "reserve_quote_pdf_file", "complete_quote_pdf_render"]],
    );
    expect(rows).toHaveLength(3);
    const definitions = new Map(rows.map((row) => [row.proname, row.definition]));
    expect(definitions.get("start_quote_pdf_render")).toMatch(/status = 'draft'/i);
    expect(definitions.get("reserve_quote_pdf_file")).toMatch(/v_status <> 'draft'/i);
    expect(definitions.get("complete_quote_pdf_render")).toMatch(/qv\.status = 'draft'/i);
    for (const definition of definitions.values()) expect(definition).not.toMatch(/'sent'/i);
  });

  it("[P0] reset freezes reserved, active, and historical quote-PDF file identity", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;

    const rows = await adminQuery<{
      definition: string;
      prosecdef: boolean;
      proconfig: string[] | null;
      trigger_count: string;
    }>(
      `select pg_get_functiondef(p.oid) as definition,
              p.prosecdef,
              p.proconfig,
              (select count(*)::text
                 from pg_trigger t
                where t.tgrelid = 'public.files'::regclass
                  and t.tgname = 'files_lock'
                  and t.tgfoid = p.oid
                  and not t.tgisinternal) as trigger_count
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = 'enforce_file_lock'
          and pg_get_function_identity_arguments(p.oid) = ''`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.prosecdef).toBe(false);
    expect(rows[0]?.proconfig).toContain(EMPTY_SEARCH_PATH);
    expect(rows[0]?.trigger_count).toBe("1");
    expect(rows[0]?.definition).toContain("pdf_render_file_id");
    expect(rows[0]?.definition).toContain("pdf_file_id");
    expect(rows[0]?.definition).toContain("quote_pdf");
    expect(rows[0]?.definition).toContain("artifact_kind");
    expect(rows[0]?.definition).toContain("FL823");
  });
});
