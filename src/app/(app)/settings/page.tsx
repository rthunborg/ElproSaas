/**
 * `/settings` (Inställningar) — the settings hub (Story 3.3, Task 4.1).
 *
 * Links to the IN-scope settings sub-pages: Företagsinställningar (`/settings/company`)
 * and Offertvillkor (`/settings/quote-terms`) from Story 3.3, plus Prissättning
 * (`/settings/pricing`) added by Story 3.4 (the 3.3 hub deliberately omitted it). Adds
 * NO new nav item (`nav-items.ts` stays EXACTLY the seven IN-scope modules) — pricing
 * lives under the existing Inställningar tree.
 */
import Link from "next/link";

export const dynamic = "force-dynamic";

const SETTINGS_LINKS = [
  {
    href: "/settings/company",
    title: "Företagsinställningar",
    description:
      "Företagsidentitet för offerter och PDF, samt standardvärden för momsvisning och momssats.",
  },
  {
    href: "/settings/quote-terms",
    title: "Offertvillkor",
    description:
      "Återanvändbara offertvillkor med godkännandestatus (ägare/juridik).",
  },
  {
    href: "/settings/pricing",
    title: "Prissättning",
    description:
      "Arbetsroller och ett minimalt manuellt artikelregister med återanvändbara priser (i öre).",
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-zinc-900">Inställningar</h1>
        <p className="text-sm text-zinc-600">
          Hantera företagsidentitet, momsstandarder och offertvillkor.
        </p>
      </div>

      <ul className="flex max-w-2xl flex-col gap-3">
        {SETTINGS_LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="block rounded-md border border-zinc-300 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span className="block text-base font-medium text-zinc-900">
                {link.title}
              </span>
              <span className="mt-1 block text-sm text-zinc-600">
                {link.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
