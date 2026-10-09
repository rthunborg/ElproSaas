import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("eslint-config-next"));
const pluginPath = nextRequire.resolve("@next/eslint-plugin-next");
const { getRootDirs } = require(join(dirname(pluginPath), "utils/get-root-dirs.js"));
const pluginModule = require(pluginPath);
const plugin = pluginModule.default ?? pluginModule;
const { Linter } = require("eslint");

/** Physical fixture verifies the installed patched helper and its actual rule consumer. */
function withRoots(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "kopplas-next-lint-roots-"));
  const previous = process.cwd();
  for (const relative of ["apps/web/app/about", "apps/web/nested/app/hidden", "apps/admin/app/settings"]) {
    mkdirSync(join(directory, relative), { recursive: true });
    writeFileSync(join(directory, relative, "page.tsx"), "export default function Page() { return null; }");
  }
  mkdirSync(join(directory, "apps/web/pages"), { recursive: true });
  writeFileSync(join(directory, "apps/web/pages/about.tsx"), "export default function Page() { return null; }");
  try { process.chdir(directory); run(directory); }
  finally {
    process.chdir(previous);
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("kopplas-next-lint-roots-"));
    rmSync(directory, { recursive: true, force: true });
  }
}
const physical = (roots: string[]) => roots.map((root) => resolve(root)).sort();
function roots(rootDir: unknown, cwd: string) {
  return getRootDirs({ cwd, settings: { next: { rootDir } } }) as string[];
}

test("installed Next lint helper preserves relative, absolute, array and brace root patterns without nested directory expansion", () => {
  withRoots((directory) => {
    const web = join(directory, "apps/web");
    const admin = join(directory, "apps/admin");
    for (const pattern of ["apps/*", "apps/{web,admin}", join(directory, "apps/*")]) {
      assert.deepEqual(physical(roots(pattern, directory)), [admin, web].sort());
    }
    assert.deepEqual(physical(roots(["apps/web", join(directory, "apps/admin"), 42], directory)), [admin, web].sort());
    assert.deepEqual(physical(roots("apps/web", directory)), [web]);
    assert.deepEqual(roots("missing/*", directory), []);
    assert.deepEqual(roots(undefined, directory), [directory]);
    assert.equal(roots("apps/*", directory).some((root) => root.includes("nested") || root.endsWith("/app")), false);
    assert.deepEqual(roots("apps/*", directory).map((root) => join(root, "app")).sort(), [join("apps/admin", "app"), join("apps/web", "app")].sort());
  });
});

test("patched Next no-html-link-for-pages still reports real page route anchors with relative and absolute roots", () => {
  withRoots((directory) => {
    const linter = new Linter({ cwd: directory });
    for (const rootDir of ["apps/web", join(directory, "apps/web")]) {
      const messages = linter.verify('const Link = () => <a href="/about">About</a>;', [{
        files: ["**/*.jsx"],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@next/next": plugin },
        settings: { next: { rootDir } },
        rules: { "@next/next/no-html-link-for-pages": "error" },
      }], { filename: join(directory, "fixture.jsx") });
      assert.equal(messages.filter((message: { ruleId: string }) => message.ruleId === "@next/next/no-html-link-for-pages").length, 1, JSON.stringify(messages));
      assert.equal(messages.some((message: { fatal?: boolean }) => message.fatal), false);
    }
  });
});
