/**
 * Registers the `@/*` alias resolution hook for the `node --test` pure-logic runner.
 * Passed via `--import` from the `test` script (see package.json). Dependency-free.
 */
import { register } from "node:module";

// Second arg is the parent URL the specifier resolves against; `import.meta.url` is
// already a `file://` URL, so `./alias-hook.mjs` resolves next to this file.
register("./alias-hook.mjs", import.meta.url);
