/**
 * Swedish customer-type badge (Story 3.2) — Privatperson / Företag / BRF / Offentlig.
 *
 * Pairs a colored chip with TEXT (no color-only signalling — UX §10): the label itself
 * carries the meaning, the tint is decorative reinforcement. Pure presentation.
 */
import { customerTypeLabel, isCustomerType } from "./customer-presentation";

const TINTS: Record<string, string> = {
  private: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  company: "bg-blue-50 text-blue-800 ring-blue-200",
  brf: "bg-amber-50 text-amber-800 ring-amber-200",
  public: "bg-violet-50 text-violet-800 ring-violet-200",
};

export function CustomerTypeBadge({ type }: { type: string }) {
  const tint = isCustomerType(type)
    ? TINTS[type]
    : "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tint}`}
    >
      {customerTypeLabel(type)}
    </span>
  );
}
