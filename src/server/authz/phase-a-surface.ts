import { navItems, type NavItem } from "@/components/app-shell/nav-items";
import { SCOPE_MANIFEST } from "@/scope/manifest";
import { resolveCapability } from "./permission-matrix";
import { normalizeRoles, type TenantRole } from "./roles";

/**
 * Converts the server authority (active manifest × permission matrix) into
 * presentational navigation data. The browser receives only the already filtered
 * labels/icons/routes; it never receives roles or the permission matrix.
 */
export function resolvePhaseANavigation(roles: readonly unknown[] | undefined): NavItem[] {
  const roleSet = normalizeRoles(roles);
  const capabilityByRoute = new Map(
    SCOPE_MANIFEST.modules
      .filter((module) => module.status === "active")
      .flatMap((module) =>
        module.navItems.map((item) => [item.route, { module: module.id, capability: item.requiredCapability }] as const),
      ),
  );

  return navItems.filter((item) => {
    const requirement = capabilityByRoute.get(item.href);
    return Boolean(
      requirement?.capability &&
        resolveCapability({ roles: roleSet, module: requirement.module, capability: requirement.capability }).granted,
    );
  });
}

/** E15 replaces the current Montör dashboard fallback with `/my-day`. */
export function resolveLandingRoute(roles: readonly unknown[] | undefined): string | null {
  const visible = resolvePhaseANavigation(roles);
  return visible.some((item) => item.href === "/dashboard") ? "/dashboard" : visible[0]?.href ?? null;
}

export function canAccessPhaseARoute(
  roles: readonly TenantRole[] | undefined,
  route: string,
): boolean {
  return resolvePhaseANavigation(roles).some((item) => route === item.href || route.startsWith(`${item.href}/`));
}
