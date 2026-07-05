"use client";

/**
 * A quote-version status badge (Story 6.2, Task 2.3 / 4.2; WCAG 1.4.1). The badge shows the
 * status as a Swedish TEXT label — the color is a redundant reinforcement only, NEVER the sole
 * signal. The label text is the status word so a screen-reader / colour-blind user reads it.
 */
import { quoteStatusColor, quoteStatusLabel } from "./status";

export function StatusBadge({ status }: { readonly status: string }) {
  return (
    <span
      data-testid="quote-status-badge"
      data-status={status}
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        quoteStatusColor(status),
      ].join(" ")}
    >
      {quoteStatusLabel(status)}
    </span>
  );
}
