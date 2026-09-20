import { resolvePlatformOperator, OPERATOR_ACCESS_DENIED } from "@/server/auth/resolve-platform-operator";
import { createSupabaseServerClient } from "@/server/db/supabase-server-client";
import { projectConsoleRow, type OperatorConsoleRow } from "@/features/operator-console/projection";

export type { OperatorConsoleRow } from "@/features/operator-console/projection";

export type OperatorConsoleResult =
  | { readonly ok: true; readonly data: readonly OperatorConsoleRow[] }
  | { readonly ok: false; readonly code: typeof OPERATOR_ACCESS_DENIED; readonly data: null };

const denied = (): OperatorConsoleResult => ({ ok: false, code: OPERATOR_ACCESS_DENIED, data: null });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Server-only list/detail entry. Authorization is independent of the route layout. */
export async function readOperatorConsole(identifier?: string): Promise<OperatorConsoleResult> {
  if (!(await resolvePlatformOperator()).ok) return denied();
  try {
    const client = await createSupabaseServerClient();
    const byIdentity = typeof identifier === "string" && !uuid.test(identifier);
    const { data, error } = byIdentity
      ? await client.rpc("operator_console_projection_by_identity", { p_identity: identifier })
      : await client.rpc("operator_console_projection", { p_tenant_id: identifier ?? null });
    if (error || !Array.isArray(data)) return denied();
    const rows = data.map((value) => projectConsoleRow(value as Record<string, unknown>));
    return rows.every((row): row is OperatorConsoleRow => row !== null) ? { ok: true, data: rows } : denied();
  } catch {
    return denied();
  }
}

/** Separate safe detail fact; the list DTO remains exactly five fields. */
export async function readOperatorConsoleResumeState(identifier: string): Promise<{ readonly tenantId: string; readonly attempt: number } | null> {
  if (!(await resolvePlatformOperator()).ok || (!uuid.test(identifier) && !/^SE:[0-9]{10}$/.test(identifier))) return null;
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("operator_console_resume_target", { p_identity: identifier });
    const row = Array.isArray(data) ? data[0] : null;
    return !error && row && typeof row.tenant_id === "string" && uuid.test(row.tenant_id) && typeof row.first_admin_attempt === "number" && Number.isInteger(row.first_admin_attempt)
      ? { tenantId: row.tenant_id, attempt: row.first_admin_attempt }
      : null;
  } catch { return null; }
}

export const operatorConsoleTestHooks = { projectConsoleRow };
