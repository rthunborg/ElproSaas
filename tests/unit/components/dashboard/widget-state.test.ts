/**
 * Story 19.1 actual dashboard presentation tests.
 * Presentation contract (no authority inputs):
 * QuotePipelineWidget({state, descriptor?, completedAt?, onRetry?}).
 * DashboardGrid({children}); WidgetCard({title, href, children}).
 * Use the implementation's actual exported prop names when activating; retain
 * assertions. HTML semantic contracts below are proposed accessible mount seams.
 * SSR proves markup/state, not hydration, focus, RSC projection or RLS.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire, register } from "node:module";
import { pathToFileURL } from "node:url";
import { formatOreAsKronor } from "@/lib/money";

type Descriptor = {
  data: {
    period: { from: string; to: string };
    sentCount: number; acceptedCount: number; lostCount: number;
    hitRate: number | null; acceptedValueOre?: number;
  };
  entitlements: { withheld: readonly string[] };
};
type WidgetProps = {
  state: "loading" | "loaded" | "empty" | "error";
  descriptor?: Descriptor;
  completedAt?: string;
  onRetry?: () => void;
};
const COMPLETED_AT = "2026-10-07T10:17:42.000Z";
const COMMITMENT_ORE = 91827361;
function descriptor(overrides: Partial<Descriptor["data"]> = {}, withheld: readonly string[] = []): Descriptor {
  return {
    data: { period: { from: "2025-10-07", to: "2026-10-07" },
      sentCount: 4, acceptedCount: 2, lostCount: 2, hitRate: 0.5,
      ...overrides },
    entitlements: { withheld },
  };
}

// Installed TypeScript compiles actual TSX in-process; no files/dependencies or
// shared runner edits. Registration is local to the actual component tests.
let tsxReady = false;
function registerTsx(): void {
  if (tsxReady) return;
  const require = createRequire(import.meta.url);
  const compilerUrl = pathToFileURL(require.resolve("typescript")).href;
  const loader = [
    'import { readFile } from "node:fs/promises";',
    'import ts from ' + JSON.stringify(compilerUrl) + ';',
    'export async function load(url, context, nextLoad) {',
    ' if (!url.endsWith(".tsx")) return nextLoad(url, context);',
    ' const source = await readFile(new URL(url), "utf8");',
    ' const result = ts.transpileModule(source, { fileName: new URL(url).pathname,',
    ' compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });',
    ' return { format: "module", source: result.outputText, shortCircuit: true };',
    '}',
  ].join("\n");
  register("data:text/javascript," + encodeURIComponent(loader), import.meta.url);
  tsxReady = true;
}
async function widget(props: WidgetProps): Promise<string> {
  registerTsx();
  const modulePath = "@/components/dashboard/QuotePipelineWidget";
  const { QuotePipelineWidget } = await import(modulePath) as {
    QuotePipelineWidget: ComponentType<WidgetProps>;
  };
  return renderToStaticMarkup(createElement(QuotePipelineWidget, props));
}
function plain(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

describe("19.1-UNIT-013 actual pipeline component states (SSR)", () => {
  test("[P1] loading announces progress without fabricated values or success time [AC9]", async () => {
    const html = await widget({ state: "loading" });
    assert.match(plain(html), /Offertpipeline/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(plain(html), /Hämtad|0,00|0\s*%|Ingen träffgrad ännu|Inga offerthändelser/);
    assert.doesNotMatch(html, /<time\b/);
  });
  test("[P1] loaded value uses shared integer-öre presentation and honest completion time [AC3,9]", async () => {
    const html = await widget({ state: "loaded",
      descriptor: descriptor({ acceptedValueOre: COMMITMENT_ORE }), completedAt: COMPLETED_AT });
    const text = plain(html);
    assert.match(text, /Skickade/);
    assert.match(text, /Accepterade/);
    assert.match(text, /Förlorade/);
    assert.match(text, /Träffgrad/);
    assert.match(text, /Accepterade \/ \(accepterade \+ förlorade\)/);
    assert.ok(text.includes(formatOreAsKronor(COMMITMENT_ORE)));
    assert.match(text, /2025-10-07/);
    assert.match(text, /2026-10-07/);
    assert.match(text, /Hämtad/);
    assert.match(html, new RegExp('datetime="' + COMPLETED_AT.replace(/\./g, "\\.") + '"', 'i'));
    assert.doesNotMatch(text, /realtid|senast ändrad|Dold|Kunde inte läsa/i);
    assert.equal((html.match(/href="\/quotes"/g) ?? []).length, 1);
    assert.match(text, /Visa offerter/);
  });
  test("[P1] successful empty is period-specific, null rate and entitled zero [AC4,5]", async () => {
    const html = await widget({ state: "empty", completedAt: COMPLETED_AT,
      descriptor: descriptor({ sentCount: 0, acceptedCount: 0, lostCount: 0,
        hitRate: null, acceptedValueOre: 0 }) });
    const text = plain(html);
    assert.match(text, /Inga offerthändelser under perioden/);
    assert.match(text, /Ingen träffgrad ännu/);
    assert.ok(text.includes(formatOreAsKronor(0)));
    assert.match(text, /Hämtad/);
    assert.doesNotMatch(text, /Kunde inte läsa|Dold|inga offerter finns|0\s*%/i);
  });
  test("[P1] sent-only success is active but has no decided-deal rate [AC5]", async () => {
    const html = await widget({ state: "loaded", completedAt: COMPLETED_AT,
      descriptor: descriptor({ sentCount: 3, acceptedCount: 0, lostCount: 0,
        hitRate: null, acceptedValueOre: 0 }) });
    assert.match(plain(html), /Ingen träffgrad ännu/);
    assert.doesNotMatch(plain(html), /Inga offerthändelser under perioden|Kunde inte läsa|0\s*%/);
    assert.match(plain(html), /Hämtad/);
  });
  test("[P1] absent-withheld money renders Dold and SR description, never zero [AC4]", async () => {
    const html = await widget({ state: "loaded", completedAt: COMPLETED_AT,
      descriptor: descriptor({}, ["acceptedValueOre"]) });
    assert.match(plain(html), /Accepterat värde/);
    assert.match(plain(html), /Dold/);
    assert.match(plain(html), /Dolt för din roll/);
    // Interactive tooltip/long-press behavior is asserted by Playwright.
    assert.doesNotMatch(html, /91827361|918273,61|acceptedValueOre[^<]*[=:]\s*[0-9]/);
    assert.doesNotMatch(plain(html), /0,00|Kunde inte läsa/);
    assert.match(plain(html), /Hämtad/);
  });
  test("[P1] failure has accessible local error/retry and no values or success stamp [AC6,9]", async () => {
    const html = await widget({ state: "error", onRetry: () => {} });
    const text = plain(html);
    assert.match(text, /Offertpipeline/);
    assert.match(text, /Kunde inte läsa offertpipeline/);
    assert.match(html, /role="alert"/);
    assert.match(html, /<button\b[^>]*>/);
    assert.match(text, /Försök igen/);
    assert.match(text, /Visa offerter/);
    assert.equal((html.match(/href="\/quotes"/g) ?? []).length, 1);
    assert.doesNotMatch(text, /Hämtad|Skickade|Accepterat värde|0,00|Ingen träffgrad ännu|Inga offerthändelser/);
    assert.doesNotMatch(html, /<time\b|SQLSTATE|stack|quote_acceptances/);
  });
});

describe("19.1-UNIT-014 card isolation in the real grid", () => {
  for (const state of ["loaded", "error"] as const) {
      test("[P1] " + state + " pipeline preserves a healthy sibling in the shared grid [AC6]", async () => {
      registerTsx();
      const gridPath = "@/components/dashboard/DashboardGrid";
      const cardPath = "@/components/dashboard/WidgetCard";
      const widgetPath = "@/components/dashboard/QuotePipelineWidget";
      const { DashboardGrid } = await import(gridPath) as { DashboardGrid: ComponentType<{ children?: ReactNode }> };
      const { WidgetCard } = await import(cardPath) as { WidgetCard: ComponentType<{ title: string; href: string; children?: ReactNode }> };
      const { QuotePipelineWidget } = await import(widgetPath) as { QuotePipelineWidget: ComponentType<WidgetProps> };
      // Synthetic sibling is TEST-ONLY, never registry/manifest live surface.
      const tree = createElement(DashboardGrid, null,
        createElement(QuotePipelineWidget, { state,
          descriptor: state === "loaded" ? descriptor({ acceptedValueOre: COMMITMENT_ORE }) : undefined,
          completedAt: state === "loaded" ? COMPLETED_AT : undefined, onRetry: () => {} }),
        createElement(WidgetCard, { title: "Kontrollkort", href: "/dashboard" },
          createElement("p", null, "Frisk kontroll")));
      const html = renderToStaticMarkup(tree);
      assert.match(plain(html), /Kontrollkort Frisk kontroll/);
      assert.match(plain(html), /Offertpipeline/);
      assert.equal(plain(html).includes("Kunde inte läsa offertpipeline"), state === "error");
      assert.match(html, /href="\/dashboard"/);
    });
  }
});
// Onboarding branch matrix stays in the actual dashboard/server tests and
// existing onboarding regression; manually reproducing its ternaries here
// would test this scaffold rather than DashboardPage.
