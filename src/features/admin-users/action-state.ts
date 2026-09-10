export type AdminUsersActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const ADMIN_USERS_INITIAL: AdminUsersActionState = {
  status: "idle",
  message: "",
};
