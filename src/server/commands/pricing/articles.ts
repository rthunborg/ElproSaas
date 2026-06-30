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
import { CommandError } from "../command-errors";
import { asCrmWriteClient, throwMappedWriteError } from "../crm/crm-db";
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
  auditable: true,
  eventType: "article.upserted",
  targetType: "article",
  validateInput: validateUpsertArticle,
  ownership: (input) =>
    input.id ? { table: "articles", id: input.id } : null,
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { input } = ctx;

    if (!input.id) {
      // CREATE — INSERT a new MINIMAL MANUAL row scoped to the resolved tenant. NO
      // supplier column is written (none exists; the validated shape carries none).
      const { data, error } = await db
        .from("articles")
        .insert({
          tenant_id: ctx.tenantContext.tenantId, // resolved tenant — NEVER client-supplied
          name: input.name,
          sku: input.sku ?? null,
          unit: input.unit ?? null,
          unit_price_ore: input.unit_price_ore, // integer öre — never a float
        })
        .select("id")
        .single();
      if (error) throwMappedWriteError(error);
      const id = data?.id;
      if (typeof id !== "string") {
        throw new Error("upsertArticle: no id returned");
      }
      return { targetId: id };
    }

    // UPDATE — edit the article by id (ownership already verified).
    const { data, error } = await db
      .from("articles")
      .update({
        name: input.name,
        sku: input.sku ?? null,
        unit: input.unit ?? null,
        unit_price_ore: input.unit_price_ore,
      })
      .eq("id", input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: input.id };
  },
  auditFields: (_ctx, result) => ({ targetId: result.targetId }),
});

export const archiveArticle = defineCommand<ArchiveInput, PricingCommandResult>({
  command: "article.archive",
  auditable: true,
  eventType: "article.archived",
  targetType: "article",
  validateInput: validateArchive,
  ownership: (input) => ({ table: "articles", id: input.id }),
  execute: async (ctx) => {
    const db = asCrmWriteClient(ctx.db);
    const { data, error } = await db
      .from("articles")
      .update({ is_active: false })
      .eq("id", ctx.input.id)
      .select("id");
    if (error) throwMappedWriteError(error);
    if (!data || data.length === 0) {
      throw new CommandError("TENANT_ACCESS_DENIED");
    }
    return { targetId: ctx.input.id };
  },
  auditFields: (ctx) => ({ targetId: ctx.input.id }),
});
