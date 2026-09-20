export type OperatorConsoleActionState = { readonly status: "idle" | "success" | "error"; readonly message: string };
export const OPERATOR_CONSOLE_INITIAL: OperatorConsoleActionState = { status: "idle", message: "" };
