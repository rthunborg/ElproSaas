/**
 * Module-resolution hook: resolves the project's `@/*` path alias (tsconfig:
 * `@/* -> ./src/*`) so the `node --test` pure-logic runner can import production modules
 * that use the alias. Dependency-free (mirrors the bare-Node `scripts/verify/*.mjs`
 * pattern). Used ONLY by the test runner — Next.js / tsc resolve the alias themselves.
 *
 * TypeScript-style imports omit the file extension, so when an aliased path has no
 * extension we probe `.ts` / `.tsx` / `index.ts`.
 *
 * This runner is intentionally dependency-free and additive: it does NOT pre-empt the
 * TEA `testarch-framework` (Vitest) decision, which lands with Story 2.2's DB-backed
 * INT/RLS suites. Story 2.1's pure-logic branch tests run here today (test-design
 * "Critical Prerequisite": the authoritative DB-backed tests are owned by 2.2).
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = join(process.cwd(), "src");

function withResolvedExtension(absPath) {
  // A bare DIRECTORY (e.g. `@/lib/money` → `src/lib/money`) is not an ESM importable — Node
  // rejects a directory import. Resolve it to its `index.ts` barrel so an extensionless
  // package-style import of a directory works, matching how tsc/Next resolve `index.ts`.
  if (existsSync(absPath) && statSync(absPath).isDirectory()) {
    const indexTs = join(absPath, "index.ts");
    if (existsSync(indexTs)) return indexTs;
    const indexTsx = join(absPath, "index.tsx");
    if (existsSync(indexTsx)) return indexTsx;
    return absPath;
  }
  if (existsSync(absPath)) return absPath;
  for (const candidate of [
    `${absPath}.ts`,
    `${absPath}.tsx`,
    join(absPath, "index.ts"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return absPath;
}

export async function resolve(specifier, context, nextResolve) {
  // `@/*` path alias -> `src/*`.
  if (specifier.startsWith("@/")) {
    const target = withResolvedExtension(join(srcRoot, specifier.slice(2)));
    return nextResolve(pathToFileURL(target).href, context);
  }

  // Extensionless RELATIVE imports between TS modules (`./x`, `../x`). tsc/Next resolve
  // these natively; node's ESM type-stripping does not, so probe `.ts`/`.tsx`/`index.ts`
  // against the importing module's directory. Specifiers that already have an extension
  // (or point at a package) fall through to the default resolver.
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[cm]?[jt]sx?$/.test(specifier) &&
    context.parentURL
  ) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const resolved = withResolvedExtension(join(parentDir, specifier));
    if (resolved !== join(parentDir, specifier)) {
      return nextResolve(pathToFileURL(resolved).href, context);
    }
  }

  return nextResolve(specifier, context);
}
