import { err, ok, type Result } from "@/lib/result/result";
import { COMMAND_MESSAGES, type CommandErrorCode } from "@/server/commands/command-errors";
import { resolveCapability } from "./permission-matrix";

/** Generic, existence-safe capability gate for server command declarations. */
export function requireCapability(input: {
  readonly roles?: readonly unknown[];
  readonly module?: unknown;
  readonly capability?: unknown;
}): Result<undefined, Extract<CommandErrorCode, "PERMISSION_DENIED">> {
  if (resolveCapability(input).granted) return ok(undefined);
  return err("PERMISSION_DENIED", COMMAND_MESSAGES.PERMISSION_DENIED);
}
