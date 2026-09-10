/**
 * Article pricing commands (Story 3.4, Task 2.3; architecture §5 command table —
 * "upsertArticle: Optional minimal articles … No supplier behavior" / "archiveArticle").
 *
 * `upsertArticle` / `archiveArticle` — the SAME collection create/update/archive shape
 * as the work-role commands, scoped to `articles`, through the EXISTING envelope.
 * Reuses the CRM write surface + error mapping. NO bespoke mechanism.
 *
 * HARD NON-NEGOTIABLE — NO SUPPLIER SCOPE: NO supplier field is ever read, written, or
 * accepted. The validator's output type (`UpsertArticleInput`) carries ONLY the minimal
 * manual columns (name, optional sku/unit, unit_price_ore) — any client-supplied
 * supplier-ish key is stripped at validation and never reaches this write payload. The
 * `articles` table has no supplier column to hold one (the schema column-name guard
 * proves it).
 *
 * - The resolved tenant (`ctx.tenantContext.tenantId`) is the ONLY authority for the
 *   row's `tenant_id`.
 * - Audit metadata carries NO price value / name — only `{ targetId }`.
 * - NO calculation is performed on the unit price (Epic 4 owns it) — it is STORED as a
 *   reusable integer-öre price only.
 */
import { defineCommand } from "../envelope";
import { asPricingAuditRpcClient, throwMappedWriteError } from "./pricing-db";
import {
  validateArchive,
  validateUpsertArticle,
  type ArchiveInput,
  type UpsertArticleInput,
} from "./validation";
import type { PricingCommandResult } from "./work-roles";

export const upsertArticle = defineCommand<
  UpsertArticleInput,
  PricingCommandResult
>({
  command: "article.upsert",
  auditable: false,
  eventType: "article.upserted",
  targetType: "article",
  validateInput: validateUpsertArticle,
  ownership: (input) =>
    input.id ? { table: "articles", id: input.id } : null,
  execute: async (ctx) => {
    const db = asPricingAuditRpcClient(ctx.db);
    const { input } = ctx;

    const { data, error } = await db.rpc("upsert_article_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_article_id: input.id ?? null,
      p_name: input.name,
      p_sku: input.sku ?? null,
      p_unit: input.unit ?? null,
      p_unit_price_ore: input.unit_price_ore,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("upsertArticle: no id returned");
    }
    return { targetId: data };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const archiveArticle = defineCommand<ArchiveInput, PricingCommandResult>({
  command: "article.archive",
  auditable: false,
  eventType: "article.archived",
  targetType: "article",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "articles", id: input.id }),
  execute: async (ctx) => {
    const db = asPricingAuditRpcClient(ctx.db);
    const { data, error } = await db.rpc("set_article_active_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_article_id: ctx.input.id,
      p_is_active: false,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("archiveArticle: no id returned");
    }
    return { targetId: data };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});

/**
 * REACTIVATE — the inverse of archive: flip `is_active` back to `true` so an archived
 * article returns to the active list (Story 3.4 AC3, mirroring the work-role reactivate
 * path). Same shape as `archiveArticle` (id-only input, ownership pre-check, ONE audit row
 * with allow-listed `{ targetId }`), so archive stays a REVERSIBLE door — never a hard delete.
 */
export const reactivateArticle = defineCommand<
  ArchiveInput,
  PricingCommandResult
>({
  command: "article.reactivate",
  auditable: false,
  eventType: "article.reactivated",
  targetType: "article",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "articles", id: input.id }),
  execute: async (ctx) => {
    const db = asPricingAuditRpcClient(ctx.db);
    const { data, error } = await db.rpc("set_article_active_with_audit", {
      p_tenant_id: ctx.tenantContext.tenantId,
      p_actor_user_id: ctx.tenantContext.userId,
      p_correlation_id: ctx.correlationId,
      p_article_id: ctx.input.id,
      p_is_active: true,
    });
    if (error) throwMappedWriteError(error);
    if (typeof data !== "string") {
      throw new Error("reactivateArticle: no id returned");
    }
    return { targetId: data };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});
