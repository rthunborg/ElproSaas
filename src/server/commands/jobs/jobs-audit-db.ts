import type { CommandDbClient } from "../envelope";
import { CommandError } from "../command-errors";

export type JobAuditedRpcName = "create_job_with_audit" | "update_job_with_audit";

export async function executeJobAuditedMutation(db: CommandDbClient, fn: JobAuditedRpcName, args: Record<string, unknown>): Promise<string> {
  const { data, error } = await (db as unknown as { rpc(name: JobAuditedRpcName, values: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }> }).rpc(fn, args);
  if (error) {
    if (["42501", "23503"].includes(error.code ?? "")) throw new CommandError("TENANT_ACCESS_DENIED");
    if (["23514", "22P02"].includes(error.code ?? "")) throw new CommandError("VALIDATION_FAILED");
    throw new Error(`job audited mutation failed: ${error.code ?? "?"}`);
  }
  if (typeof data !== "string") throw new Error("job audited mutation returned no id");
  return data;
}
