"""Read-only audit of existing 14.4 execution evidence; no test/DB launch."""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / '_bmad-output/test-artifacts'

def read(name):
    return json.loads((ART / name).read_text(encoding='utf-8-sig'))

def suite(report, suffix):
    matches = [s for s in report['testResults'] if s['name'].replace('\\', '/').endswith(suffix)]
    assert len(matches) == 1, (suffix, len(matches))
    return matches[0]['assertionResults']

def counts(records):
    return {key: sum(r['status'] == key for r in records) for key in ('passed', 'failed', 'pending', 'skipped')}

full = read('story14-4-r1-full-int.json')
components = read('story14-4-r1-components-reads-final.json')
browser = read('story14-4-r1-booking-browser-final.json')
browser_evidence = read('story14-4-r1-booking-browser-final-evidence.json')
fingerprint = read('story14-4-r1-working-tree-evidence.json')
assert (full['numTotalTests'], full['numPassedTests'], full['numFailedTests'], full['numPendingTests']) == (1456, 1455, 0, 1)
assert (components['numTotalTests'], components['numPassedTests'], components['numFailedTests'], components['numPendingTests']) == (25, 25, 0, 0)
assert (browser['stats']['expected'], browser['stats']['unexpected'], browser['stats']['skipped'], browser['stats']['flaky']) == (15, 0, 0, 0)
assert browser_evidence['nativeExit'] == 0
assert browser_evidence['buildBefore'] == browser_evidence['buildAfter'] == 'TGBWaTwRYVJLLfZUysZQV'

affected = {}
for file, expected in [
    ('commands/booking-editor.int.test.ts', 58),
    ('commands/booking-editor-review-fixes.int.test.ts', 2),
    ('commands/booking-conflicts.int.test.ts', 62),
    ('commands/bookings.int.test.ts', 16),
    ('commands/bookings-replay-authority.int.test.ts', 12),
    ('rls/bookings.rls.test.ts', 6),
    ('rls/migration-reset.int.test.ts', 13),
]:
    records = suite(full, file)
    assert len(records) == expected and all(r['status'] == 'passed' for r in records), file
    affected[file] = {'total': len(records), **counts(records)}
assert sum(c['total'] for c in affected.values()) == 169

api_records = suite(full, 'commands/booking-editor.int.test.ts')
component_records = suite(components, 'components/booking-editor.test.ts')
assert len(component_records) == 13 and all(r['status'] == 'passed' for r in component_records)
named_components = [r for r in component_records if '14.4-COMP-' in r['fullName']]
assert len(named_components) == 9

browser_records = []
def walk(items):
    for item in items:
        for spec in item.get('specs', []):
            browser_records.append({'title': spec['title'], 'ok': spec['ok'], 'results': [r['status'] for t in spec['tests'] for r in t['results']]})
        walk(item.get('suites', []))
walk(browser['suites'])
assert len(browser_records) == 15 and all(r['ok'] and r['results'] == ['passed'] for r in browser_records)
retained_browser = [r for r in browser_records if not r['title'].startswith('Round1 ')]
assert len(retained_browser) == 13

unit_output = (ART / 'story14-4-r1-unit-results.txt').read_text(encoding='utf-8-sig')
assert re.search(r'# tests 2033\s+# suites 98\s+# pass 2032\s+# fail 0\s+# cancelled 0\s+# skipped 1', unit_output)
unit_file = ROOT / 'tests/unit/features/resources/booking-editor-input.test.ts'
unit_text = unit_file.read_text(encoding='utf-8-sig')
unit_names = re.findall(r'test\("(\[P[01]\] 14\.4-UNIT-INPUT-[^"\n]+)"', unit_text)
assert len(unit_names) == 11
for name in unit_names:
    assert any(line.startswith('ok ') and name in line for line in unit_output.splitlines()), name
scope_name = '[P0] 14.4-GOV-001 active resources command rejects E15 fields while scheduling surfaces remain pending'
assert any(line.startswith('ok ') and scope_name in line for line in unit_output.splitlines())

named_files = [
    'tests/integration/commands/booking-editor.int.test.ts',
    'tests/integration/components/booking-editor.test.ts',
    'tests/e2e/booking-editor.e2e.spec.ts',
    'tests/unit/features/resources/booking-editor-input.test.ts',
    'tests/unit/scope/booking-editor-scope.test.ts',
]
for file in named_files:
    text = (ROOT / file).read_text(encoding='utf-8-sig')
    assert not re.search(r'\b(?:test|it|describe)\.(?:skip|only|fixme)\s*\(', text), file
    assert not re.search(r'\bskip\s*:\s*true', text), file

conflicts = suite(full, 'commands/booking-conflicts.int.test.ts')
transfers = {}
for obligation in ('14.3-INT-003', '14.3-INT-004', '14.3-INT-005', '14.3-INT-006'):
    records = [r for r in conflicts if obligation in r['fullName']]
    assert records and all(r['status'] == 'passed' for r in records), obligation
    transfers[obligation] = [r['fullName'] for r in records]

for item in fingerprint['sourceFiles']:
    assert hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
assert len(fingerprint['sourceFiles']) == 48
git = subprocess.run(['git', 'diff', '4383b99be5ecbe11e67eb4bb0a838bee918bf357', 'HEAD', '--', 'src', 'tests', 'supabase/migrations', 'package.json', 'pnpm-lock.yaml', 'playwright.config.ts', 'vitest.config.ts'], cwd=ROOT, capture_output=True, text=True, check=True)
assert not git.stdout.strip(), 'Product delta since authored implementation'
head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()

result = {
    'success': True, 'audit_native_exit': 0, 'product_tests_executed_this_run': 0,
    'head': head, 'authored_revision': '4383b99be5ecbe11e67eb4bb0a838bee918bf357',
    'product_delta_since_authored_revision': False,
    'named_retained': {'api': 58, 'browser': 13, 'component': 9, 'unit_input': 11, 'scope': 1, 'total': 92},
    'affected_integration': affected, 'affected_total': 169,
    'full_integration': {'total': 1456, 'passed': 1455, 'failed': 0, 'skipped': 1, 'native_exit': '0 from trusted implementation execution summary; raw JSON has no native field'},
    'full_unit': {'total': 2033, 'passed': 2032, 'failed': 0, 'skipped': 1, 'native_exit': '0 from trusted implementation execution summary; TAP has no native field'},
    'component_read': {'total': 25, 'passed': 25, 'failed': 0, 'skipped': 0, 'native_exit': '0 from trusted implementation execution summary'},
    'browser': {'total': 15, 'passed': 15, 'failed': 0, 'skipped': 0, 'flaky': 0, 'native_exit': browser_evidence['nativeExit'], 'build': browser_evidence['buildId'], 'records': browser_records},
    'component_records': [r['fullName'] for r in component_records],
    'unit_named_records': unit_names, 'scope_named_record': scope_name,
    'contract_c_transfers': transfers,
    'source_hashes_verified': 48, 'source_fingerprint': fingerprint['sourceFingerprint'],
    'post_verification_cosmetic_change': browser_evidence['postVerificationCosmeticChange'],
    'limits': ['Raw report success is not native exit evidence', 'Historical RED comments/checklist are not current skip status', 'Contract D actual calendar click/drag remains pending Story15.1', 'Two unrelated recovery skips receive no acceptance credit', 'No numeric coverage or performance measurement'],
}
(ART / 'story14-4-automation-audit.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')

worker_names = [
    'tea-automate-api-tests-14-4-2026-10-07T13-43-47Z.json',
    'tea-automate-e2e-tests-14-4-2026-10-07T13-43-47Z.json',
]
workers = [read(name) for name in worker_names]
for worker in workers:
    assert worker['success'] is True
    assert isinstance(worker['tests'], list) and worker['tests'] == []
    assert worker['test_count'] == 0 and worker['fixture_needs'] == []
    assert worker['playwright_utils_deviations'] == []
aggregate = {
    'success': True, 'workflow': 'bmad-testarch-automate', 'story': '14.4',
    'detected_stack': 'frontend',
    'execution': {'requestedMode': 'auto', 'resolvedMode': 'subagent', 'probeEnabled': True, 'supports': {'subagent': True, 'agentTeam': False}, 'foreground_workers_completed': 2},
    'worker_files': worker_names,
    'worker_sha256': {name: hashlib.sha256((ART / name).read_bytes()).hexdigest() for name in worker_names},
    'total_tests': 0, 'api_tests': 0, 'e2e_tests': 0, 'backend_tests': 0,
    'component_tests': 0, 'unit_tests': 0,
    'fixtures_created': 0, 'factories_created': 0, 'helpers_created': 0,
    'api_test_files': 0, 'e2e_test_files': 0, 'backend_test_files': 0,
    'priority_coverage': {'P0': 0, 'P1': 0, 'P2': 0, 'P3': 0},
    'retained_existing_priority_tags': {'P0': 64, 'P1': 28, 'P2': 0, 'P3': 0},
    'knowledge_fragments_used': sorted(set(name for worker in workers for name in worker['knowledge_fragments_used']) | {'test-levels-framework', 'test-priorities-matrix', 'selective-testing', 'ci-burn-in', 'test-quality'}),
    'playwright_utils_deviations': [], 'pactjs_utils_deviations': [],
    'pact_mcp_reachable': False, 'pact_fallback_source': 'provider-source',
    'new_coverage_gaps': [], 'product_tests_executed_this_run': 0,
    'product_gates_rerun_this_run': [],
    'evidence_audit': 'story14-4-automation-audit.json',
    'performance_gain': 'Unmeasured; no sequential baseline or fabricated speedup',
    'decision': 'Retain existing meaningful coverage; avoid duplicate tests and unused infrastructure',
    'pending_transferred_work': '14.4-E2E-006 actual calendar click/drag remains mandatory in Story15.1 before applicable calendar exposure/completion',
}
(ART / 'tea-automate-summary-14-4-2026-10-07T13-43-47Z.json').write_text(json.dumps(aggregate, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'success': True, 'named_retained': 92, 'affected_passed': 169, 'source_hashes_verified': 48, 'product_tests_executed_this_run': 0}))
