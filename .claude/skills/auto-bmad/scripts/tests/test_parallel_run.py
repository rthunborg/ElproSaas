"""Behavioral synthetic Git pilot. No live repository, services or worker launch."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1]/'parallel_run.py'
spec = importlib.util.spec_from_file_location('parallel_run',SCRIPT)
engine = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine)

class Pilot(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='parallel-bmad-')
        self.root=Path(self.temp.name)
        self.repo=self.root/'integration'; self.repo.mkdir()
        self.git(self.repo,'init','-b','codex/integration')
        self.git(self.repo,'config','user.name','Synthetic Pilot')
        self.git(self.repo,'config','user.email','pilot@example.invalid')
        self.git(self.repo,'config','core.autocrlf','false')
        self.write(self.repo,'spec/a.md','Approved A\n')
        self.write(self.repo,'spec/b.md','Approved B\n')
        self.write(self.repo,'.agents/skills/auto-bmad/SKILL.md','Synthetic frozen workflow\n')
        self.commit(self.repo,'approved fixture')
        self.base=engine.sha(self.repo,'HEAD')
        self.a=self.root/'a'; self.b=self.root/'b'; self.c=self.root/'c'
        for path,name in [(self.a,'a'),(self.b,'b'),(self.c,'c')]:
            self.git(self.repo,'worktree','add','-b','codex/worker-'+name,str(path),self.base)
        self.plan={'schema_version':1,'story_source':'sprint','run_id':'pilot','epic':'99','coordinator':'coordinator-session','integration_branch':'codex/integration','integration_worktree':str(self.repo),'base_sha':self.base,'workflow_version':engine.workflow_version(self.repo),'max_workers':2,'stories':[self.story('a'),self.story('b')],'integrated_prerequisites':[],'legacy_reservations':[],'shared_paths':[],'final_required_checks':['epic-gates','retrospective','deferred-reconciliation','completion-report']}
        self.planfile=self.root/'plan.json'; self.save_plan()

    def tearDown(self):
        # Only tempfile-owned synthetic repositories are removed by TemporaryDirectory.
        self.temp.cleanup()

    def git(self,repo,*args):
        proc=subprocess.run(['git','-C',str(repo),*args],capture_output=True,text=True,timeout=30)
        self.assertEqual(proc.returncode,0,proc.stderr)
        return proc.stdout.strip()

    def write(self,repo,path,data):
        target=repo/path; target.parent.mkdir(parents=True,exist_ok=True); target.write_text(data,encoding='utf-8')

    def commit(self,repo,message):
        self.git(repo,'add','--all'); self.git(repo,'commit','-m',message)
        return engine.sha(repo,'HEAD')

    def story(self,id):
        return {'id':id,'approved':True,'spec_path':'spec/'+id+'.md','spec_revision':hashlib.sha256(('Approved '+id.upper()+'\n').encode()).hexdigest(),'prerequisites':[],'write_paths':['src/'+id+'/','spec/'+id+'.md'],'conflict_domains':[],'contracts':['contract-'+id],'requires_contracts':[],'risk_domains':['ordinary'],'required_checks':['unit']}

    def save_plan(self): self.planfile.write_text(json.dumps(self.plan),encoding='utf-8')

    def args(self,command,**kwargs):
        argv=['--repo',str(self.repo),command]
        if command not in {'plan','version'}: argv+=['--owner',kwargs.pop('owner','coordinator-session')]
        if command not in {'plan','version','init'}: argv+=['--run',kwargs.pop('run','pilot')]
        if command in {'plan','init'}: argv+=['--plan',str(kwargs.pop('plan',self.planfile))]
        for key,value in kwargs.items(): argv+=['--'+key.replace('_','-'),str(value)]
        return argv

    def call(self,command,**kwargs): return engine.execute(engine.parser().parse_args(self.args(command,**kwargs)))

    def init(self): self.save_plan(); return self.call('init')

    def claim(self,id,path=None,worker=None):
        return self.call('claim',story=id,worker=worker or 'worker-'+id,branch='codex/worker-'+(path.name if path else id),worktree=path or getattr(self,id))

    def check(self,commit,name='unit'):
        return {'name':name,'argv':['python','-m','unittest'],'result':'passed','executed':3,'skipped':0,'commit':commit}

    def review(self,commit,effort='low'):
        return {'approved':True,'reviewer':'independent-reviewer','commit':commit,'model':'gpt-6.1-sol','effort':effort,'unresolved':[]}

    def evidence(self,id,extra=None):
        path=getattr(self,id); self.write(path,'src/'+id+'/result.txt',id+' complete\n')
        if extra: self.write(path,extra,'unauthorized\n')
        result=self.commit(path,'worker '+id)
        return {'schema_version':1,'run_id':'pilot','story_id':id,'worker':'worker-'+id,'generation':1,'base_sha':self.base,'result_sha':result,'workflow_version':self.plan['workflow_version'],'spec_revision':self.story(id)['spec_revision'],'changed_paths':engine.changed(self.repo,self.base,result),'checks':[self.check(result)],'review':self.review(result),'routes':[{'phase':'build','model':'gpt-6.1-sol','effort':'low','risk_domains':['ordinary'],'reason':'Ordinary fixture change'}]}

    def file(self,name,data):
        path=self.root/(name+'.json'); path.write_text(json.dumps(data),encoding='utf-8'); return path

    def submit(self,id,e): return self.call('submit',story=id,worker='worker-'+id,evidence=self.file('evidence-'+id,e))

    def merge(self,id): return self.call('integrate',story=id,expected_head=engine.sha(self.repo,'HEAD'))

    def combined(self,head,final=False):
        names=['unit']+(self.plan['final_required_checks'] if final else [])
        return {'schema_version':1,'run_id':'pilot','integration_sha':head,'checks':[self.check(head,x) for x in names],'review':self.review(head),'unresolved':[]}

    def verify(self,id):
        head=engine.sha(self.repo,'HEAD'); return self.call('verify',story=id,evidence=self.file('combined-'+id,self.combined(head)))

    def test_plan_read_only_ready_pair_and_version(self):
        before=self.git(self.repo,'status','--porcelain')
        result=self.call('plan')
        self.assertEqual(result['ready_pairs'],[['a','b']])
        self.assertFalse((engine.common(self.repo)/'auto-bmad-parallel.sqlite3').exists())
        self.assertEqual(before,self.git(self.repo,'status','--porcelain'))
        self.assertEqual(self.call('version')['workflow_version'],self.plan['workflow_version'])

    def test_two_workers_pilot_block_and_serial_verification(self):
        started=time.monotonic(); self.init(); aa=self.claim('a'); bb=self.claim('b')
        self.assertEqual(aa['base_sha'],bb['base_sha'])
        self.call('block',story='a',worker='worker-a',reason='Waiting for resource')
        eb=self.evidence('b'); self.submit('b',eb)
        merged_b=self.merge('b'); self.assertEqual(merged_b['state'],'awaiting-verification')
        status=self.call('status'); self.assertEqual({x['story']['id']:x['state'] for x in status['claims']},{'a':'blocked','b':'awaiting-verification'})
        with self.assertRaisesRegex(engine.Refusal,'unintegrated'): self.call('finalize',evidence=self.file('premature',self.combined(merged_b['integration_sha'],True)))
        self.verify('b'); ea=self.evidence('a'); self.submit('a',ea); self.merge('a'); self.verify('a')
        head=engine.sha(self.repo,'HEAD'); final=self.call('finalize',evidence=self.file('final',self.combined(head,True)))
        self.assertEqual(final['state'],'finalized')
        self.assertTrue(engine.ancestor(self.repo,ea['result_sha'],head)); self.assertTrue(engine.ancestor(self.repo,eb['result_sha'],head))
        with self.assertRaisesRegex(engine.Refusal,'already finalized'): self.call('finalize',evidence=self.file('repeat',self.combined(head,True)))
        self.assertLess(time.monotonic()-started,120)

    def test_real_concurrent_claims_one_winner_shared_worktrees(self):
        self.init()
        # Distinct processes contend on the actual common-dir SQLite store.
        commands=[self.args('claim',story='a',worker='one',branch='codex/worker-a',worktree=self.a),self.args('claim',story='a',worker='two',branch='codex/worker-c',worktree=self.c)]
        processes=[subprocess.Popen([sys.executable,str(SCRIPT),*cmd],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for cmd in commands]
        outputs=[p.communicate(timeout=60) for p in processes]
        self.assertEqual(sorted(p.returncode for p in processes),[0,1],outputs)
        self.assertEqual(len(self.call('status')['claims']),1)
        a=engine.parser().parse_args(self.args('status')); a.repo=str(self.b)
        self.assertEqual(len(engine.execute(a)['claims']),1)

    def test_crash_after_git_commit_before_state_update_recovers_once(self):
        self.init(); self.claim('a'); self.submit('a',self.evidence('a'))
        with patch.object(engine,'integration_checkpoint',side_effect=RuntimeError('synthetic process death')):
            with self.assertRaises(RuntimeError): self.merge('a')
        head=engine.sha(self.repo,'HEAD')
        self.assertEqual(self.call('status')['claims'][0]['state'],'integrating')
        recovered=self.merge('a'); self.assertTrue(recovered['recovered']); self.assertEqual(recovered['integration_sha'],head)
        self.assertEqual(self.merge('a')['integration_sha'],head)
        self.verify('a'); self.assertEqual(self.call('status')['claims'][0]['state'],'integrated')

    def test_dependencies_require_verified_ancestor_and_contract(self):
        self.plan['stories'][1]['prerequisites']=['a']; self.plan['stories'][1]['requires_contracts']=[{'story':'a','contract':'contract-a'}]
        self.init(); self.assertEqual(self.call('status')['admission']['ready'],['a'])
        self.claim('a'); self.submit('a',self.evidence('a')); self.merge('a')
        with self.assertRaisesRegex(engine.Refusal,'not ready'): self.claim('b')
        self.verify('a')
        self.assertEqual(self.call('status')['admission']['ready'],['b'])
        with self.assertRaisesRegex(engine.Refusal,'exact current'): self.claim('b')
        self.git(self.b,'merge','--ff-only',engine.sha(self.repo,'HEAD'))
        self.assertEqual(self.claim('b')['base_sha'],engine.sha(self.repo,'HEAD'))

    def test_cycles_unknown_prerequisites_and_contract_fail_closed(self):
        for mode in ['cycle','unknown','contract']:
            p=copy.deepcopy(self.plan)
            p['stories'][1]['prerequisites']=['a']
            if mode=='cycle': p['stories'][0]['prerequisites']=['b']
            if mode=='unknown': p['stories'][1]['prerequisites']=['missing']
            if mode=='contract': p['stories'][1]['requires_contracts']=[{'story':'a','contract':'missing'}]
            with self.subTest(mode=mode), self.assertRaises(engine.Refusal): engine.validate_plan(self.repo,p)

    def test_external_prerequisite_must_be_ancestor(self):
        self.write(self.c,'external.txt','prerequisite\n'); external=self.commit(self.c,'external')
        self.plan['stories'][0]['prerequisites']=['external']; self.plan['integrated_prerequisites']=[{'id':'external','commit':external,'checks_passed':True,'contracts':[]}]
        self.save_plan(); self.assertNotIn('a',self.call('plan')['ready'])
        self.assertEqual(self.call('plan')['ready'],['b'])

    def test_path_and_semantic_conflicts_not_independent(self):
        for field,value in [('write_paths',['src/a/']),('conflict_domains',['schema:booking'])]:
            with self.subTest(field=field):
                p=copy.deepcopy(self.plan)
                p['stories'][1][field]=value
                if field=='conflict_domains': p['stories'][0][field]=value
                self.assertFalse(engine.report(self.repo,engine.validate_plan(self.repo,p))['ready_pairs'])
        self.plan['stories'][0]['conflict_domains']=['rpc:shared']; self.plan['stories'][1]['conflict_domains']=['rpc:shared']
        self.init(); self.claim('a')
        with self.assertRaisesRegex(engine.Refusal,'semantic conflict'): self.claim('b')

    def test_invalid_evidence_cannot_land(self):
        self.init(); self.claim('a'); e=self.evidence('a')
        mutations=[('generation',2),('changed_paths',[]),('result_sha',self.base),('workflow_version','stale'),('spec_revision','0'*64)]
        for field,value in mutations:
            bad=copy.deepcopy(e); bad[field]=value
            with self.subTest(field=field),self.assertRaises(engine.Refusal): self.submit('a',bad)
        for skip in [1,-1]:
            bad=copy.deepcopy(e); bad['checks'][0]['skipped']=skip
            with self.assertRaises(engine.Refusal): self.submit('a',bad)
        bad=copy.deepcopy(e); bad['review']['reviewer']='worker-a'
        with self.assertRaises(engine.Refusal): self.submit('a',bad)
        self.assertEqual(self.call('status')['claims'][0]['state'],'claimed')

    def test_sensitive_model_effort_policy(self):
        self.plan['stories'][0]['risk_domains']=['rls']; self.init(); self.assertEqual(self.claim('a')['required_effort'],'high')
        e=self.evidence('a')
        with self.assertRaisesRegex(engine.Refusal,'high effort'): self.submit('a',e)
        e['review']['effort']='high'; e['routes'][0]['risk_domains']=['rls']
        with self.assertRaisesRegex(engine.Refusal,'high effort'): self.submit('a',e)
        e['routes'][0]['effort']='high'; self.submit('a',e)

    def test_out_of_scope_and_aggregate_changes_rejected(self):
        self.init(); self.claim('a')
        e=self.evidence('a',extra='_bmad-output/implementation-artifacts/sprint-status.yaml')
        with self.assertRaisesRegex(engine.Refusal,'outside assigned'): self.submit('a',e)
        for path in ['_bmad-output/implementation-artifacts/deferred-work.md','_bmad-output/auto-bmad/state/epic/epic-99.yaml','.agents/skills/auto-bmad/SKILL.md']:
            p=copy.deepcopy(self.plan); p['stories'][0]['write_paths'].append(path)
            with self.assertRaisesRegex(engine.Refusal,'aggregate/shared'): engine.validate_plan(self.repo,p)

    def test_dirty_worktrees_and_wrong_owner_fail(self):
        self.init()
        with self.assertRaisesRegex(engine.Refusal,'coordinator owner'): self.call('status',owner='impostor')
        self.write(self.a,'dirty.txt','dirty')
        with self.assertRaisesRegex(engine.Refusal,'clean'): self.claim('a')
        (self.a/'dirty.txt').unlink(); self.claim('a')
        self.write(self.a,'dirty.txt','dirty')
        with self.assertRaisesRegex(engine.Refusal,'clean'): engine.clean(self.a)

    def test_scoped_coordinator_repair_and_reverification(self):
        self.init(); self.claim('a'); self.submit('a',self.evidence('a')); original=self.merge('a')['integration_sha']
        self.write(self.repo,'src/a/repair.txt','Targeted reviewed repair\n'); head=self.commit(self.repo,'repair combined check')
        e=self.combined(head)
        with self.assertRaisesRegex(engine.Refusal,'HEAD changed'): self.call('verify',story='a',evidence=self.file('repair-verify',e))
        result=self.call('repair',story='a',expected_head=original,evidence=self.file('repair',e))
        self.assertEqual(result['integration_sha'],head); self.verify('a')
        self.assertEqual(self.call('status')['claims'][0]['state'],'integrated')

    def test_coordinator_repair_rejects_unassigned_paths(self):
        self.init(); self.claim('a'); self.submit('a',self.evidence('a')); original=self.merge('a')['integration_sha']
        self.write(self.repo,'src/b/unassigned.txt','unassigned\n'); head=self.commit(self.repo,'unassigned repair')
        with self.assertRaisesRegex(engine.Refusal,'outside assigned'):
            self.call('repair',story='a',expected_head=original,evidence=self.file('bad-repair',self.combined(head)))

    def test_recovered_two_parent_merge_rejects_extra_paths(self):
        self.init(); self.claim('a'); e=self.evidence('a'); self.submit('a',e)
        with patch.object(engine,'integration_checkpoint',side_effect=RuntimeError('synthetic death')):
            with self.assertRaises(RuntimeError): self.merge('a')
        # Amend only this temporary synthetic merge to emulate unsafe manual resolution.
        self.write(self.repo,'src/b/unassigned.txt','unassigned\n'); self.git(self.repo,'add','--all'); self.git(self.repo,'commit','--amend','--no-edit')
        with self.assertRaisesRegex(engine.Refusal,'outside assigned'): self.merge('a')
        self.assertEqual(self.call('status')['claims'][0]['state'],'integrating')

    def test_worker_coordinator_cross_run_ownership(self):
        self.init(); self.claim('a')
        p=copy.deepcopy(self.plan); p.update(run_id='other',epic='100',coordinator='other-owner',integration_branch='codex/worker-a',integration_worktree=str(self.a))
        with self.assertRaisesRegex(engine.Refusal,'owned by worker'):
            self.call('init',plan=self.file('worker-coordinator',p),owner='other-owner')
        p.update(integration_branch='codex/worker-c',integration_worktree=str(self.c))
        self.call('init',plan=self.file('other-run',p),owner='other-owner')
        with self.assertRaisesRegex(engine.Refusal,'coordinator'):
            self.call('claim',story='b',worker='worker-b',branch='codex/worker-c',worktree=self.c)

    def test_spoofed_parallel_marker_does_not_hide_legacy_owner(self):
        self.write(self.c,'_bmad-output/auto-bmad/state/epic/epic-99.yaml','status: running\nepic_num: 99\nparallel_run_id: pilot\n')
        self.assertFalse(self.call('plan')['ready'])
        self.init(); self.assertFalse(self.call('status')['admission']['ready'])

    def test_coordinator_anchor_inherited_by_clean_worker_is_not_legacy_owner(self):
        self.init()
        self.write(self.repo,'_bmad-output/auto-bmad/state/epic/epic-99.yaml','status: running\nepic_num: 99\nparallel_run_id: pilot\n')
        head=self.commit(self.repo,'coordinator anchor')
        self.git(self.a,'merge','--ff-only',head)
        result=self.claim('a'); self.assertEqual(result['base_sha'],head)
        self.call('heartbeat',story='a',worker='worker-a')
        self.assertEqual(self.call('status')['claims'][0]['state'],'running')

    def test_state_bearing_worker_results_do_not_block_sibling_integration(self):
        for s in self.plan['stories']:
            s['write_paths'].append('_bmad-output/auto-bmad/state/'+s['id']+'.yaml')
        self.init(); self.claim('a'); self.claim('b')
        evidence={}
        for id in ['a','b']:
            self.write(getattr(self,id),'_bmad-output/auto-bmad/state/'+id+'.yaml','status: review\nepic_num: 99\nstory_id: '+id+'\nparallel_run_id: pilot\n')
            evidence[id]=self.evidence(id); self.submit(id,evidence[id])
        self.merge('a'); self.verify('a')
        self.assertFalse(self.call('status')['admission']['legacy_conflicts'])
        self.merge('b'); self.verify('b')
        head=engine.sha(self.repo,'HEAD')
        self.assertEqual(self.call('finalize',evidence=self.file('state-final',self.combined(head,True)))['state'],'finalized')

    def test_required_database_check_needs_required_environment(self):
        self.init(); self.claim('a'); e=self.evidence('a'); e['checks'].append(self.check(e['result_sha'],'integration'))
        with self.assertRaisesRegex(engine.Refusal,'SUPABASE_TEST_REQUIRED'): self.submit('a',e)
        e['checks'][-1]['environment']={'SUPABASE_TEST_REQUIRED':'1'}; self.submit('a',e)

    def test_stale_heartbeat_does_not_steal_and_capacity(self):
        self.init(); self.claim('a'); self.claim('b')
        with engine.database(self.repo) as db: db.execute('UPDATE claims SET heartbeat=0 WHERE story=?',('a',))
        self.assertTrue(self.call('status')['claims'][0]['stale'])
        with self.assertRaisesRegex(engine.Refusal,'not ready'): self.claim('a',self.c,'replacement')
        with self.assertRaisesRegex(engine.Refusal,'generation'): self.call('heartbeat',story='a',worker='worker-a',generation=2)
        self.call('block',story='a',worker='worker-a',reason='Still owned')
        self.assertEqual(len(self.call('status')['claims']),2)

    def test_duplicate_coordinator_and_worktree_admission(self):
        self.init()
        p=copy.deepcopy(self.plan); p['run_id']='another'; p['coordinator']='another-owner'
        with self.assertRaisesRegex(engine.Refusal,'already owned'): self.call('init',plan=self.file('another',p),owner='another-owner')
        with self.assertRaisesRegex(engine.Refusal,'coordinator'): self.call('claim',story='a',worker='worker-a',branch='codex/integration',worktree=self.repo)

    def test_combined_checks_exact_merge_sha_and_previous_verification(self):
        self.init(); self.claim('a'); self.claim('b'); ea=self.evidence('a'); self.submit('a',ea); self.submit('b',self.evidence('b')); self.merge('a')
        with self.assertRaisesRegex(engine.Refusal,'previous integration'): self.merge('b')
        with self.assertRaisesRegex(engine.Refusal,'mismatch'): self.call('verify',story='a',evidence=self.file('stale-combined',self.combined(ea['result_sha'])))
        self.verify('a'); self.merge('b'); self.verify('b')

    def test_legacy_anchor_and_manual_maintenance_reservation(self):
        self.write(self.c,'_bmad-output/auto-bmad/state/epic/epic-99.yaml','status: running\nepic_num: 99\nactive_story: a\n')
        self.assertFalse(self.call('plan')['ready'])
        self.init()
        with self.assertRaisesRegex(engine.Refusal,'not ready'): self.claim('a')
        anchor=self.c/'_bmad-output/auto-bmad/state/epic/epic-99.yaml'; anchor.unlink()
        p=copy.deepcopy(self.plan); p['legacy_reservations']=[{'epic':'13','stories':[],'reason':'Maintenance current session','worktree':str(self.c),'write_paths':['src/a/'],'conflict_domains':[]}]
        result=self.call('plan',plan=self.file('reserved',p)); self.assertEqual(result['ready'],['b'])

    def test_workflow_upgrade_rejected(self):
        self.init(); self.claim('a')
        self.write(self.a,'.agents/skills/auto-bmad/SKILL.md','Changed workflow\n')
        with self.assertRaisesRegex(engine.Refusal,'workflow changed'): self.call('heartbeat',story='a',worker='worker-a')

    def test_migration_reservations_and_unsupported_mode(self):
        p=copy.deepcopy(self.plan); p['stories'][0]['write_paths'].append('supabase/migrations/')
        with self.assertRaisesRegex(engine.Refusal,'schema:migrations'): engine.validate_plan(self.repo,p)
        p['stories'][0]['conflict_domains']=['schema:migrations']; engine.validate_plan(self.repo,p)
        p['story_source']='stories'
        with self.assertRaisesRegex(engine.Refusal,'Only explicit sprint'): engine.validate_plan(self.repo,p)

    def test_evidence_argv_is_data_never_executed(self):
        self.init(); self.claim('a'); e=self.evidence('a'); target=self.root/'must-not-exist'
        e['checks'][0]['argv']=[sys.executable,'-c','open('+repr(str(target))+', "w").write("bad")']
        self.submit('a',e); self.assertFalse(target.exists())

    def test_json_duplicate_keys_rejected(self):
        path=self.root/'duplicate.json'; path.write_text('{"schema_version":1,"schema_version":2}',encoding='utf-8')
        with self.assertRaisesRegex(engine.Refusal,'Duplicate JSON'): engine.read_json(path)

    def test_custom_bmad_output_configuration_refused(self):
        self.write(self.repo,'_bmad/bmm/config.yaml','output_folder: "{project-root}/custom-output"\n')
        with self.assertRaisesRegex(engine.Refusal,'Custom output_folder'): self.call('plan')
        self.write(self.repo,'_bmad/bmm/config.yaml','output_folder: "{project-root}/_bmad-output"\nimplementation_artifacts: custom-impl\n')
        with self.assertRaisesRegex(engine.Refusal,'Custom implementation_artifacts'): self.call('plan')

    def test_mirrored_engine_and_test(self):
        root=SCRIPT.parents[4]
        mirror=root/'.claude/skills/auto-bmad/scripts/parallel_run.py'
        self.assertEqual(SCRIPT.read_bytes(),mirror.read_bytes())
        mirror_test=mirror.parent/'tests/test_parallel_run.py'
        self.assertEqual(Path(__file__).read_bytes(),mirror_test.read_bytes())

if __name__=='__main__': unittest.main()
