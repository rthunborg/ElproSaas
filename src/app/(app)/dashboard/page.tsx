import { PagePlaceholder } from "@/components/app-shell/PagePlaceholder";

// Shell landing page. Operational, NOT analytics — no fabricated metrics (UX §3).
export default function DashboardPage() {
  return (
    <PagePlaceholder title="Dashboard">
      <p>
        Detta är din operativa startvy. Använd menyn för att navigera mellan
        pilotens moduler. De enskilda vyerna byggs ut allt eftersom de landar i
        kommande epics.
      </p>
    </PagePlaceholder>
  );
}
