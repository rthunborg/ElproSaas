import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Story 2.3 RED-PHASE ATDD scaffolds (TEA testarch-atdd): failing acceptance
    // tests that import not-yet-implemented `@/server/commands/*` modules + the
    // `tests/factories/audit-events` helper, so they reference undefined symbols
    // and cannot lint cleanly until Story 2.3 dev-story lands them. Mirrors the
    // tsconfig.json exclusion of the same globs; dev-story REMOVES both ignores
    // when the modules exist and the suites flip GREEN.
    "tests/unit/server/commands/**",
    "tests/integration/commands/**",
  ]),
]);

export default eslintConfig;
