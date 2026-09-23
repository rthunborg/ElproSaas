import { SCOPE_MANIFEST } from "@/scope/manifest";

export const NOTIFICATION_CATEGORIES = [
  { category: "quote.follow_up_due", module: "quotes", defaultEnabled: true, essential: true },
  { category: "quote.accepted", module: "quotes", defaultEnabled: true, essential: false },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["category"];
export type NotificationChannel = "in_app" | "email";

export function activeNotificationCategories() {
  const declared = new Set(SCOPE_MANIFEST.modules.filter((m) => m.status === "active").flatMap((m) => m.notificationCategories));
  return NOTIFICATION_CATEGORIES.filter((definition) => declared.has(definition.category));
}

export function notificationCategory(category: string) {
  return activeNotificationCategories().find((definition) => definition.category === category) ?? null;
}
