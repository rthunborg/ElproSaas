export type NotificationPresentationItem = {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly body: string;
  readonly route: string;
  readonly readAt: string | null;
  readonly createdAt: string;
};

export type NotificationScanPresentationStatus =
  | { readonly kind: "hidden" }
  | { readonly kind: "never" }
  | { readonly kind: "failed" }
  | { readonly kind: "elapsed"; readonly elapsedMinutes: number };

export type NotificationFilters = {
  readonly moduleOrCategory: string;
  readonly readState: "all" | "unread" | "read";
  readonly fromDate: string;
};

export function formatUnreadNotificationCount(items: readonly NotificationPresentationItem[]): string {
  const unread = items.filter((item) => !item.readAt).length;
  return unread > 9 ? "9+" : String(unread);
}

export function sortLatestNotificationItems<T extends NotificationPresentationItem>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function filterNotificationItems<T extends NotificationPresentationItem>(
  items: readonly T[],
  { moduleOrCategory, readState, fromDate }: NotificationFilters,
): T[] {
  const categoryPrefix = moduleOrCategory === "quotes" ? "quote" : moduleOrCategory;
  return items.filter((item) =>
    (moduleOrCategory === "all" || item.category === categoryPrefix || item.category.startsWith(`${categoryPrefix}.`))
    && (readState === "all" || (readState === "unread" ? !item.readAt : !!item.readAt))
    && (!fromDate || item.createdAt >= fromDate),
  );
}

export function formatNotificationScanStatus(status: NotificationScanPresentationStatus): string | null {
  if (status.kind === "hidden") return null;
  if (status.kind === "never") return "Ingen tidigare skanning.";
  if (status.kind === "failed") return "Senaste skanning misslyckades. Försök igen senare.";
  if (status.elapsedMinutes < 60) return "Senaste skanning: mindre än en timme sedan.";
  const hours = Math.floor(status.elapsedMinutes / 60);
  return `Senaste skanning: Skannad för ${hours} tim sedan.`;
}
