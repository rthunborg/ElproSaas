import { PagePlaceholder } from "@/components/app-shell/PagePlaceholder";

// Shell scope only — no settings sub-routes (company/pricing/quote-terms are Epic 3).
export default function SettingsPage() {
  return (
    <PagePlaceholder title="Inställningar">
      <p>Den här modulen byggs i Epic 3 (företagsidentitet, prissättning och offertvillkor).</p>
    </PagePlaceholder>
  );
}
