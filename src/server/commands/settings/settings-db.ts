/**
 * Checked atomic write adapters for settings commands.
 *
 * Company identity and quote-term lifecycle writes are audited mutations. The
 * command-specific RPCs bind the resolved tenant, actor, write and fixed audit
 * event in one transaction, so a successful settings write can never commit
 * before its audit row (and direct authenticated DML cannot bypass that rule).
 */
import type { CommandDbClient } from "../envelope";

type RpcResult = {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
};

export type SettingsAuditRpcClient = {
  rpc(fn: "upsert_company_settings_with_audit", args: {
    readonly p_tenant_id: string; readonly p_actor_user_id: string; readonly p_correlation_id: string;
    readonly p_company_name: string; readonly p_org_nr: string | null; readonly p_address_line1: string | null;
    readonly p_address_line2: string | null; readonly p_postal_code: string | null; readonly p_city: string | null;
    readonly p_email: string | null; readonly p_phone: string | null; readonly p_logo_url: string | null;
    readonly p_logo_url_present: boolean; readonly p_default_vat_display: string; readonly p_vat_rate_bp: number;
  }): Promise<RpcResult>;
  rpc(fn: "upsert_quote_terms_with_audit", args: {
    readonly p_tenant_id: string; readonly p_actor_user_id: string; readonly p_correlation_id: string;
    readonly p_terms_text: string;
  }): Promise<RpcResult>;
  rpc(fn: "approve_quote_terms_with_audit", args: {
    readonly p_tenant_id: string; readonly p_actor_user_id: string; readonly p_correlation_id: string;
    readonly p_quote_terms_id: string; readonly p_approved_at: string;
  }): Promise<RpcResult>;
};

/**
 * Narrow the envelope's `CommandDbClient` to the settings write surface. The real
 * Supabase client (and the test anon-key client) structurally satisfy this; the cast
 * is the single, documented place the write methods are surfaced.
 */
export function asSettingsAuditRpcClient(db: CommandDbClient): SettingsAuditRpcClient {
  return db as unknown as SettingsAuditRpcClient;
}

// Settings shares the established command error mapping.
export { throwMappedWriteError } from "../crm/crm-db";
