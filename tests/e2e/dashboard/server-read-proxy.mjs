/**
 * Test-only loopback proxy for actual production-server PostgREST reads.
 * Start through the resource guard; private filesystem plans have no HTTP control API.
 */
import http from "node:http";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Only origin-form paths can be forwarded, always to the configured local origin. */
export function resolveProxyTarget(requestTarget, upstream) {
  if (typeof requestTarget !== "string" || !requestTarget.startsWith("/") ||
    requestTarget.startsWith("//") || requestTarget.includes("\\")) return null;
  try {
    const target = new URL(requestTarget, upstream);
    return target.origin === upstream.origin ? target : null;
  } catch { return null; }
}

export function createReadProxy({ upstream, control }) {
  if (upstream.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(upstream.hostname))
    throw new Error("Only a local Supabase upstream is permitted");
  const counts = new Map();
  function subject(req) {
    try {
      const token = String(req.headers.authorization ?? "").replace(/^Bearer /i, "");
      const value = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
      return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
    } catch { return null; }
  }
  async function planned(req, target) {
    const id = subject(req);
    if (!id) return null;
    let plan;
    try { plan = JSON.parse(await readFile(path.join(control, id + ".json"), "utf8")); }
    catch { return null; }
    const table = target.pathname.replace("/rest/v1/", "");
    const steps = plan.tables?.[table];
    if (!steps?.length) return null;
    const key = id + ":" + plan.revision + ":" + table;
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    const step = steps[Math.min(index, steps.length - 1)];
    if (step.hold) {
      await writeFile(path.join(control, plan.revision + ".held"), "held");
      const deadline = Date.now() + 15000;
      for (;;) {
        try { await access(path.join(control, plan.revision + ".release")); break; }
        catch {
          if (Date.now() > deadline) return { outcome: "error" };
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }
    }
    return step;
  }
  return http.createServer(async (req, res) => {
    const target = resolveProxyTarget(req.url, upstream);
    if (!target) {
      res.writeHead(400, { "content-type": "text/plain" });
      res.end("Unsupported request target");
      return;
    }
    try {
      const step = await planned(req, target);
      if (step?.outcome === "error") {
        // PostgREST retries 503 GETs; a query fault preserves one logical read per plan step.
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ code: "TEST_UNAVAILABLE", message: "Synthetic server-read fault" }));
        return;
      }
      const forwarded = http.request(target, {
        method: req.method, headers: { ...req.headers, host: upstream.host },
      }, response => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      });
      forwarded.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(forwarded);
    } catch { if (!res.headersSent) res.writeHead(502); res.end(); }
  });
}

// Importing the production handler/resolver for unit checks does not launch a service.
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const upstream = new URL(option("--upstream") ?? "http://127.0.0.1:54321");
  const port = Number(option("--port") ?? 37921);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid proxy port");
  const control = path.resolve(option("--control-root") ?? "tests/e2e/.auth/dashboard-control");
  createReadProxy({ upstream, control }).listen(port, "127.0.0.1", () =>
    process.stdout.write("Dashboard read proxy ready on loopback port " + port + "\n"));
}
