/**
 * Story 8.1 — ATDD RED-PHASE scaffold: file-storage migration-reset proof
 * (AC1/AC4/AC8, P0 — 8.1-INT-01).
 *
 * Asserts that after `supabase db reset` (empty → migrate → seed) the new
 * `file_storage_foundation` migration created `files`/`file_links` with the exact
 * schema contract:
 *   - a DIRECT `tenant_id` NOT NULL FK → public.tenants ON DELETE CASCADE per table;
 *   - `files` carries `constraint files_id_tenant_unique unique (id, tenant_id)`
 *     (the composite-FK target) AND a `unique (bucket_id, object_path)` (one object
 *     ↔ one metadata row);
 *   - `file_links.file_id` uses a COMPOSITE same-tenant FK → files(id, tenant_id)
 *     ON DELETE CASCADE — a bare `references files(id)` is the R-802 cross-tenant
 *     hole this test forbids;
 *   - `files.lifecycle_state` CHECK over the closed union
 *     (draft/linked/locked/archived/deleted);
 *   - `file_links.owner_type` CHECK over the Phase A closed owner-type union
 *     (customer/facility/contact/calculation/quote_version/quote_acceptance/job) —
 *     NO deferred-module owner type;
 *   - `file_links.purpose` CHECK over the closed purpose union;
 *   - `files.size_bytes` CHECK (null or >= 0);
 *   - `set_updated_at` BEFORE UPDATE trigger on both tables (REUSED helper);
 *   - RLS ENABLE + FORCE; own-tenant SELECT/INSERT/UPDATE policies (NO DELETE policy —
 *     archive over hard delete);
 *   - explicit role GRANTs (authenticated SELECT/INSERT/UPDATE; service_role full DML;
 *     anon NONE);
 *   - NO broad deferred file-index / document-center table (AC1 guardrail).
 *
 * ── GREEN as of Story 8.1 dev ───────────────────────────────────────────────────
 * The `file_storage_foundation` migration has landed (Task 2), so `.skip` is removed
 * and these assertions run for real against the reset schema.
 *
 * ── RELATIONSHIP TO THE EXISTING `migration-reset.int.test.ts` ───────────────────
 * This is the file-specific companion. The EXISTING `migration-reset.int.test.ts`
 * asserts the COMPLETE `public` policy set as an EXACT enumeration; the `files`/
 * `file_links` SELECT/INSERT/UPDATE policies WILL FAIL-LOUD there the moment the
 * migration lands (dev Task 8.2 — the same signal Stories 3.1/5.1 hit). The dev phase
 * EXTENDS that file (add the two tables × SELECT/INSERT/UPDATE to the expected EXACT
 * set + the tables to the exists/RLS-forced checks + the `storage.objects` policies),
 * keeping the enumeration EXACT — never loosened to a superset. This scaffold pins the
 * `public`-schema half of that contract independently. The `storage.objects` RLS is
 * covered by `storage-object-isolation.rls.test.ts`.
 *
 * Runs against the LOCAL Supabase stack only; skips visibly when unreachable.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { adminQuery, closeAdminPool } from "../../factories/admin-sql";
import { isLocalStackReachable } from "../../support/test-env";
import { skipUnlessStack } from "../../support/stack-gate";

const FILE_TABLES = ["files", "file_links"] as const;

// AC1 guardrail as an ALLOWLIST (airtight, matching the policy-enumeration style): the
// ONLY file/document/attachment/index/registry-shaped public base tables this story may
// introduce are `files`/`file_links` — see the allowlist test below. A deferred-module
// table under ANY other name (document_center, file_index, documents, file_registry,
// attachments_index, …) is caught by the broad name regex there; a fixed three-literal
// denylist would miss it.

let stackUp = false;
beforeAll(async () => {
  stackUp = await isLocalStackReachable();
});
afterAll(async () => {
  await closeAdminPool();
});

describe("File migration reset — files/file_links (AC1/AC4/AC8)", () => {
  it("[P0] the two file tables exist after reset", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...FILE_TABLES]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...FILE_TABLES].sort());
  });

  it("[P0/AC1] the ONLY file/document/index-shaped public tables are files/file_links (allowlist)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // ALLOWLIST form: enumerate EVERY public base table whose name is file/document/
    // attachment/index/registry-shaped and assert the set is EXACTLY {files, file_links}.
    // A deferred-module table under ANY other name (file_registry, attachments_index,
    // document_center, …) fails this — the previous three-literal denylist would not.
    //
    // EPIC-6 EXCLUSION (Story 6.1): `quote_version_attachments` is an attachment-NAMED
    // table but it is the SANCTIONED Epic-6 quote-attachment snapshot table (architecture
    // §7/§11 — it REFERENCES the 8.1 files model, it is NOT a competing file/document-index
    // model). It is enrolled + RLS-covered by its own quote-tables-migration-reset suite, so
    // exclude it here so this 8.1 allowlist keeps catching a DEFERRED-module file-index
    // table without false-flagging the legitimate Epic-6 owner.
    const rows = await adminQuery<{ table_name: string }>(
      `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE'
           and (
             table_name ~* '(file|document|attachment|registry)'
             or table_name ~* 'index'
           )
           and table_name <> 'quote_version_attachments'`,
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...FILE_TABLES].sort());
  });

  it("[P0] each file table carries a NOT NULL tenant_id FK to public.tenants ON DELETE CASCADE", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of FILE_TABLES) {
      const nn = await adminQuery<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = 'tenant_id'`,
        [table],
      );
      expect(nn[0]?.is_nullable).toBe("NO");

      const fk = await adminQuery<{ confdeltype: string }>(
        `select con.confdeltype
           from pg_constraint con
           join pg_class c on c.oid = con.conrelid
           join pg_namespace n on n.oid = c.relnamespace
           join pg_class fc on fc.oid = con.confrelid
          where con.contype = 'f' and n.nspname = 'public'
            and c.relname = $1 and fc.relname = 'tenants'`,
        [table],
      );
      // a tenant_id → tenants(id) FK with ON DELETE CASCADE ('c') must exist.
      expect(fk.some((r) => r.confdeltype === "c")).toBe(true);
    }
  });

  it("[P0] files has its own unique (id, tenant_id) — the composite-FK target", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.files'::regclass and contype = 'u'`,
    );
    expect(rows.some((r) => /\(id,\s*tenant_id\)/i.test(r.def))).toBe(true);
  });

  it("[P0] files enforces unique (bucket_id, object_path) — one object ↔ one metadata row", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.files'::regclass and contype = 'u'`,
    );
    expect(
      rows.some((r) => /\(bucket_id,\s*object_path\)/i.test(r.def)),
    ).toBe(true);
  });

  it("[P0/R-802] file_links.file_id uses a COMPOSITE same-tenant FK → files(id, tenant_id)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // A bare `references files(id)` would let a link point at another tenant's file.
    const fk = await adminQuery<{ fdef: string }>(
      `select pg_get_constraintdef(con.oid) as fdef
         from pg_constraint con join pg_class c on c.oid = con.conrelid
        where con.contype = 'f' and c.relname = 'file_links'`,
    );
    expect(
      fk.some(
        (r) =>
          /\(file_id,\s*tenant_id\)/i.test(r.fdef) &&
          /files\s*\(id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(true);
    // and it cascades on delete of the parent file.
    expect(
      fk.some(
        (r) =>
          /\(file_id,\s*tenant_id\)/i.test(r.fdef) &&
          /on delete cascade/i.test(r.fdef),
      ),
    ).toBe(true);
    // GUARDRAIL: there must be NO single-column FK on file_id alone.
    expect(
      fk.some(
        (r) =>
          /foreign key\s*\(file_id\)/i.test(r.fdef) &&
          !/\(file_id,\s*tenant_id\)/i.test(r.fdef),
      ),
    ).toBe(false);
  });

  it("[P0] files.lifecycle_state CHECK over the closed 5-value union", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.files'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    expect(defs).toMatch(
      /lifecycle_state[\s\S]*'draft'[\s\S]*'linked'[\s\S]*'locked'[\s\S]*'archived'[\s\S]*'deleted'/i,
    );
  });

  it("[P0] file_links.owner_type CHECK is the Phase A closed owner-type union (NO deferred-module type)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.file_links'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    // All seven Phase A owner types are present in the CHECK...
    for (const t of [
      "customer",
      "facility",
      "contact",
      "calculation",
      "quote_version",
      "quote_acceptance",
      "job",
    ]) {
      expect(defs).toMatch(new RegExp(`'${t}'`));
    }
    // ...and no deferred-module owner type leaked in.
    expect(defs).not.toMatch(/'(supplier|asset|rental|hr|tender|fku)'/i);
  });

  it("[P0] file_links.purpose CHECK over the closed purpose union", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.file_links'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    for (const p of [
      "calculation_attachment",
      "quote_attachment_snapshot",
      "quote_pdf",
      "acceptance_evidence",
      "job_evidence",
      "crm_document",
    ]) {
      expect(defs).toMatch(new RegExp(`'${p}'`));
    }
  });

  it("[P0] files.size_bytes CHECK (null or >= 0)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
         where conrelid = 'public.files'::regclass and contype = 'c'`,
    );
    const defs = rows.map((r) => r.def).join("\n");
    // size_bytes is bigint and the CHECK admits null or a non-negative value.
    expect(defs).toMatch(/size_bytes[\s\S]*>=\s*\(?0\)?/i);
    const t = await adminQuery<{ data_type: string }>(
      `select data_type from information_schema.columns
         where table_schema = 'public' and table_name = 'files'
           and column_name = 'size_bytes'`,
    );
    expect(t[0]?.data_type).toBe("bigint");
  });

  it("[P0] each file table has timestamp columns + a set_updated_at trigger", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    for (const table of FILE_TABLES) {
      const cols = await adminQuery<{ column_name: string }>(
        `select column_name from information_schema.columns
           where table_schema = 'public' and table_name = $1
             and column_name = any($2::text[])`,
        [table, ["created_at", "updated_at"]],
      );
      const names = cols.map((c) => c.column_name);
      expect(names).toContain("created_at");
      expect(names).toContain("updated_at");
      const trig = await adminQuery<{ tgname: string }>(
        `select t.tgname from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = $1 and not t.tgisinternal`,
        [table],
      );
      expect(trig.length).toBeGreaterThan(0);
    }
  });

  it("[P0] RLS is ENABLED and FORCED on both file tables", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select c.relname, c.relrowsecurity, c.relforcerowsecurity
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and c.relname = any($1::text[])`,
      [[...FILE_TABLES]],
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it("[P0] each file table has own-tenant SELECT/INSERT/UPDATE policies — NO DELETE policy (archive only)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ tablename: string; cmd: string; qual: string | null }>(
      `select tablename, cmd, qual::text as qual from pg_policies
         where schemaname = 'public' and tablename = any($1::text[])`,
      [[...FILE_TABLES]],
    );
    for (const table of FILE_TABLES) {
      const forTable = rows.filter((r) => r.tablename === table);
      const cmds = forTable.map((r) => r.cmd).sort();
      expect(cmds).toContain("SELECT");
      expect(cmds).toContain("INSERT");
      expect(cmds).toContain("UPDATE");
      expect(cmds).not.toContain("DELETE"); // archive over hard delete
      expect(forTable.some((r) => (r.qual ?? "").includes("is_tenant_admin"))).toBe(true);
    }
  });

  it("[P0] GRANTs: authenticated SELECT/INSERT/UPDATE (no DELETE); anon NOTHING", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ grantee: string; privilege_type: string }>(
      `select grantee, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and table_name = any($1::text[])`,
      [[...FILE_TABLES]],
    );
    const authed = rows
      .filter((r) => r.grantee === "authenticated")
      .map((r) => r.privilege_type);
    expect(authed).toContain("SELECT");
    expect(authed).toContain("INSERT");
    expect(authed).toContain("UPDATE");
    expect(authed).not.toContain("DELETE"); // DELETE not granted — archive via archived_at
    // anon holds NONE of the four DATA-access privileges (Supabase's default schema
    // privileges still hand anon the non-DML REFERENCES/TRIGGER/TRUNCATE — assert on
    // DML only, mirroring calc-tables-migration-reset.int.test.ts).
    const DML = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const anonDml = rows
      .filter((r) => r.grantee === "anon")
      .map((r) => r.privilege_type)
      .filter((p) => DML.includes(p));
    expect(anonDml).toEqual([]);
  });

  it("[P0/AC4] the tenant-files bucket exists and is PRIVATE (public = false)", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    // Belt-and-braces: the migration seeds the bucket private on a fresh reset
    // regardless of config-load order (Task 1.2).
    const rows = await adminQuery<{ id: string; public: boolean }>(
      `select id, public from storage.buckets where id = 'tenant-files'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.public).toBe(false);
  });

  it("[P0/AC4] NO public storage bucket exists", async (testCtx) => {
    if (skipUnlessStack(testCtx, stackUp)) return;
    const rows = await adminQuery<{ id: string }>(
      `select id from storage.buckets where public = true`,
    );
    expect(rows).toEqual([]);
  });
});
