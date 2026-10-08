"""Real CLI contract tests using disposable Git repositories and isolated worktrees.

Every helper operation runs its actual executable entry point. Evidence is synthetic
review metadata plus executed fixture checks; no live project, agents or services.
"""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'parallel_run.py'


class ParallelCli(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='parallel-cli-')
        self.addCleanup(self.temp.cleanup)
        # Windows TEMP may use an 8.3 alias (for example RUNNER~1). Match the
        # helper's canonical worktree paths before constructing fixture paths.
        self.root = Path(self.temp.name).resolve()
        # Space and Unicode paths also exercise Windows subprocess argument handling.
        self.repo = self.root / 'integration å space'
        self.repo.mkdir()
        self.git(self.repo, 'init', '-b', 'codex/integration')
        for key, value in [('user.name', 'Synthetic CLI Pilot'),
                           ('user.email', 'cli@example.invalid'),
                           ('core.autocrlf', 'false'), ('commit.gpgsign', 'false')]:
            self.git(self.repo, 'config', key, value)
        self.hooks = self.root / 'empty-hooks'
        self.hooks.mkdir()
        self.git(self.repo, 'config', 'core.hooksPath', str(self.hooks))
        self.write(self.repo, '.agents/skills/auto-bmad/SKILL.md',
                   'Frozen synthetic workflow\n')
        for story_id in ['a', 'b']:
            self.write(self.repo, 'spec/' + story_id + '.md',
                       'Approved ' + story_id.upper() + '\n')
        self.base = self.commit(self.repo, 'approved fixture')
        self.workers = {}
        self.worker_branches = {}
        for story_id in ['a', 'b']:
            worktree = self.root / ('worker ' + story_id)
            self.git(self.repo, 'worktree', 'add', '-b', 'codex/worker-' + story_id,
                     str(worktree), self.base)
            self.workers[story_id] = worktree
            self.worker_branches[story_id] = 'codex/worker-' + story_id
        self.plan = {
            'schema_version': 1, 'story_source': 'sprint', 'run_id': 'cli-pilot',
            'epic': '99', 'coordinator': 'coordinator-fixture',
            'integration_branch': 'codex/integration',
            'integration_worktree': str(self.repo), 'base_sha': self.base,
            'workflow_version': self.cli('version')['workflow_version'],
            'max_workers': 2, 'stories': [self.story('a'), self.story('b')],
            'integrated_prerequisites': [], 'legacy_reservations': [],
            'shared_paths': [],
            'final_required_checks': ['epic-gates', 'retrospective',
                                      'deferred-reconciliation', 'completion-report'],
        }
        self.planfile = self.json_file('plan', self.plan)
        self.assignments = {}

    def process(self, argv, cwd=None):
        return subprocess.run(argv, cwd=cwd, capture_output=True, text=True,
                              encoding='utf-8', errors='strict', timeout=60)

    def git(self, repo, *args):
        proc = self.process(['git', '-C', str(repo), *args])
        self.assertEqual(proc.returncode, 0, proc.stderr)
        return proc.stdout.strip()

    def write(self, repo, name, data):
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(data, encoding='utf-8', newline='\n')

    def commit(self, repo, message):
        self.git(repo, 'add', '--all')
        self.git(repo, 'commit', '-m', message)
        return self.git(repo, 'rev-parse', 'HEAD')

    def story(self, story_id):
        return {
            'id': story_id, 'approved': True,
            'spec_path': 'spec/' + story_id + '.md',
            'spec_revision': hashlib.sha256(
                ('Approved ' + story_id.upper() + '\n').encode()).hexdigest(),
            'prerequisites': [], 'write_paths': ['src/' + story_id + '/',
                                                'spec/' + story_id + '.md',
                                                '_bmad-output/auto-bmad/state/' +
                                                story_id + '.yaml'],
            'conflict_domains': [], 'contracts': ['contract-' + story_id],
            'requires_contracts': [], 'risk_domains': ['ordinary'],
            'required_checks': ['unit'],
        }

    def json_file(self, name, data):
        path = self.root / (name + '.json')
        path.write_text(json.dumps(data), encoding='utf-8')
        return path

    def invoke(self, repo, *args):
        return self.process([sys.executable, '-X', 'utf8', str(SCRIPT),
                             '--repo', str(repo), *args])

    def cli(self, command, *, repo=None, failure=None, **options):
        args = [command]
        if command not in {'version', 'plan'}:
            args += ['--owner', options.pop('owner', 'coordinator-fixture')]
        if command not in {'version', 'plan', 'init'}:
            args += ['--run', options.pop('run', 'cli-pilot')]
        if command in {'plan', 'init'}:
            args += ['--plan', str(options.pop('plan', self.planfile))]
        for key, value in options.items():
            args += ['--' + key.replace('_', '-'), str(value)]
        proc = self.invoke(repo or self.repo, *args)
        self.assertEqual(proc.returncode, 1 if failure else 0,
                         proc.stdout + proc.stderr)
        self.assertEqual(proc.stderr, '', proc.stderr)
        # The entry point promises one JSON object, including refusal responses.
        self.assertEqual(len(proc.stdout.splitlines()), 1, proc.stdout)
        result = json.loads(proc.stdout)
        self.assertIs(result['ok'], not bool(failure))
        if failure:
            self.assertIn(failure, result['error'])
            self.assertTrue(result['error_type'])
        return result

    def claim(self, story_id):
        assignment = self.cli('claim', story=story_id, worker='worker-' + story_id,
                              branch=self.worker_branches[story_id],
                              worktree=self.workers[story_id])
        self.assignments[story_id] = assignment
        return assignment

    def check(self, repo, head, name='unit'):
        # Execute a real bounded check of every currently integrated fixture file.
        code = ("from pathlib import Path; import json; "
                "files=sorted(Path('src').glob('*/result.txt')); assert files; "
                "assert all(p.read_text(encoding='utf-8') == "
                "p.parent.name + ' complete\\n' for p in files); "
                "print(json.dumps({'executed':len(files)}))")
        argv = [sys.executable, '-X', 'utf8', '-c', code]
        proc = self.process(argv, cwd=repo)
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        executed = json.loads(proc.stdout)['executed']
        return {'name': name, 'argv': argv, 'result': 'passed',
                'executed': executed, 'skipped': 0, 'commit': head}

    def review(self, head):
        return {'approved': True, 'reviewer': 'synthetic-independent-reviewer',
                'commit': head, 'model': 'gpt-6.1-sol', 'effort': 'low',
                'unresolved': []}

    def worker_evidence(self, story_id):
        assignment = self.assignments[story_id]
        worker = self.workers[story_id]
        self.write(worker, 'src/' + story_id + '/result.txt',
                   story_id + ' complete\n')
        self.write(worker, '_bmad-output/auto-bmad/state/' + story_id + '.yaml',
                   'status: review\nepic_num: 99\nparallel_run_id: cli-pilot\n'
                   + 'story_id: ' + story_id + '\nbranch: ' + assignment['branch'] + '\n')
        result = self.commit(worker, 'worker ' + story_id + ' complete')
        paths = self.git(self.repo, 'diff', '--name-only', '--no-renames',
                         assignment['base_sha'], result).splitlines()
        return {'schema_version': 1, 'run_id': assignment['run_id'],
                'story_id': story_id, 'worker': assignment['worker'],
                'generation': assignment['generation'],
                'base_sha': assignment['base_sha'], 'result_sha': result,
                'workflow_version': assignment['workflow_version'],
                'spec_revision': assignment['story']['spec_revision'],
                'changed_paths': sorted(paths),
                'checks': [self.check(worker, result)],
                'review': self.review(result),
                'routes': [{'phase': 'build', 'model': 'gpt-6.1-sol',
                            'effort': 'low', 'risk_domains': ['ordinary'],
                            'reason': 'Synthetic ordinary fixture change'}]}

    def submit(self, story_id, evidence, failure=None):
        return self.cli('submit', repo=self.workers[story_id], story=story_id,
                        worker='worker-' + story_id,
                        evidence=self.json_file('worker-evidence-' + story_id,
                                                evidence), failure=failure)

    def combined(self, head, final=False):
        names = ['unit'] + (self.plan['final_required_checks'] if final else [])
        return {'schema_version': 1, 'run_id': 'cli-pilot',
                'integration_sha': head,
                'checks': [self.check(self.repo, head, name) for name in names],
                'review': self.review(head), 'unresolved': []}

    def integrate(self, story_id, **options):
        return self.cli('integrate', story=story_id,
                        expected_head=options.pop(
                            'expected_head', self.git(self.repo, 'rev-parse', 'HEAD')),
                        **options)

    def verify(self, story_id):
        head = self.git(self.repo, 'rev-parse', 'HEAD')
        return self.cli('verify', story=story_id,
                        evidence=self.json_file('combined-' + story_id,
                                                self.combined(head)))

    def states(self):
        return {c['story']['id']: c['state']
                for c in self.cli('status')['claims']}

    def test_version_and_plan_are_read_only(self):
        common = Path(self.git(self.repo, 'rev-parse', '--path-format=absolute',
                               '--git-common-dir'))
        before = {str(p.relative_to(common)): p.read_bytes()
                  for p in common.rglob('*') if p.is_file()}
        version = self.cli('version')
        self.assertRegex(version['workflow_version'], r'^[0-9a-f]{64}$')
        report = self.cli('plan')
        self.assertEqual(report['ready_pairs'], [['a', 'b']])
        self.assertEqual(report['ready'], ['a', 'b'])
        after = {str(p.relative_to(common)): p.read_bytes()
                 for p in common.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        self.assertFalse((common / 'auto-bmad-parallel.sqlite3').exists())
        self.assertEqual(self.git(self.repo, 'status', '--porcelain'), '')
        self.assertEqual(self.git(self.repo, 'rev-parse', 'HEAD'), self.base)

    def test_two_workers_complete_through_serial_verified_finalization(self):
        self.cli('init')
        # P1 commits coordinator state before creating workers, so both inherit
        # a running tagged epic anchor. It must not become a legacy collision.
        self.write(self.repo, '_bmad-output/auto-bmad/state/epic/epic-99.yaml',
                   'status: running\nepic_num: 99\nparallel_run_id: cli-pilot\n')
        dispatch_head = self.commit(self.repo, 'coordinator epic bootstrap')
        for story_id in ['a', 'b']:
            worker = self.root / ('assigned worker ' + story_id)
            worker_branch = 'codex/bootstrap-worker-' + story_id
            self.git(self.repo, 'worktree', 'add', '-b', worker_branch,
                     str(worker), dispatch_head)
            self.workers[story_id] = worker
            self.worker_branches[story_id] = worker_branch
        self.assertEqual(self.cli('status')['admission']['ready_pairs'], [['a', 'b']])
        aa, bb = self.claim('a'), self.claim('b')
        self.assertEqual(aa['base_sha'], dispatch_head)
        self.assertEqual(bb['base_sha'], dispatch_head)
        self.cli('block', story='b', worker='worker-b', reason='Fixture wait')
        ea = self.worker_evidence('a')
        self.submit('a', ea)
        merged_a = self.integrate('a')
        self.assertEqual(merged_a['state'], 'awaiting-verification')
        self.assertEqual(self.states(), {'a': 'awaiting-verification', 'b': 'blocked'})
        self.cli('finalize', evidence=self.json_file(
            'premature-final', self.combined(merged_a['integration_sha'], True)),
            failure='unintegrated')
        eb = self.worker_evidence('b')
        self.submit('b', eb)
        self.integrate('b', failure='previous integration')
        self.verify('a')
        # A's imported review-state YAML is legitimate provenance on the coordinator;
        # it must not prevent B's independent result from being integrated next.
        self.assertEqual(self.states(), {'a': 'integrated', 'b': 'ready-for-integration'})
        merged_b = self.integrate('b')
        self.verify('b')
        self.assertEqual(self.states(), {'a': 'integrated', 'b': 'integrated'})
        head = merged_b['integration_sha']
        for evidence in [ea, eb]:
            self.git(self.repo, 'merge-base', '--is-ancestor', evidence['result_sha'], head)
        final = self.cli('finalize', evidence=self.json_file(
            'final', self.combined(head, True)))
        self.assertEqual(final['state'], 'finalized')
        self.assertEqual(final['integration_sha'], head)
        self.cli('finalize', evidence=self.root / 'unused.json',
                 failure='already finalized')
        # Run/status from either worker reaches the same common-dir store.
        self.assertEqual(len(self.cli('status', repo=self.workers['b'])['claims']), 2)
        for repo in [self.repo, *self.workers.values()]:
            self.assertEqual(self.git(repo, 'status', '--porcelain'), '')

    def test_assignment_artifact_alone_supplies_heartbeat_cli_arguments(self):
        self.cli('init')
        artifact = self.json_file('assignment', self.claim('a'))
        assignment = json.loads(artifact.read_text(encoding='utf-8'))
        proc = self.invoke(assignment['repo'], 'heartbeat',
                           '--owner', assignment['owner'],
                           '--run', assignment['run_id'],
                           '--story', assignment['story']['id'],
                           '--worker', assignment['worker'],
                           '--generation', str(assignment['generation']))
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)
        result = json.loads(proc.stdout)
        self.assertTrue(result['ok'])
        self.assertEqual(result['state'], 'running')
        self.assertEqual(Path(result['worktree']), self.workers['a'])

    def test_invalid_cli_arguments_and_json_fail_with_diagnostic_exit(self):
        for args in [[], ['unsupported'], ['claim'],
                     ['heartbeat', '--owner', 'owner', '--run', 'run',
                      '--story', 'a', '--worker', 'worker', '--generation', 'nan']]:
            with self.subTest(args=args):
                proc = self.invoke(self.repo, *args)
                self.assertEqual(proc.returncode, 1, proc.stdout + proc.stderr)
                self.assertEqual(proc.stderr, '')
                self.assertEqual(len(proc.stdout.splitlines()), 1, proc.stdout)
                result = json.loads(proc.stdout)
                self.assertFalse(result['ok'])
                self.assertEqual(result['error_type'], 'Refusal')
                self.assertIn('CLI usage:', result['error'])
        malformed = self.root / 'malformed.json'
        malformed.write_text('{"schema_version":', encoding='utf-8')
        self.cli('plan', plan=malformed, failure='Expecting value')
        duplicate = self.root / 'duplicate.json'
        duplicate.write_text('{"schema_version":1,"schema_version":1}',
                             encoding='utf-8')
        self.cli('plan', plan=duplicate, failure='Duplicate JSON key')
        self.cli('plan', plan=self.root / 'missing.json', failure='No such file')

    def test_stale_results_and_exact_head_verification_are_rejected(self):
        self.cli('init')
        self.claim('a')
        evidence = self.worker_evidence('a')
        stale = copy.deepcopy(evidence)
        stale['generation'] += 1
        self.submit('a', stale, failure='generation mismatch')
        self.assertEqual(self.states(), {'a': 'claimed'})
        self.write(self.workers['a'], 'src/a/additional.txt', 'committed later\n')
        current = self.commit(self.workers['a'], 'later authorized change')
        self.submit('a', evidence, failure='exact worker branch HEAD')
        evidence['result_sha'] = current
        evidence['changed_paths'] = sorted(evidence['changed_paths'] + ['src/a/additional.txt'])
        evidence['checks'] = [self.check(self.workers['a'], current)]
        evidence['review'] = self.review(current)
        self.submit('a', evidence)
        self.integrate('a', expected_head=current, failure='HEAD changed')
        self.assertEqual(self.git(self.repo, 'rev-parse', 'HEAD'), self.base)
        merged = self.integrate('a')
        self.cli('verify', story='a', evidence=self.json_file(
            'stale-combined', self.combined(current)), failure='identity mismatch')
        self.assertEqual(self.states(), {'a': 'awaiting-verification'})
        self.assertEqual(self.verify('a')['integration_sha'], merged['integration_sha'])

    def test_final_evidence_must_cover_current_bookkeeping_commit(self):
        self.cli('init')
        # Serial admission is a supported fallback to concurrent dispatch.
        for story_id in ['a', 'b']:
            if story_id == 'b':
                self.git(self.workers['b'], 'merge', '--ff-only',
                         self.git(self.repo, 'rev-parse', 'HEAD'))
            self.claim(story_id)
            self.submit(story_id, self.worker_evidence(story_id))
            self.integrate(story_id)
            self.verify(story_id)
        old_head = self.git(self.repo, 'rev-parse', 'HEAD')
        old_evidence = self.combined(old_head, True)
        self.write(self.repo, 'coordinator-report.md', 'Synthetic final report\n')
        head = self.commit(self.repo, 'coordinator bookkeeping')
        self.cli('finalize', evidence=self.json_file('old-final', old_evidence),
                 failure='identity mismatch')
        fresh = self.combined(head, True)
        missing = copy.deepcopy(fresh)
        missing['checks'] = missing['checks'][:-1]
        self.cli('finalize', evidence=self.json_file('missing-final-gate', missing),
                 failure='Missing or duplicate required checks')
        self.assertEqual(self.cli('finalize', evidence=self.json_file(
            'current-final', fresh))['integration_sha'], head)

    def test_cli_test_installations_are_identical(self):
        root = SCRIPT.parents[4]
        mirror = root / '.claude/skills/auto-bmad/scripts/tests/test_parallel_cli.py'
        self.assertEqual(Path(__file__).read_bytes(), mirror.read_bytes())


if __name__ == '__main__':
    unittest.main()
