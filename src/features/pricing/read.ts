/**
 * Server-side pricing reads for the UI (Story 3.4, Task 4.1) — the RLS-scoped read path
 * the `/settings/pricing` page calls. SERVER-ONLY (no `"use server"` action surface):
 * plain async functions invoked from the server component. Mirrors
 * `src/features/settings/read.ts`.
 *
 * EVERY read runs on the per-request, cookie-bound RLS client (anon key — NEVER a
 * service-role key). RLS scopes every row to the caller's tenant with NO tenant id
 * passed (architecture §6); a cross-tenant id simply returns zero rows. NO direct write,
 * NO service-role client — reads only here; all writes go through the 3.4 envelope
 * commands (`src/features/pricing/actions.ts`).
 *
 * A tenant with NO pricing rows yet reads as an EMPTY list — the page renders the empty
 * editors (the first save INSERTs a row via the upsert command).
 *
 * Money is read as INTEGER ÖRE and converted to a kronor display string at the boundary
 * (the stored value is never a float). Only ACTIVE rows are listed (archived rows are
 * hidden from the editor; the row still exists in the DB — soft archive).
 */
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";

const GENERIC_READ_ERROR =
  "Ett tillfälligt fel inträffade. Försök igen om en stund.";

/** A work_roles row as the UI needs it (money in INTEGER ÖRE). */
export interface WorkRoleRow {
  readonly id: string;
  readonly display_name: string;
  readonly cost_rate_ore: number;
  readonly sell_rate_ore: number;
  readonly is_active: boolean;
}

const WORK_ROLE_COLUMNS =
  "id, display_name, cost_rate_ore, sell_rate_ore, is_active";

export interface WorkRolesReadResult {
  readonly workRoles: readonly WorkRoleRow[];
  readonly error: string | null;
}

/**
 * Read the tenant's ACTIVE work roles (MANY rows per tenant; RLS-scoped, ordered by
 * name). Returns an empty list when the tenant has none yet. A query error returns the
 * generic FAILED message (never a leaked stack/SQL).
 */
export async function readWorkRoles(): Promise<WorkRolesReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("work_roles")
      .select(WORK_ROLE_COLUMNS)
      .eq("is_active", true)
      .order("display_name", { ascending: true });
    if (error) return { workRoles: [], error: GENERIC_READ_ERROR };
    const workRoles = (data ?? []) as WorkRoleRow[];
    return { workRoles, error: null };
  } catch {
    return { workRoles: [], error: GENERIC_READ_ERROR };
  }
}

/** An articles row as the UI needs it (money in INTEGER ÖRE). */
export interface ArticleRow {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly unit: string | null;
  readonly unit_price_ore: number;
  readonly is_active: boolean;
}

const ARTICLE_COLUMNS = "id, name, sku, unit, unit_price_ore, is_active";

export interface ArticlesReadResult {
  readonly articles: readonly ArticleRow[];
  readonly error: string | null;
}

/**
 * Read the tenant's ACTIVE articles (MANY rows per tenant; RLS-scoped, ordered by name).
 * Returns an empty list when the tenant has none yet. A query error returns the generic
 * FAILED message.
 */
export async function readArticles(): Promise<ArticlesReadResult> {
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client
      .from("articles")
      .select(ARTICLE_COLUMNS)
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) return { articles: [], error: GENERIC_READ_ERROR };
    const articles = (data ?? []) as ArticleRow[];
    return { articles, error: null };
  } catch {
    return { articles: [], error: GENERIC_READ_ERROR };
  }
}
