"use client";

/**
 * Accessible modal Dialog (Story 3.2, Task 3.1) — the shared CRM create/edit shell.
 *
 * Mirrors the EXISTING `AppShell` drawer focus pattern rather than inventing a new one:
 *   - `role="dialog"` + `aria-modal="true"` + an `aria-label`/`aria-labelledby`;
 *   - moves focus INTO the dialog on open (the first focusable, or an explicit
 *     `initialFocusRef`);
 *   - traps Tab within the panel (wraps first/last; pulls focus back if it drifts out);
 *   - closes on Escape, overlay click, and the close button;
 *   - RETURNS focus to the invoking control on close (the element focused at open time).
 *
 * Presentation only — it is NOT a security boundary. The actual mutation authority is
 * the 3.1 envelope command behind the form's server action.
 */
import { useCallback, useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  busy = false,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: React.ReactNode;
  /** Optional control to focus on open (defaults to the first focusable element). */
  readonly initialFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * When true a mutation is IN FLIGHT: ALL dismiss paths (Escape, backdrop click, the header X) are
   * gated off and the close controls render `disabled`, so a mid-flight dismissal can't discard the
   * entered fields / reset local state while the server action is still running. The caller's own
   * cancel button must be disabled independently (this only owns the Dialog's chrome close paths).
   */
  readonly busy?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // The element that had focus when the dialog opened — focus returns here on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Capture the invoking control and move focus INTO the dialog on open; lock body
  // scroll while modal; restore both on close (return focus to the invoker — AC3).
  //
  // Default focus target precedence (AC3 "focus moves INTO the dialog"):
  //   1. an explicit `initialFocusRef` (caller-chosen control);
  //   2. the FIRST focusable in the dialog CONTENT (the form's first field) — the
  //      close button (chrome) is deliberately EXCLUDED from this default so opening
  //      lands on the first field, not the header X (which would be a surprising,
  //      test-observable focus position and worse UX);
  //   3. the close button, only when the content has no focusable at all.
  // This effect is the SINGLE focus owner on open — the dialog bodies do not also
  // focus a field (that would race this parent effect, which runs AFTER child effects).
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const target =
      initialFocusRef?.current ??
      contentRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      closeButtonRef.current;
    target?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      // Return focus to the control that opened the dialog (predictable focus, AC3).
      returnFocusRef.current?.focus();
    };
  }, [open, initialFocusRef]);

  // Close the dialog ONLY when not busy — the single guard shared by every chrome dismiss path
  // (Escape, backdrop, header X). A mid-flight dismissal would reset the caller's local state while
  // the server action is still running (iteration-2 review patch).
  const guardedClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  // Escape closes (unless busy); Tab is trapped within the panel (same shape as AppShell drawer).
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        guardedClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        FOCUSABLE,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [guardedClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button
        type="button"
        aria-label="Stäng dialogruta"
        tabIndex={-1}
        onClick={guardedClose}
        disabled={busy}
        className="fixed inset-0 bg-black/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="relative z-10 w-full max-w-lg rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={guardedClose}
            disabled={busy}
            aria-label="Stäng"
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div ref={contentRef} className="px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
