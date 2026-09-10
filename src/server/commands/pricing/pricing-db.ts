/**
 * Story 11.2 pricing write adapter.
 *
 * Pricing is editable by Projektledare, while the generic audit RPC deliberately
 * remains Admin-only. These command-specific RPCs therefore bind the permitted
 * role set, target, event and audit insert inside one SECURITY DEFINER transaction.
 */
import type { CommandDbClient } from "../envelope";
import { throwMappedWriteError } from "../crm/crm-db";

type RpcResult = {
  readonly data: unknown;
  readonly error: { readonly code?: string; readonly message?: string } | null;
};

export type PricingAuditRpcClient = {
  rpc(
    fn: "upsert_work_role_with_audit",
    args: {
      readonly p_tenant_id: string;
      readonly p_actor_user_id: string;
      readonly p_correlation_id: string;
      readonly p_work_role_id: string | null;
      readonly p_display_name: string;
      readonly p_cost_rate_ore: number;
      readonly p_sell_rate_ore: number;
    },
  ): Promise<RpcResult>;
  rpc(
    fn: "set_work_role_active_with_audit",
    args: {
      readonly p_tenant_id: string;
      readonly p_actor_user_id: string;
      readonly p_correlation_id: string;
      readonly p_work_role_id: string;
      readonly p_is_active: boolean;
    },
  ): Promise<RpcResult>;
  rpc(
    fn: "upsert_article_with_audit",
    args: {
      readonly p_tenant_id: string;
      readonly p_actor_user_id: string;
      readonly p_correlation_id: string;
      readonly p_article_id: string | null;
      readonly p_name: string;
      readonly p_sku: string | null;
      readonly p_unit: string | null;
      readonly p_unit_price_ore: number;
    },
  ): Promise<RpcResult>;
  rpc(
    fn: "set_article_active_with_audit",
    args: {
      readonly p_tenant_id: string;
      readonly p_actor_user_id: string;
      readonly p_correlation_id: string;
      readonly p_article_id: string;
      readonly p_is_active: boolean;
    },
  ): Promise<RpcResult>;
};

export function asPricingAuditRpcClient(
  db: CommandDbClient,
): PricingAuditRpcClient {
  return db as unknown as PricingAuditRpcClient;
}

export { throwMappedWriteError };
