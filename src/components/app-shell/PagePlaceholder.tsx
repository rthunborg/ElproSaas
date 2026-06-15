/**
 * Honest empty state for an IN-scope Phase A module whose UI is not built yet.
 *
 * Renders the page's `<h1>` (the document heading; the top bar shows the same label as
 * chrome context) and a restrained "built in [epic/story]" message so the screen reads
 * as "not yet built", not as a dormant placeholder.
 *
 * Use ONLY for the seven IN-scope shell modules. Deferred modules get nothing — no nav
 * item, no route, no placeholder (FR61, UX-DR3).
 */
export function PagePlaceholder({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm leading-6 text-zinc-600">
        {children}
      </div>
    </section>
  );
}
