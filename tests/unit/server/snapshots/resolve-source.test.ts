/**
 * Story 3.5 — the snapshot-source RESOLVER error-MAPPING (Task 3), unit-level.
 *
 * The resolver's DB-touching behavior (real RLS zero-rows across a seeded two-tenant
 * fixture) is proven at integration in `tests/integration/snapshots/source-ownership.int.test.ts`.
 * This suite isolates the PURE mapping half with an in-memory FAKE client (no DB), which is
 * fast and exhaustive:
 *   - zero rows (`[]` or `null`)        → err TENANT_ACCESS_DENIED (no snapshot, no leak)
 *   - a returned DB `error`             → err SERVER_ERROR (transient; NOT masked as denial)
 *   - a thrown/rejecting client         → err SERVER_ERROR (transient)
 *   - a present row                     → ok(row) (ready for the matching builder)
 *   - the denial message NEVER echoes the requested source id
 *   - each `kind` selects the RIGHT table + column list
 *
 * Runner: `node --test` with TS strip-types (`pnpm test:unit`) — pure, NO DB. The resolver
 * imports only pure primitives (typed Result + the stable CommandErrorCode/messages), so it
 * is safe to unit-test here.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  resolveSnapshotSource,
  type SnapshotSourceDbClient,
} from "@/server/snapshots/resolve-source";
import { COMMAND_MESSAGES } from "@/server/commands/command-errors";
import type { SnapshotKind } from "@/lib/snapshots/types";

/**
 * A minimal in-memory client that records the `(table, columns, id)` it was driven with
 * and returns a scripted `{ data, error }` (or throws). Satisfies the resolver's
 * structural `.from(...).select(...).eq(...).limit(...)` surface.
 */
function makeFakeClient(script: {
  data?: unknown[] | null;
  error?: unknown;
  throwOnLimit?: boolean;
}): {
  client: SnapshotSourceDbClient;
  calls: { table: string; columns: string; column: string; id: string; limit: number }[];
} {
  const calls: { table: string; columns: string; column: string; id: string; limit: number }[] = [];
  const client: SnapshotSourceDbClient = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                async limit(n: number) {
                  calls.push({ table, columns, column, id: value, limit: n });
                  if (script.throwOnLimit) {
                    throw new Error("simulated SDK reject (transient infra fault)");
                  }
                  return {
                    data: script.data ?? null,
                    error: script.error ?? null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const KIND_TABLE: Record<SnapshotKind, string> = {
  work_role: "work_roles",
  article: "articles",
  company_settings: "company_settings",
  quote_terms: "quote_terms",
};

describe("Story 3.5 — resolveSnapshotSource error mapping (AC3, command layer)", () => {
  test("[P0] zero rows ([]) → TENANT_ACCESS_DENIED (no snapshot, no leaked existence)", async () => {
    const { client } = makeFakeClient({ data: [] });
    const result = await resolveSnapshotSource({ client, kind: "work_role", sourceId: "foreign-id-123" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "TENANT_ACCESS_DENIED");
      // The generic message must never echo the requested id.
      assert.equal(result.message.includes("foreign-id-123"), false);
      assert.equal(result.message, COMMAND_MESSAGES.TENANT_ACCESS_DENIED);
    }
  });

  test("[P0] null data → TENANT_ACCESS_DENIED (same as empty — zero visible rows)", async () => {
    const { client } = makeFakeClient({ data: null });
    const result = await resolveSnapshotSource({ client, kind: "article", sourceId: "x" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "TENANT_ACCESS_DENIED");
  });

  test("[P0] a returned DB error → SERVER_ERROR (transient; NOT masked as a denial)", async () => {
    const { client } = makeFakeClient({ data: null, error: { message: "connection reset", code: "57P01" } });
    const result = await resolveSnapshotSource({ client, kind: "company_settings", sourceId: "x" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "SERVER_ERROR");
      assert.equal(result.message, COMMAND_MESSAGES.SERVER_ERROR);
    }
  });

  test("[P0] a thrown/rejecting client → SERVER_ERROR (transient; no raw stack crosses)", async () => {
    const { client } = makeFakeClient({ throwOnLimit: true });
    const result = await resolveSnapshotSource({ client, kind: "quote_terms", sourceId: "x" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "SERVER_ERROR");
      // No leaked internal detail (no "simulated SDK reject" prose).
      assert.equal(result.message, COMMAND_MESSAGES.SERVER_ERROR);
    }
  });

  test("[P0] a present row → ok(row), ready for the matching builder", async () => {
    const row = {
      id: "wr-own",
      tenant_id: "tenant-A",
      display_name: "Elektriker",
      cost_rate_ore: 30000,
      sell_rate_ore: 60000,
      is_active: true,
      updated_at: "2026-06-29T08:30:00.000Z",
    };
    const { client } = makeFakeClient({ data: [row] });
    const result = await resolveSnapshotSource({ client, kind: "work_role", sourceId: "wr-own" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data, row);
      assert.equal(result.data.tenant_id, "tenant-A");
    }
  });

  test("[P0] an error takes precedence over any returned rows (a fault is never treated as success)", async () => {
    const { client } = makeFakeClient({ data: [{ id: "x" }], error: { message: "timeout" } });
    const result = await resolveSnapshotSource({ client, kind: "work_role", sourceId: "x" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "SERVER_ERROR");
  });

  test("[P0] each kind reads the RIGHT table and queries by id", async () => {
    for (const kind of Object.keys(KIND_TABLE) as SnapshotKind[]) {
      const { client, calls } = makeFakeClient({ data: [] });
      await resolveSnapshotSource({ client, kind, sourceId: "some-id" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].table, KIND_TABLE[kind]);
      assert.equal(calls[0].column, "id"); // scoped by id — never a client-supplied tenant_id
      assert.equal(calls[0].id, "some-id");
      // The resolver reads the columns the matching builder needs (incl. tenant_id + updated_at)
      // as a SELECTED column — never as a WHERE filter (RLS scopes the read, so the only
      // `.eq(...)` is on `id`, asserted above).
      assert.ok(calls[0].columns.includes("tenant_id"), `${kind} must select tenant_id`);
      assert.ok(calls[0].columns.includes("updated_at"), `${kind} must select updated_at`);
    }
  });
});
