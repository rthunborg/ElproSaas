"use client";

/**
 * Accessible form-field primitives for the CRM dialogs (Story 3.2, Task 3.2 / AC3).
 *
 * Each field:
 *   - has a `<label htmlFor>` bound to the control (icon-only controls get accessible
 *     names elsewhere — this is for labelled inputs);
 *   - on a validation failure sets `aria-invalid="true"` and `aria-describedby`
 *     pointing at the field's error node (programmatic error association — UX §10);
 *   - renders the error in plain Swedish next to the field (no color-only signalling:
 *     the message text carries the meaning, the red tint reinforces it).
 *
 * The `FormErrorSummary` is the top-of-form blocking-error summary in an
 * `aria-live="polite"` region (UX §9), kept SEPARATE from non-blocking warnings (the
 * duplicate-like advisory is a `FormWarning`, not a blocking error).
 */
import { useId } from "react";

export function TextField({
  name,
  label,
  type = "text",
  required = false,
  defaultValue = "",
  error,
  autoComplete,
  inputRef,
}: {
  readonly name: string;
  readonly label: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly defaultValue?: string;
  readonly error?: string | null;
  readonly autoComplete?: string;
  readonly inputRef?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-700">
            *
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={[
          "rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
          hasError ? "border-red-500" : "border-zinc-300",
        ].join(" ")}
      />
      {hasError && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  name,
  label,
  options,
  required = false,
  defaultValue = "",
  error,
  onChange,
  selectRef,
  testId,
}: {
  readonly name: string;
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly required?: boolean;
  readonly defaultValue?: string;
  readonly error?: string | null;
  readonly onChange?: (value: string) => void;
  readonly selectRef?: React.Ref<HTMLSelectElement>;
  /** Optional stable test hook placed on the `<select>` element (e.g. E2E getByTestId). */
  readonly testId?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasError = Boolean(error);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-800">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-700">
            *
          </span>
        )}
      </label>
      <select
        ref={selectRef}
        id={id}
        name={name}
        data-testid={testId}
        required={required}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? errorId : undefined}
        className={[
          "rounded-md border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
          hasError ? "border-red-500" : "border-zinc-300",
        ].join(" ")}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasError && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked = false,
}: {
  readonly name: string;
  readonly label: string;
  readonly defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-zinc-300 text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      />
      <label htmlFor={id} className="text-sm text-zinc-800">
        {label}
      </label>
    </div>
  );
}

/**
 * Top-of-form BLOCKING error summary (UX §9). Lives in an `aria-live="polite"` region
 * so a screen reader announces it when a submit fails. `role="alert"` makes it an
 * assertive landmark for the blocking case. Renders nothing when there is no error.
 */
export function FormErrorSummary({ message }: { message: string | null }) {
  return (
    <div aria-live="polite" data-testid="form-error-summary">
      {message && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * A NON-blocking advisory warning (UX §9 — separate from blocking errors). Used for
 * the duplicate-like advisory: it never blocks submit, it just informs. Visually and
 * semantically distinct from the blocking `FormErrorSummary` (amber, `role="status"`).
 */
export function FormWarning({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      data-testid="form-warning"
      className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      {message}
    </p>
  );
}
