/** Read-only retained-evidence scan; output contains counts/paths, never matched values. */
import fs from "node:fs";
import path from "node:path";
const directory = "_bmad-output/test-artifacts";
const jwt = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const defaults = new Set(fs.readFileSync("tests/support/test-env.ts", "utf8").match(jwt) ?? []);
const files = fs.readdirSync(directory).filter(name => name.startsWith("story14-4-r2-") && /\.(json|txt|md)$/.test(name));
const findings = [];
let publicDefaultJwtOccurrences = 0;
for (const name of files) {
  const content = fs.readFileSync(path.join(directory, name), "utf8");
  const unknownJwt = (content.match(jwt) ?? []).filter(value => {
    if (defaults.has(value)) {publicDefaultJwtOccurrences++; return false;}
    return true;
  }).length;
  const opaqueAuthCookie = (content.match(/\bbase64-[A-Za-z0-9_=-]{40,}/g) ?? []).length;
  const userinfoUrl = (content.match(/\bpostgres(?:ql)?:\/\/[^\s'":@]+:[^\s'"@]+@/g) ?? []).length;
  const unredactedBearer = (content.match(/\bBearer\s+[A-Za-z0-9_.-]{20,}/g) ?? [])
    .filter(value => !defaults.has(value.replace(/^Bearer\s+/, ""))).length;
  const proof = (content.match(/["'](?:p_signature|p_review_signature|receipt)["']\s*:\s*["'][A-Za-z0-9_-]{40,}["']/g) ?? []).length;
  if (unknownJwt || opaqueAuthCookie || userinfoUrl || unredactedBearer || proof)
    findings.push({path: path.resolve(directory, name), unknownJwt, opaqueAuthCookie, userinfoUrl, unredactedBearer, proof});
  if (name.endsWith(".json")) JSON.parse(content);
}
const result = {filesScanned: files.length, publicDefaultJwtOccurrences, findingsCount: findings.length, findings,
  limits: "Exact known public-default JWT equality; opaque auth cookies, bearer values, password URLs and serialized proof fields. This is a bounded evidence scan, not a general secret classifier."};
fs.writeFileSync(path.join(directory, "story14-4-r2-independent-artifact-scan.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (findings.length) process.exitCode = 1;
