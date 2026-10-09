import { resolveTenantContext } from "@/server/auth/resolve-tenant-context";
import { normalizeRoles } from "@/server/authz/roles";
import { resolveSensitiveFieldEntitlement } from "@/server/authz/permission-matrix";
import { eligibleWidgets } from "@/scope/widget-registry";
import type { QuotePipelineDeps, QuotePipelineResult } from "./quote-pipeline";
import type { PipelineDescriptor } from "./entitlements";

export type DashboardDescriptor = {
  readonly data: Pick<PipelineDescriptor["data"], "period" | "sentCount" | "acceptedCount" | "lostCount" | "hitRate" | "acceptedValueOre">;
  readonly entitlements: PipelineDescriptor["entitlements"];
};
export type DashboardPipelineResult =
  | { readonly ok: true; readonly data: { readonly descriptor: DashboardDescriptor; readonly completedAt: string } }
  | { readonly ok: false; readonly code: "SERVER_ERROR"; readonly message: string };
export interface DashboardWidget {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly span: number;
  readonly result: DashboardPipelineResult;
}
export interface DashboardDeps extends QuotePipelineDeps {
  readonly resolveContext?: typeof resolveTenantContext;
  readonly readPipeline?: (period?: Parameters<typeof import("./quote-pipeline").readQuotePipelineResult>[0],
    entitlement?: Parameters<typeof import("./quote-pipeline").readQuotePipelineResult>[1],
    deps?: QuotePipelineDeps) => Promise<QuotePipelineResult>;
}
const unavailable = (): DashboardPipelineResult => ({
  ok: false, code: "SERVER_ERROR", message: "Kunde inte läsa offertpipeline",
});

/** Resolve authority for every request/refresh before selecting or invoking any loader. */
export async function readDashboard(deps: DashboardDeps = {}): Promise<{ readonly widgets: DashboardWidget[] }> {
  let context;
  try { context = await (deps.resolveContext ?? resolveTenantContext)({ client: deps.client }); }
  catch { return { widgets: [] }; }
  if (!context.ok) return { widgets: [] };
  const roles = normalizeRoles(context.data.roles);
  const registrations = eligibleWidgets(roles);
  const widgets = await Promise.all(registrations.map(async registration => {
    let result: DashboardPipelineResult;
    try {
      const read = deps.readPipeline ?? registration.load;
      const pipeline = await read(undefined, { roles }, { client: deps.client, now: deps.now });
      result = browserPipeline(pipeline, roles);
    } catch { result = unavailable(); }
    return { id: registration.id, title: registration.title, href: registration.href,
      span: registration.span, result };
  }));
  return { widgets };
}

/** Allowlist the actual browser DTO; sensitive authority remains server-derived. */
function browserPipeline(result: QuotePipelineResult, roles: readonly string[]): DashboardPipelineResult {
  if (!result.ok) return unavailable();
  const { descriptor, completedAt } = result.data;
  const { data } = descriptor;
  const withheld = resolveSensitiveFieldEntitlement({ roles, module: "quotes", field: "acceptedValueOre" }).withheld;
  const moneyListed = descriptor.entitlements.withheld.includes("acceptedValueOre");
  if (!Number.isFinite(Date.parse(completedAt)) ||
    [data.sentCount, data.acceptedCount, data.lostCount].some(value => !Number.isSafeInteger(value) || value < 0) ||
    (data.hitRate !== null && (!Number.isFinite(data.hitRate) || data.hitRate < 0 || data.hitRate > 1)) ||
    (!withheld && (moneyListed || !Number.isSafeInteger(data.acceptedValueOre))) ||
    (withheld && !moneyListed)) return unavailable();
  const projected: DashboardDescriptor = {
    data: {
      period: { from: data.period.from, to: data.period.to },
      sentCount: data.sentCount, acceptedCount: data.acceptedCount, lostCount: data.lostCount,
      hitRate: data.hitRate,
      ...(!withheld ? { acceptedValueOre: data.acceptedValueOre } : {}),
    },
    entitlements: { withheld: withheld ? ["acceptedValueOre"] : [] },
  };
  return { ok: true, data: { descriptor: projected, completedAt } };
}
