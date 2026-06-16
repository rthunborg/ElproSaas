/**
 * Renders a nav item's inline SVG icon from its `iconPaths` (see {@link NavItem}).
 *
 * Inline SVG only — no icon library is installed (AR28). Icons are decorative here
 * (`aria-hidden`): the accessible name comes from the link's text label / `aria-label`.
 */
import type { NavItem } from "./nav-items";

export function NavIcon({
  paths,
  className,
}: {
  paths: NavItem["iconPaths"];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
