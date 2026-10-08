import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = 'C:/DEV/ElproSaas/';
const prefix = '_bmad-output/test-artifacts/epic-14-gate-iter1';
const readJson = (path) => JSON.parse(readFileSync(root + path, 'utf8').replace(/^\uFEFF/, ''));
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const file = 'tests/integration/commands/resources-boundaries.int.test.ts';
const body = readFileSync(root + file, 'utf8');
const ids = ['14.1-RLS-001', '14.1-RLS-002', '14.1-RLS-003', '14.1-DB-001', '14.1-DB-002'];
const runs = Object.fromEntries(['focused', 'affected', 'full'].map((mode) => {
  const result = readJson(`${prefix}-${mode}.json`);
  const execution = readJson(`${prefix}-${mode}-execution.json`);
  const owned = result.testResults.find((row) => row.name.replace(/\\/g, '/').endsWith(file));
  const cases = owned?.assertionResults.map((row) => ({ title: row.title, status: row.status, durationMs: row.duration })) ?? [];
  if (execution.nativeExitCode !== 0 || result.numFailedTests !== 0 || cases.length !== 5 || cases.some((row) => row.status !== 'passed') || ids.some((id) => !cases.some((row) => row.title.includes(id)))) throw new Error(`Execution evidence invalid: ${mode}`);
  return [mode, { ...execution, total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests, totalFiles: result.testResults.length, totalSuites: result.numTotalTestSuites, cases }];
}));
const preserved = readJson(`${prefix}-preserved-inputs.json`).map((row) => ({ ...row, unchanged: hash(row.path) === row.sha256 }));
if (preserved.some((row) => !row.unchanged)) throw new Error('Frozen input changed');
const prior = readJson('_bmad-output/test-artifacts/story14-4-r2-working-tree-evidence.json');
const priorSourceChecks = prior.sourceFiles.map((row) => ({ ...row, unchanged: hash(root + row.path) === row.sha256 }));
if (priorSourceChecks.length !== 53 || priorSourceChecks.some((row) => !row.unchanged)) throw new Error('Prior product/test/config fingerprint changed');
const sourceChecks = {
  runnerDiscoverableIds: ids.every((id) => body.includes(id)),
  focusedCaseCount: (body.match(/\btest\(/g) ?? []).length,
  sourceExpectCount: (body.match(/\bexpect\(/g) ?? []).length,
  noCommittedFocus: !/\b(?:test|it|describe)\.only\b/.test(body),
  noExplicitSkipOrTodo: !/\b(?:test|it|describe)\.(?:skip|todo|fixme)\b/.test(body),
  noHardWaits: !/waitForTimeout|setTimeout/.test(body),
  noMockedDatabase: !/vi\.(?:mock|fn|spyOn)/.test(body),
  uniqueViolationAsserted: body.includes('23505'),
};
if (sourceChecks.focusedCaseCount !== 5 || !sourceChecks.noCommittedFocus || !sourceChecks.noExplicitSkipOrTodo || !sourceChecks.noHardWaits || !sourceChecks.noMockedDatabase || !sourceChecks.uniqueViolationAsserted) throw new Error('Test source quality evidence invalid');
const artifacts = readdirSync(root + '_bmad-output/test-artifacts').filter((name) => name.startsWith('epic-14-gate-iter1') && name !== 'epic-14-gate-iter1-evidence.json').map((name) => ({ path: root + '_bmad-output/test-artifacts/' + name, sha256: hash(root + '_bmad-output/test-artifacts/' + name) }));
const evidence = { sourceFile: root + file, sourceSha256: hash(root + file), ids, runs, sourceChecks, preserved, priorSourceFingerprint: prior.sourceFingerprint, priorSourceChecks, artifacts, newBrowserExecutions: 0, newUnitExecutions: 0, releaseAuthority: false, gateReevaluationOwner: 'root after checkpoint' };
writeFileSync(root + `${prefix}-evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ sourceChecks, runs: Object.fromEntries(Object.entries(runs).map(([mode, run]) => [mode, { nativeExitCode: run.nativeExitCode, total: run.total, passed: run.passed, failed: run.failed, skipped: run.skipped }])), preservedInputsUnchanged: preserved.every((row) => row.unchanged) }));
