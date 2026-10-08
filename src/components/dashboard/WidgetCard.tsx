import type { ReactNode } from "react";

export function WidgetCard({ title, href, children, busy }: {
  readonly title: string; readonly href: string; readonly children?: ReactNode; readonly busy?: boolean;
}) {
  return (
    <section role="region" aria-label={title} aria-busy={busy || undefined} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 md:col-span-12">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="mt-4">{children}</div>
      <a href={href} className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-zinc-900 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
        Visa offerter
      </a>
    </section>
  );
}
