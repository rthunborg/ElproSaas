"use client";

/**
 * Phase A app shell — the ONLY sidebar in the app (no nested sidebars; UX §2).
 *
 * Responsive navigation model (UX §2):
 *   - lg+ (≥1024px): persistent sidebar with icon + text label.
 *   - md  (768–1023px): collapses to an icon rail; each icon-only link exposes an
 *     accessible name (`aria-label`) AND a CSS tooltip on hover/focus-visible (AC3).
 *   - <md (<768px): rail hidden; a drawer is toggled by the top-bar hamburger.
 *
 * Presentation only — navigation is NOT a security boundary. It renders links and a
 * page-title/primary-action chrome; authorization is enforced server-side / via RLS
 * in later stories (epics.md#Story 1.3 Security/RLS Impact).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { navItems } from "./nav-items";
import { NavIcon } from "./NavIcon";

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  // Exact match today; `startsWith` keeps active state correct once detail routes land.
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  variant,
  pathname,
  onNavigate,
}: {
  variant: "sidebar" | "drawer";
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href} className="relative">
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              // Sidebar collapses to icon-only at md, so the link needs an explicit
              // accessible name there. The drawer always shows its text label.
              aria-label={variant === "sidebar" ? item.label : undefined}
              className={[
                "group/navlink relative flex items-center gap-3 rounded-md py-2 pl-3 pr-3 text-sm transition-colors",
                "border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600",
                // Active state must NOT rely on color alone (UX-DR4/36): left border + bold weight.
                active
                  ? "border-blue-600 bg-blue-50 font-semibold text-blue-900"
                  : "border-transparent font-normal text-zinc-700 hover:bg-zinc-100",
              ].join(" ")}
            >
              <NavIcon paths={item.iconPaths} className="size-6 shrink-0" />
              <span className={variant === "sidebar" ? "hidden lg:inline" : "inline"}>
                {item.label}
              </span>
              {variant === "sidebar" && (
                // Icon-rail tooltip (AC3): visible on hover AND focus, CSS-driven (not the
                // native `title`, which is unreliable for keyboard focus). `focus-within`
                // fires for every focus path (keyboard, switch, programmatic), so AC3's
                // "receives focus" holds regardless of the browser's focus-visible heuristic.
                // Redundant once the text label shows at lg, so it is hidden there.
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/navlink:opacity-100 group-focus/navlink:opacity-100 group-focus-within/navlink:opacity-100 lg:hidden"
                >
                  {item.label}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [skipFocused, setSkipFocused] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const activeItem = navItems.find((item) => isActive(pathname, item.href));
  const pageTitle = activeItem?.label ?? "ElproSaas";

  // Explicit close (Escape / overlay / close button): return focus to the toggle (UX-DR35).
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  // Link activation closes the drawer; navigation moves focus to the new page.
  const handleDrawerNavigate = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    // Move focus into the drawer on open (predictable focus, UX-DR35) and lock
    // background scroll while the modal drawer is open.
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  // Escape closes; Tab is trapped within the drawer panel.
  const onDrawerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = drawerRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closeDrawer],
  );

  return (
    <>
      {/* Skip-to-content: first focusable element, visible on focus (UX §10). Always in
          the a11y tree; parked off-screen (`-top-24`) and pulled into view (`top-4`) by
          toggling a Tailwind class on the React focus/blur events. (Event-driven rather
          than a `focus:` CSS variant so it is robust and verifiable.) */}
      <a
        href="#main-content"
        onFocus={() => setSkipFocused(true)}
        onBlur={() => setSkipFocused(false)}
        className={`fixed left-4 z-[100] rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-lg ${
          skipFocused ? "top-4" : "-top-24"
        }`}
      >
        Hoppa till innehåll
      </a>

      <div className="flex min-h-screen w-full bg-zinc-50 text-zinc-900">
        {/* Persistent sidebar (lg) / icon rail (md). Hidden below md. */}
        <aside className="hidden shrink-0 flex-col border-r border-zinc-200 bg-white md:flex md:w-16 lg:w-60">
          <div className="flex h-14 items-center border-b border-zinc-200 px-3">
            <span className="truncate font-semibold text-zinc-900">
              <span className="lg:hidden" aria-hidden="true">
                EP
              </span>
              <span className="hidden lg:inline">ElproSaas</span>
            </span>
          </div>
          <nav aria-label="Huvudnavigation" className="flex-1 overflow-y-auto p-2">
            <NavLinks variant="sidebar" pathname={pathname} />
          </nav>
        </aside>

        {/* Content column: top bar + main. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Öppna meny"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 md:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-6"
              >
                <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>

            {/* Page-title region (chrome context, not the page heading). */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-zinc-900">{pageTitle}</p>
            </div>

            {/* Primary-action slot — intentionally EMPTY in Story 1.3. The owning module's
                story fills this; do not fabricate actions here (shell scope only). */}
            <div data-slot="primary-action" className="flex items-center gap-2" />
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-6 focus:outline-none"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Drawer (small screens only). Conditionally rendered so it is absent from the
          DOM/a11y tree when closed; `md:hidden` keeps it from showing at md+. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Stäng meny"
            tabIndex={-1}
            onClick={closeDrawer}
            className="absolute inset-0 bg-black/40"
          />
          <div
            id="mobile-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Huvudmeny"
            onKeyDown={onDrawerKeyDown}
            className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-white shadow-xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
              <span className="font-semibold text-zinc-900">ElproSaas</span>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeDrawer}
                aria-label="Stäng meny"
                className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="size-6"
                >
                  <path d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav aria-label="Huvudnavigation" className="flex-1 overflow-y-auto p-2">
              <NavLinks variant="drawer" pathname={pathname} onNavigate={handleDrawerNavigate} />
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
