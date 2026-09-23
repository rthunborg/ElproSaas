import { SCOPE_MANIFEST } from "@/scope/manifest";

export type ProducerDeclaration = {
  readonly id: string;
  readonly module: string;
  readonly category: string;
  readonly schedule: string;
  readonly essential: boolean;
};

type ManifestLike = { readonly modules: readonly { readonly id: string; readonly status: string; readonly notificationCategories?: readonly string[] }[] };

/**
 * Producer declarations may only become live when their manifest module is active
 * and owns the exact non-placeholder category. Story 13.1 intentionally declares none.
 */
export function producersFromManifest(manifest: ManifestLike, declarations: readonly ProducerDeclaration[] = []): ProducerDeclaration[] {
  const modules = new Map(manifest.modules.map((module) => [module.id, module]));
  return declarations.filter((producer) => {
    if (!producer.category || producer.category === "placeholder") throw new Error("Producer category must be concrete");
    const scopeModule = modules.get(producer.module);
    return scopeModule?.status === "active" && scopeModule.notificationCategories?.includes(producer.category) === true;
  });
}

export const ACTIVE_PRODUCERS = producersFromManifest(SCOPE_MANIFEST, [{ id: "quotes.follow-up-reminders", module: "quotes", category: "quote.follow_up_due", schedule: "0 * * * *", essential: true }]);
