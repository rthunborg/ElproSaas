export type AdminUsersActionState = {
  status: "idle" | "success" | "error";
  message: string;
  retryWithNewOperation?: boolean;
};

export const ADMIN_USERS_INITIAL: AdminUsersActionState = {
  status: "idle",
  message: "",
};

/** Keep an uncertain operation id until the server has actually reconciled it. */
export function operationIdForAdminUsersSubmit(state: AdminUsersActionState, current: string, generate: () => string = () => crypto.randomUUID()): string {
  return state.retryWithNewOperation ? generate() : current;
}
