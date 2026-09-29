import { SCOPE_MANIFEST } from "@/scope/manifest";

export const NOTIFICATION_CATEGORIES = [
  { category: "quote.follow_up_due", module: "quotes", defaultEnabled: true, essential: true },
  { category: "quote.delivery", module: "notifications", defaultEnabled: true, essential: false },
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

/**
 * Outbox categories are not automatically personal notification preferences.
 * Quote delivery is addressed to the frozen CRM recipient, rather than the
 * authenticated user's UUID-derived preference identity, so it is deliberately
 * excluded until a future delivery model has an effective user preference.
 */
export function activeNotificationPreferenceCategories() {
  return activeNotificationCategories().filter((definition) => definition.category !== "quote.delivery");
}

export function notificationPreferenceCategory(category: string) {
  return activeNotificationPreferenceCategories().find((definition) => definition.category === category) ?? null;
}
