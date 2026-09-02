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

const EMPTY_SEARCH_PATH = "search_path=\"\"";

describe("Story 10.8 quote review authorization migration", () => {
  it("[P0] table is FORCE-RLS, SELECT-only for authenticated, immutable and has no API DELETE path", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const relation = await adminQuery<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `select relrowsecurity, relforcerowsecurity from pg_class
       where oid = 'public.quote_review_authorizations'::regclass`,
    );
    expect(relation).toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);

    const policies = await adminQuery<{ cmd: string; roles: string[] }>(
      `select cmd, roles::text[] as roles from pg_policies
       where schemaname = 'public' and tablename = 'quote_review_authorizations'`,
    );
    expect(policies).toEqual([{ cmd: "SELECT", roles: ["authenticated"] }]);

    const grants = await adminQuery<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'quote_review_authorizations'
         and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
       order by grantee, privilege_type`,
    );
    expect(grants.filter((g) => g.grantee === "authenticated")).toEqual([
      { grantee: "authenticated", privilege_type: "SELECT" },
    ]);
    expect(grants.some((g) => g.grantee === "anon")).toBe(false);
    // The table owner (`postgres`) necessarily retains owner capabilities. The
    // externally reachable API roles must have no DELETE grant; SECURITY DEFINER
    // functions consume authorizations through the owner path instead.
    expect(
      grants.some(
        (g) =>
          ["anon", "authenticated", "service_role"].includes(g.grantee) &&
          g.privilege_type === "DELETE",
      ),
    ).toBe(false);

    const triggers = await adminQuery<{ tgname: string }>(
      `select tgname from pg_trigger
       where tgrelid = 'public.quote_review_authorizations'::regclass and not tgisinternal`,
    );
    expect(triggers.map((t) => t.tgname)).toContain("quote_review_authorizations_immutable");
  });

  it("[P0] every sanctioned RPC is SECURITY DEFINER, empty-search-path and authenticated-only", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const expected = new Map<string, string>([
      ["authorize_quote_initial_review", "uuid, uuid, timestamp with time zone, uuid, uuid, uuid, jsonb, jsonb, jsonb, date, text, jsonb, uuid, uuid"],
      ["authorize_quote_successor_review", "uuid, uuid, uuid, uuid, timestamp with time zone, uuid, uuid, uuid, jsonb, jsonb, jsonb, boolean, uuid, uuid"],
      ["authorize_quote_final_send", "uuid, uuid, uuid, uuid"],
      ["create_quote_version_from_calculation", "uuid, uuid, timestamp with time zone, uuid, uuid"],
      ["create_new_quote_version", "uuid, uuid, timestamp with time zone, uuid, uuid"],
      ["mark_quote_version_sent", "uuid, uuid, uuid, timestamp with time zone, text, text, uuid, uuid, text, text, text, text"],
      ["mark_quote_version_lifecycle", "uuid, uuid, text, timestamp with time zone, uuid, uuid"],
      ["mark_quote_version_lost", "uuid, uuid, text, text, text, timestamp with time zone, uuid, uuid"],
      ["accept_quote_and_create_job", "uuid, uuid, timestamp with time zone, bigint, bigint, text, text, uuid, text, text, date, date, text, text, uuid, uuid"],
      ["update_draft_quote_version", "uuid, uuid, jsonb, timestamp with time zone, uuid, uuid"],
    ]);
    const rows = await adminQuery<{
      oid: string;
      proname: string;
      args: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select p.oid::text, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
              p.prosecdef, p.proconfig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1::text[])`,
      [[...expected.keys()]],
    );
    expect(rows).toHaveLength(expected.size);
    for (const row of rows) {
      expect(row.prosecdef, row.proname).toBe(true);
      expect(row.proconfig, row.proname).toContain(EMPTY_SEARCH_PATH);
      if ([
        "authorize_quote_initial_review",
        "authorize_quote_successor_review",
        "create_new_quote_version",
      ].includes(row.proname)) {
        expect(row.proconfig).toContain("TimeZone=UTC");
      }
      const expectedTypes = expected.get(row.proname);
      expect(row.args.replace(/p_[a-z0-9_]+ /g, ""), row.proname).toBe(expectedTypes);
      const privilege = await adminQuery<{ authed: boolean; anon: boolean; public_role: boolean }>(
        `select has_function_privilege('authenticated', $1::oid, 'execute') as authed,
                has_function_privilege('anon', $1::oid, 'execute') as anon,
                has_function_privilege('public', $1::oid, 'execute') as public_role`,
        [row.oid],
      );
      expect(privilege[0]).toEqual({ authed: true, anon: false, public_role: false });
    }
  });

  it("[P0] obsolete digest/full-payload overloads are absent and private internals are not executable", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const obsolete = await adminQuery<{
      old_initial: string | null;
      old_successor: string | null;
      old_sent: string | null;
      old_attributable_sent: string | null;
      old_lifecycle: string | null;
      old_lost: string | null;
      old_accept: string | null;
    }>(
      `select
         to_regprocedure('public.create_quote_version_from_calculation(uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,text,date,text,jsonb)')::text as old_initial,
         to_regprocedure('public.create_new_quote_version(uuid,uuid,uuid,uuid,timestamptz,uuid,uuid,uuid,jsonb,jsonb,jsonb,boolean)')::text as old_successor,
         to_regprocedure('public.mark_quote_version_sent(uuid,uuid,timestamptz,text,text)')::text as old_sent,
         to_regprocedure('public.mark_quote_version_sent(uuid,uuid,uuid,timestamptz,text,text,uuid,uuid)')::text as old_attributable_sent,
         to_regprocedure('public.mark_quote_version_lifecycle(uuid,uuid,text,timestamptz)')::text as old_lifecycle,
         to_regprocedure('public.mark_quote_version_lost(uuid,uuid,text,text,text,timestamptz)')::text as old_lost,
         to_regprocedure('public.accept_quote_and_create_job(uuid,uuid,timestamptz,bigint,bigint,text,text,uuid,text,text,date,date,text,text)')::text as old_accept`,
    );
    expect(obsolete).toEqual([{
      old_initial: null,
      old_successor: null,
      old_sent: null,
      old_attributable_sent: null,
      old_lifecycle: null,
      old_lost: null,
      old_accept: null,
    }]);

    const privatePrivileges = await adminQuery<{ proname: string; role_name: string }>(
      `select p.proname, r.role_name
       from pg_proc p
       cross join (values ('public'), ('anon'), ('authenticated'), ('service_role')) r(role_name)
       where p.pronamespace = 'public'::regnamespace
         and p.proname like 'story_10_8_%_internal'
         and has_function_privilege(r.role_name, p.oid, 'execute')`,
    );
    expect(privatePrivileges).toEqual([]);
  });

  it("[P0] authenticated direct quote lifecycle and acceptance DML is fully revoked", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const tables = [
      "tenant_counters",
      "quotes",
      "quote_versions",
      "quote_version_lines",
      "quote_version_attachments",
      "quote_events",
      "quote_lost_reasons",
      "quote_acceptances",
    ];
    const rows = await adminQuery<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type from information_schema.role_table_grants
       where table_schema = 'public' and grantee = 'authenticated'
         and table_name = any($1::text[])
         and privilege_type in ('INSERT','UPDATE','DELETE')`,
      [tables],
    );
    expect(rows).toEqual([]);
  });
});
