#!/usr/bin/env python3
"""Opt-in one-host/shared-repository sprint coordinator; no shell evidence execution."""
import argparse
import contextlib
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sqlite3
import subprocess
import sys
import time

VERSION = 1
MODEL = 'gpt-6.1-sol'
SENSITIVE = {'tenant-isolation','tenancy','provisioning','rbac','permissions','authentication','authorization','security','rls','secrets','public-tokens','money-tax','transactional-integrity','critical-conflict'}
WORKFLOW_PATHS = ['.agents/skills/auto-bmad/', '.claude/skills/auto-bmad/', '_bmad/custom/', '_bmad-output/auto-bmad/config.yaml', '_bmad/bmm/config.yaml', '_bmad/core/config.yaml', '.codex/config.toml', '.claude/settings.json']
AGGREGATE = ['_bmad-output/auto-bmad/state/epic/', '_bmad-output/auto-bmad/reports/epic-', '_bmad-output/implementation-artifacts/sprint-status.yaml', '_bmad-output/implementation-artifacts/deferred-work.md', '_bmad-output/implementation-artifacts/deferred-work-resolved.md', '_bmad-output/auto-bmad/deferred/', '_bmad-output/deferred/', 'docs/deferred/'] + WORKFLOW_PATHS

def workflow_version(repo,ref=None):
    paths = git(repo,'ls-tree','-r','--name-only',ref,'--',*WORKFLOW_PATHS).splitlines() if ref else git(repo,'ls-files','--',*WORKFLOW_PATHS).splitlines()
    require(paths,'No tracked Auto-BMAD workflow to pin')
    hashes=[]
    for path in sorted(paths):
        if ref:
            data=subprocess.run(['git','-C',str(repo),'show',ref+':'+path],capture_output=True,timeout=30)
            require(data.returncode==0,'Cannot read pinned workflow: '+path)
            content=data.stdout
        else:
            content=(Path(repo)/path).read_bytes()
        hashes.append([path,hashlib.sha256(content.replace(b'\r\n',b'\n')).hexdigest()])
    return digest(hashes)

class Refusal(Exception):
    pass

def require(condition, message):
    if not condition:
        raise Refusal(message)

def keys(value, required, optional=()):
    require(isinstance(value, dict), 'Expected JSON object')
    require(set(required) <= set(value), 'Missing fields: ' + ', '.join(sorted(set(required)-set(value))))
    require(set(value) <= set(required)|set(optional), 'Unknown fields: ' + ', '.join(sorted(set(value)-set(required)-set(optional))))

def strings(value, label):
    require(isinstance(value, list) and all(isinstance(x,str) and x.strip() for x in value), label+' must be an array of nonempty strings')
    require(len(value)==len(set(value)), label+' contains duplicates')
    return value

def read_json(path):
    def unique(pairs):
        out = {}
        for k,v in pairs:
            require(k not in out, 'Duplicate JSON key: '+k)
            out[k] = v
        return out
    return json.loads(Path(path).read_text(encoding='utf-8-sig'), object_pairs_hook=unique)

def canonical(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'))

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def git(repo,*args,check=True):
    proc = subprocess.run(['git','-C',str(repo),*args],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120)
    if check:
        require(proc.returncode==0,'Git operation failed: '+ ' '.join(args[:2]) + ': '+proc.stderr.strip())
    return proc.stdout.strip() if check else proc

def common(repo):
    return Path(git(repo,'rev-parse','--path-format=absolute','--git-common-dir')).resolve()

def top(repo):
    return Path(git(repo,'rev-parse','--show-toplevel')).resolve()

def sha(repo,ref):
    require(isinstance(ref,str) and not ref.startswith('-') and ref.strip(), 'Invalid Git ref')
    result = git(repo,'rev-parse','--verify',ref+'^{commit}')
    require(re.fullmatch('[0-9a-f]{40,64}',result) is not None, 'Invalid resolved commit')
    return result

def ancestor(repo,old,new):
    return git(repo,'merge-base','--is-ancestor',old,new,check=False).returncode == 0

def clean(repo):
    require(not git(repo,'status','--porcelain'), 'Worktree must be completely clean: '+str(repo))
    require(not (Path(git(repo,'rev-parse','--absolute-git-dir'))/'MERGE_HEAD').exists(),'Unfinished Git merge')

def branch(repo):
    return git(repo,'symbolic-ref','--quiet','--short','HEAD')

def path_token(token):
    # Brackets are literal filename characters (for example Next.js route segments).
    # Ownership comparisons below use equality/prefix checks, never glob matching.
    require(isinstance(token,str) and token and '\\' not in token and not any(c in token for c in '*?\n\r\x00'), 'Paths must be exact relative POSIX paths or trailing-slash prefixes')
    p = PurePosixPath(token)
    require(not p.is_absolute() and '..' not in p.parts and '.' not in p.parts and ':' not in token and p.parts[0] != '.git','Unsafe path: '+token)
    require(str(p)+( '/' if token.endswith('/') else '')==token,'Noncanonical path: '+token)
    return token

def covers(token,path):
    token,path=token.casefold(),path.casefold()
    return path.startswith(token) if token.endswith('/') or token.endswith('epic-') else path==token

def overlap(a,b):
    a,b=a.casefold(),b.casefold()
    return covers(a,b.rstrip('/')) or covers(b,a.rstrip('/')) or (a.endswith('/') and b.startswith(a)) or (b.endswith('/') and a.startswith(b))

def worktrees(repo):
    raw = git(repo,'worktree','list','--porcelain','-z')
    return [Path(x[9:]).resolve() for x in raw.split('\x00') if x.startswith('worktree ')]

def scalar(text,key):
    match = re.search(r'^'+re.escape(key)+r':[ \t]*(.*?)[ \t]*$',text,re.M)
    value=match.group(1).strip().strip('\"\'') if match else None
    return None if value in {None,'','null','Null','NULL','~'} else value

def registered_parallel_anchor(repo,p,wt,anchor,target):
    store=common(repo)/'auto-bmad-parallel.sqlite3'
    if not store.is_file(): return False
    with contextlib.closing(sqlite3.connect(store)) as conn:
        run=conn.execute('SELECT plan FROM runs WHERE run=?',(p['run_id'],)).fetchone()
        if not run: return False
        stored=json.loads(run[0])
        if anchor.parent.name=='epic':
            if str(scalar(anchor.read_text(encoding='utf-8-sig'),'epic_num') or anchor.stem.removeprefix('epic-'))!=str(stored['epic']): return False
            if Path(stored['integration_worktree']).resolve()==wt: return True
            # Clean worker worktrees inherit the coordinator's committed anchor.
            # It conveys no ownership there: accept only its exact immutable base blob.
            claim=next((row for row in conn.execute('SELECT worktree,base_sha FROM claims WHERE run=?',(p['run_id'],)) if Path(row[0]).resolve()==wt),None)
            base=claim[1] if claim else sha(stored['integration_worktree'],'HEAD')
            if not claim and sha(wt,'HEAD')!=base: return False
            relative=anchor.relative_to(wt).as_posix()
            blob=subprocess.run(['git','-C',str(wt),'show',base+':'+relative],capture_output=True,timeout=30)
            return blob.returncode==0 and blob.stdout.replace(b'\r\n',b'\n')==anchor.read_bytes().replace(b'\r\n',b'\n') and scalar(blob.stdout.decode('utf-8-sig'),'parallel_run_id')==p['run_id']
        relative=anchor.relative_to(wt).as_posix()
        for row in conn.execute('SELECT worktree,story,base_sha,result_sha FROM claims WHERE run=?',(p['run_id'],)):
            if not (target==row[1] or anchor.stem.startswith(row[1]+'-')): continue
            contract=story(stored,row[1])
            if not any(covers(token,relative) for token in contract['write_paths']): continue
            if Path(row[0]).resolve()==wt: return True
            if not row[3]: continue
            # A merged worker's state remains an owned artifact in the coordinator.
            # The claim/store, rather than its review/done text, grants that identity.
            if Path(stored['integration_worktree']).resolve()==wt:
                if ancestor(repo,row[3],sha(wt,'HEAD')): return True
                continue
            own=next((x for x in conn.execute('SELECT worktree,base_sha FROM claims WHERE run=?',(p['run_id'],)) if Path(x[0]).resolve()==wt),None)
            base=own[1] if own else sha(stored['integration_worktree'],'HEAD')
            if not own and sha(wt,'HEAD')!=base: continue
            if not ancestor(repo,row[3],base): continue
            blob=subprocess.run(['git','-C',str(wt),'show',base+':'+relative],capture_output=True,timeout=30)
            if blob.returncode==0 and blob.stdout.replace(b'\r\n',b'\n')==anchor.read_bytes().replace(b'\r\n',b'\n'): return True
        return False

def legacy_conflicts(repo,plan,s=None):
    collisions = []
    ids = {s['id']} if s else {x['id'] for x in plan['stories']}
    for reservation in plan['legacy_reservations']:
        targets=[s] if s else plan['stories']
        if str(reservation['epic'])==str(plan['epic']) or ids.intersection(reservation['stories']) or any(conflicts(x,reservation) for x in targets):
            collisions.append({'source':'reservation','path':reservation['worktree'],'reason':reservation['reason']})
    for wt in worktrees(repo):
        require(wt.is_dir(),'Registered worktree missing; cannot scan legacy ownership: '+str(wt))
        state = wt/'_bmad-output'/'auto-bmad'/'state'
        for anchor in list(state.glob('*.yaml'))+list((state/'epic').glob('*.yaml')):
            text = anchor.read_text(encoding='utf-8-sig')
            if scalar(text,'status') in {'done','completed','abandoned'}:
                continue
            epic = scalar(text,'epic_num') or scalar(text,'epic')
            if anchor.parent.name=='epic' and epic is None:
                epic = anchor.stem.removeprefix('epic-')
            target = scalar(text,'story_id') or scalar(text,'active_story') or anchor.stem
            # This coordinator's worker state files are recognized by explicit run identity.
            if scalar(text,'parallel_run_id')==plan['run_id'] and registered_parallel_anchor(repo,plan,wt,anchor,target):
                continue
            if str(epic)==str(plan['epic']) or target in ids or any(anchor.stem.startswith(x+'-') for x in ids):
                collisions.append({'source':'legacy-anchor','path':str(anchor),'reason':'In-flight legacy ownership'})
    return collisions

def validate_plan(repo,p):
    keys(p,['schema_version','story_source','run_id','epic','coordinator','integration_branch','integration_worktree','base_sha','workflow_version','max_workers','stories','integrated_prerequisites','legacy_reservations','shared_paths','final_required_checks'])
    require(p['schema_version']==VERSION and type(p['schema_version']) is int,'Unsupported plan schema')
    require(p['story_source']=='sprint','Only explicit sprint story plans are supported; stories/cross-host/clones are unsupported')
    for field in ['run_id','epic','coordinator','integration_branch','integration_worktree','base_sha','workflow_version']:
        require(isinstance(p[field],str) and p[field].strip(),field+' must be a nonempty string')
    require(type(p['max_workers']) is int and 1 <= p['max_workers'] <= 2,'max_workers must be 1 or 2')
    require(p['integration_branch'].startswith('codex/'),'Integration branch must use codex/')
    require(isinstance(p['stories'],list) and p['stories'],'stories must be nonempty')
    require(isinstance(p['integrated_prerequisites'],list) and isinstance(p['legacy_reservations'],list),'Prerequisites and reservations must be arrays')
    for token in strings(p['shared_paths'],'shared_paths'): path_token(token)
    require(strings(p['final_required_checks'],'final_required_checks'),'Final epic gate check names required')
    ids = set()
    for s in p['stories']:
        keys(s,['id','approved','spec_path','spec_revision','prerequisites','write_paths','conflict_domains','contracts','requires_contracts','risk_domains','required_checks'])
        require(isinstance(s['id'],str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*',s['id']) and s['id'] not in ids,'Invalid/duplicate story ID')
        ids.add(s['id'])
        require(s['approved'] is True,'Unapproved story: '+s['id'])
        path_token(s['spec_path'])
        require(not s['spec_path'].endswith('/'),'spec_path must be a file')
        require(isinstance(s['spec_revision'],str) and re.fullmatch('[0-9a-f]{64}',s['spec_revision']),'spec_revision must be SHA256')
        for field in ['prerequisites','write_paths','conflict_domains','contracts','risk_domains','required_checks']: strings(s[field],field)
        require(s['write_paths'] and s['required_checks'],'Ownership and required checks cannot be empty')
        for token in s['write_paths']:
            path_token(token)
            require(not any(overlap(token,x) for x in AGGREGATE+p['shared_paths']),'Worker ownership includes aggregate/shared state: '+token)
        if any(overlap(x,'supabase/migrations/') for x in s['write_paths']):
            require('schema:migrations' in s['conflict_domains'],'Migration ownership requires schema:migrations conflict domain; migrations are serialized')
        require(set(s['risk_domains']) <= SENSITIVE|{'ordinary'},'Unknown risk domain')
        require(isinstance(s['requires_contracts'],list),'requires_contracts must be an array')
        for c in s['requires_contracts']:
            keys(c,['story','contract'])
            require(c['story'] in s['prerequisites'] and isinstance(c['contract'],str),'Required contract must name a prerequisite')
    external = {}
    for e in p['integrated_prerequisites']:
        keys(e,['id','commit','checks_passed','contracts'])
        require(isinstance(e['id'],str) and e['id'] not in external and e['id'] not in ids,'Duplicate prerequisite ID')
        require(e['checks_passed'] is True,'Prerequisite has no passing gates')
        require(sha(repo,e['commit'])==e['commit'],'Prerequisite commit must be exact SHA')
        strings(e['contracts'],'contracts'); external[e['id']]=e
    byid = {s['id']:s for s in p['stories']}
    def visit(id,stack,seen):
        require(id not in stack,'Dependency cycle: '+id)
        if id in seen: return
        for dep in byid[id]['prerequisites']:
            require(dep in byid or dep in external,'Unknown prerequisite: '+dep)
            if dep in byid: visit(dep,stack|{id},seen)
        seen.add(id)
    seen = set()
    for id in byid: visit(id,set(),seen)
    for s in p['stories']:
        for c in s['requires_contracts']:
            require(c['contract'] in (byid.get(c['story']) or external[c['story']])['contracts'],'Missing prerequisite contract: '+c['contract'])
    for r in p['legacy_reservations']:
        keys(r,['epic','stories','reason','worktree','write_paths','conflict_domains']); strings(r['stories'],'reservation stories')
        require(all(isinstance(r[x],str) and r[x] for x in ['epic','reason','worktree']),'Incomplete legacy reservation')
        for token in strings(r['write_paths'],'reservation paths'): path_token(token)
        strings(r['conflict_domains'],'reservation domains')
        require(Path(r['worktree']).resolve() in worktrees(repo),'Legacy reservation worktree is not registered')
    require(sha(repo,p['base_sha'])==p['base_sha'],'base_sha must be exact commit SHA')
    require(workflow_version(repo,p['base_sha'])==p['workflow_version'],'workflow_version does not match committed base workflow')
    integration = Path(p['integration_worktree']).resolve()
    require(integration in worktrees(repo) and common(integration)==common(repo),'Integration worktree must be registered in the same repository')
    require(branch(integration)==p['integration_branch'],'Integration worktree branch mismatch')
    require(ancestor(repo,p['base_sha'],sha(integration,'HEAD')),'Plan base is not integration ancestor')
    for config_path in ['_bmad-output/auto-bmad/config.yaml','_bmad/bmm/config.yaml','_bmad/core/config.yaml']:
        configuration=integration/config_path
        if configuration.is_file():
            config=configuration.read_text(encoding='utf-8-sig')
            for field,expected in [('output_folder','_bmad-output'),('implementation_artifacts','_bmad-output/implementation-artifacts'),('planning_artifacts','_bmad-output/planning-artifacts')]:
                value=scalar(config,field)
                require(value is None or value in {expected,'{project-root}/'+expected},'Custom '+field+' is unsupported by parallel v1')
    for s in p['stories']:
        blob = subprocess.run(['git','-C',str(repo),'show',p['base_sha']+':'+s['spec_path']],capture_output=True,timeout=30)
        require(blob.returncode==0 and hashlib.sha256(blob.stdout.replace(b'\r\n',b'\n')).hexdigest()==s['spec_revision'],'Approved spec revision mismatch: '+s['id'])
    return p

def conflicts(a,b):
    return bool({x.casefold() for x in a['conflict_domains']} & {x.casefold() for x in b['conflict_domains']}) or any(overlap(x,y) for x in a['write_paths'] for y in b['write_paths'])

def report(repo,p,claims=None):
    head = sha(p['integration_worktree'],'HEAD')
    claims = claims or {}
    ready,blocked = [],{}
    external = {x['id']:x for x in p['integrated_prerequisites']}
    collisions=[]
    for s in p['stories']:
        reasons=[]
        legacy=legacy_conflicts(repo,p,s); collisions.extend(legacy)
        if legacy: reasons.append('legacy ownership collision')
        if s['id'] in claims: reasons.append('already claimed: '+claims[s['id']]['state'])
        for dep in s['prerequisites']:
            e = external.get(dep) or claims.get(dep)
            commit = e.get('commit') if dep in external else e.get('integration_sha') if e and e['state']=='integrated' else None
            if not commit or not ancestor(repo,commit,head): reasons.append('prerequisite not verified integration ancestor: '+dep)
        if reasons: blocked[s['id']]=reasons
        else: ready.append(s['id'])
    stories = {s['id']:s for s in p['stories']}
    pairs = [[a,b] for i,a in enumerate(ready) for b in ready[i+1:] if not conflicts(stories[a],stories[b])]
    return {'schema_version':VERSION,'run_id':p['run_id'],'integration_head':head,'ready':ready,'ready_pairs':pairs,'blocked':blocked,'legacy_conflicts':collisions}

SCHEMA = '''
CREATE TABLE IF NOT EXISTS runs(run TEXT PRIMARY KEY, epic TEXT NOT NULL, owner TEXT NOT NULL, plan TEXT NOT NULL, plan_hash TEXT NOT NULL, state TEXT NOT NULL, final_sha TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS active_epic ON runs(epic) WHERE state != 'finalized';
CREATE TABLE IF NOT EXISTS claims(run TEXT NOT NULL, story TEXT NOT NULL, worker TEXT NOT NULL, generation INTEGER NOT NULL, branch TEXT NOT NULL, worktree TEXT NOT NULL, base_sha TEXT NOT NULL, heartbeat REAL NOT NULL, state TEXT NOT NULL, evidence TEXT, result_sha TEXT, integration_sha TEXT, block_reason TEXT, PRIMARY KEY(run,story));
CREATE UNIQUE INDEX IF NOT EXISTS occupied_worktree ON claims(worktree) WHERE state != 'integrated';
CREATE UNIQUE INDEX IF NOT EXISTS occupied_branch ON claims(branch) WHERE state != 'integrated';
CREATE TABLE IF NOT EXISTS journal(run TEXT NOT NULL, story TEXT NOT NULL, before_sha TEXT NOT NULL, result_sha TEXT NOT NULL, after_sha TEXT, state TEXT NOT NULL, PRIMARY KEY(run,story));
CREATE TABLE IF NOT EXISTS verifications(run TEXT NOT NULL, story TEXT NOT NULL, sha TEXT NOT NULL, evidence TEXT NOT NULL, PRIMARY KEY(run,story));
'''

@contextlib.contextmanager
def database(repo):
    path=common(repo)/'auto-bmad-parallel.sqlite3'
    conn=sqlite3.connect(path,timeout=30,isolation_level=None)
    conn.row_factory=sqlite3.Row
    try:
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executescript(SCHEMA)
        conn.execute('BEGIN IMMEDIATE')
        yield conn
        conn.execute('COMMIT')
    except Exception:
        if conn.in_transaction: conn.execute('ROLLBACK')
        raise
    finally: conn.close()

def rows(db,run):
    return {r['story']:dict(r) for r in db.execute('SELECT * FROM claims WHERE run=?',(run,))}

def get_run(db,a):
    row=db.execute('SELECT * FROM runs WHERE run=?',(a.run,)).fetchone()
    require(row is not None,'Unknown run')
    require(row['owner']==a.owner,'Exact coordinator owner required')
    require(row['state']!='finalized' or a.command=='status','Run already finalized')
    p=json.loads(row['plan'])
    require(digest(p)==row['plan_hash'],'Stored plan integrity failure')
    require(workflow_version(p['integration_worktree'])==p['workflow_version'],'Integration workflow changed since run admission')
    return p

def get_claim(db,a,worker=False):
    row=db.execute('SELECT * FROM claims WHERE run=? AND story=?',(a.run,a.story)).fetchone()
    require(row is not None,'Unknown claim')
    c=dict(row)
    if worker:
        require(c['worker']==a.worker and c['generation']==a.generation,'Stale generation or wrong worker')
    require(Path(c['worktree']).resolve() in worktrees(a.repo) and common(c['worktree'])==common(a.repo),'Worker repository/worktree identity changed')
    require(branch(c['worktree'])==c['branch'],'Worker branch identity changed')
    return c

def story(p,id):
    found=next((s for s in p['stories'] if s['id']==id),None)
    require(found is not None,'Unknown story')
    return found

def assignment(p,c):
    return {'schema_version':VERSION,'run_id':p['run_id'],'epic':p['epic'],'owner':p['coordinator'],'repo':p['integration_worktree'],'story':story(p,c['story']),'worker':c['worker'],'generation':c['generation'],'branch':c['branch'],'worktree':c['worktree'],'base_sha':c['base_sha'],'workflow_version':p['workflow_version'],'state':c['state'],'model':MODEL,'required_effort':'high' if set(story(p,c['story'])['risk_domains']) & SENSITIVE else 'low','worker_phases':['test','build','independent-review','review-fix'],'forbidden_phases':['epic-reconciliation','epic-finalization','publish-pr','merge-base']}

def changed(repo,base,result):
    return sorted(set(x for x in git(repo,'diff','--name-only','-z','--no-renames',base,result,'--').split('\x00') if x))

def validate_diff(repo,p,c,base,result,repair=False):
    paths=changed(repo,base,result)
    tokens=story(p,c['story'])['write_paths']+(p['shared_paths'] if repair else [])
    require(paths and all(any(covers(token,path) for token in tokens) for path in paths),'Changed paths outside assigned ownership')
    if not repair:
        require(not any(covers(token,path) for token in AGGREGATE+p['shared_paths'] for path in paths),'Worker modified aggregate/shared state')
    for commit in [base,result]:
        tree=git(repo,'ls-tree','-r','-z',commit,'--',*paths)
        require(not any(x.startswith('120000 ') or x.startswith('160000 ') for x in tree.split('\x00')),'Symlink/submodule changes are unsupported')
    return paths

def checks(e,required,commit):
    require(isinstance(e,list),'checks must be an array')
    names=[]
    for check in e:
        keys(check,['name','argv','result','executed','skipped','commit'],['environment'])
        require(check['commit']==commit and check['result']=='passed','Check failed or evidence commit mismatch')
        require(type(check['executed']) is int and check['executed']>0 and type(check['skipped']) is int and check['skipped']==0,'Required checks must execute with zero skips')
        require(isinstance(check['argv'],list) and check['argv'] and all(isinstance(x,str) and x for x in check['argv']),'Check argv must be nonempty string array')
        require(isinstance(check['name'],str),'Invalid check name'); names.append(check['name'])
        if 'environment' in check: require(isinstance(check['environment'],dict),'Check environment must be data object')
        if re.search(r'(^|[-_:])(rls|integration|database|db)([-_:]|$)',check['name'],re.I):
            require(check.get('environment',{}).get('SUPABASE_TEST_REQUIRED')=='1','Required database/RLS check needs SUPABASE_TEST_REQUIRED=1 evidence')
    require(len(names)==len(set(names)) and set(required)<=set(names),'Missing or duplicate required checks')

def review(e,commit,worker,domains):
    keys(e,['approved','reviewer','commit','model','effort','unresolved'])
    require(e['approved'] is True and isinstance(e['reviewer'],str) and e['reviewer'].strip() and e['reviewer']!=worker and e['commit']==commit and e['unresolved']==[],'Independent review is incomplete, stale or has unresolved findings')
    require(e['model']==MODEL and e['effort'] in {'low','medium','high'},'Invalid review model/effort')
    require(not set(domains)&SENSITIVE or e['effort']=='high','Sensitive review requires high effort')

def validate_evidence(repo,p,c,e):
    keys(e,['schema_version','run_id','story_id','worker','generation','base_sha','result_sha','workflow_version','spec_revision','changed_paths','checks','review','routes'])
    s=story(p,c['story'])
    require(workflow_version(c['worktree'])==p['workflow_version'],'Worker workflow changed since assignment')
    require(e['schema_version']==VERSION and type(e['schema_version']) is int and type(e['generation']) is int,'Unsupported evidence schema/generation')
    for field,expected in [('run_id',p['run_id']),('story_id',c['story']),('worker',c['worker']),('generation',c['generation']),('base_sha',c['base_sha']),('workflow_version',p['workflow_version']),('spec_revision',s['spec_revision'])]: require(e[field]==expected,'Evidence '+field+' mismatch')
    result=sha(repo,e['result_sha']); require(result==e['result_sha'],'Result requires exact commit SHA')
    require(sha(c['worktree'],'HEAD')==result and sha(repo,c['branch'])==result,'Result is not exact worker branch HEAD')
    require(ancestor(repo,c['base_sha'],result) and result!=c['base_sha'],'Result is not committed work atop assignment base')
    paths=validate_diff(repo,p,c,c['base_sha'],result)
    require(e['changed_paths']==paths,'Evidence changed_paths do not match Git diff')
    require(paths and all(any(covers(token,path) for token in s['write_paths']) for path in paths),'Worker changed paths outside assigned ownership')
    require(not any(covers(token,path) for token in AGGREGATE+p['shared_paths'] for path in paths),'Worker modified aggregate/shared state')
    checks(e['checks'],s['required_checks'],result)
    review(e['review'],result,c['worker'],s['risk_domains'])
    require(isinstance(e['routes'],list) and e['routes'],'Missing recorded routes')
    require(any(isinstance(r,dict) and r.get('phase')=='build' for r in e['routes']),'Missing build routing decision')
    for r in e['routes']:
        keys(r,['phase','model','effort','risk_domains','reason'])
        require(isinstance(r['phase'],str) and r['phase'] and r['model']==MODEL and r['effort'] in {'low','medium','high'} and isinstance(r['reason'],str) and r['reason'],'Invalid route')
        strings(r['risk_domains'],'route risk_domains')
        require(set(s['risk_domains']) <= set(r['risk_domains']) and set(r['risk_domains']) <= SENSITIVE|{'ordinary'},'Risk domains omitted or unknown')
        require(not set(r['risk_domains'])&SENSITIVE or r['effort']=='high','Sensitive route requires high effort')
    return result

def combined_evidence(p,c,e,head,final=False):
    keys(e,['schema_version','run_id','integration_sha','checks','review','unresolved'])
    require(e['schema_version']==VERSION and type(e['schema_version']) is int and e['run_id']==p['run_id'] and e['integration_sha']==head and e['unresolved']==[],'Combined evidence identity mismatch or unresolved findings')
    required=sorted({x for s in p['stories'] for x in s['required_checks']}|set(p['final_required_checks'])) if final else story(p,c['story'])['required_checks']
    domains=sorted({x for s in p['stories'] for x in s['risk_domains']}) if final else story(p,c['story'])['risk_domains']
    checks(e['checks'],required,head)
    review(e['review'],head,p['coordinator'],domains)

def integrate(a):
    # Journal admission commits before Git mutation, which cannot join a SQLite transaction.
    with database(a.repo) as db:
        p=get_run(db,a); c=get_claim(db,a); target=p['integration_worktree']
        require(not legacy_conflicts(a.repo,p,story(p,a.story)),'Legacy ownership appeared during run')
        clean(target); clean(c['worktree'])
        require(branch(target)==p['integration_branch'],'Integration branch identity changed')
        journal=db.execute('SELECT * FROM journal WHERE run=? AND story=?',(a.run,a.story)).fetchone()
        head=sha(target,'HEAD')
        require(not db.execute("SELECT 1 FROM journal WHERE run=? AND story!=? AND state='prepared'",(a.run,a.story)).fetchone(),'Another integration requires recovery')
        if journal:
            j=dict(journal)
            require(c['result_sha']==j['result_sha'],'Integration result changed')
            if j['state']=='merged':
                require(head==j['after_sha'],'Integration HEAD changed since journal completion')
                return {'state':c['state'],'integration_sha':head,'recovered':True}
            parents=git(target,'rev-list','--parents','-n','1',head).split()[1:]
            if parents==[j['before_sha'],j['result_sha']]:
                validate_diff(a.repo,p,c,j['before_sha'],head)
                db.execute("UPDATE journal SET after_sha=?,state='merged' WHERE run=? AND story=?",(head,a.run,a.story))
                db.execute("UPDATE claims SET integration_sha=?,state='awaiting-verification' WHERE run=? AND story=?",(head,a.run,a.story))
                return {'state':'awaiting-verification','integration_sha':head,'recovered':True}
            require(head==j['before_sha'],'Uncertain integration: HEAD differs from journal; inspect without resetting')
            before=j['before_sha']; result=j['result_sha']
        else:
            require(c['state']=='ready-for-integration','Worker result not ready')
            require(a.expected_head==head,'Integration HEAD changed; refresh expected-head')
            require(not db.execute("SELECT 1 FROM claims WHERE run=? AND state='awaiting-verification'",(a.run,)).fetchone(),'Verify previous integration before merging another result')
            validate_evidence(a.repo,p,c,json.loads(c['evidence']))
            before=head; result=c['result_sha']
            db.execute('INSERT INTO journal VALUES(?,?,?,?,NULL,?)',(a.run,a.story,before,result,'prepared'))
            db.execute("UPDATE claims SET state='integrating' WHERE run=? AND story=?",(a.run,a.story))
    with database(a.repo) as db:
        p=get_run(db,a); c=get_claim(db,a); target=p['integration_worktree']
        require(sha(target,'HEAD')==before,'Integration HEAD changed before merge')
        clean(target); clean(c['worktree'])
        validate_evidence(a.repo,p,c,json.loads(c['evidence']))
        require(branch(target)==p['integration_branch'],'Integration branch changed')
        proc=git(target,'merge','--no-ff','--no-edit','-m','Auto-BMAD '+a.run+' '+a.story,result,check=False)
        require(proc.returncode==0,'Integration merge failed; journal retained, resolve/abort explicitly: '+proc.stderr.strip())
        head=sha(target,'HEAD')
        require(git(target,'rev-list','--parents','-n','1',head).split()[1:]==[before,result],'Unexpected merge shape')
        validate_diff(a.repo,p,c,before,head)
        integration_checkpoint()
        db.execute("UPDATE journal SET after_sha=?,state='merged' WHERE run=? AND story=?",(head,a.run,a.story))
        db.execute("UPDATE claims SET integration_sha=?,state='awaiting-verification' WHERE run=? AND story=?",(head,a.run,a.story))
        return {'state':'awaiting-verification','integration_sha':head,'recovered':False}

def integration_checkpoint():
    """No-op, patched only by synthetic tests to simulate commit-before-journal crash."""

def execute(a):
    a.repo=str(top(a.repo))
    if a.command=='version': return {'schema_version':VERSION,'workflow_version':workflow_version(a.repo)}
    if a.command=='plan':
        return report(a.repo,validate_plan(a.repo,read_json(a.plan)))
    if a.command=='integrate': return integrate(a)
    with database(a.repo) as db:
        if a.command=='init':
            p=validate_plan(a.repo,read_json(a.plan)); require(a.owner==p['coordinator'],'Plan coordinator mismatch')
            clean(p['integration_worktree']); require(sha(p['integration_worktree'],'HEAD')==p['base_sha'],'Init requires exact plan base HEAD')
            existing=db.execute('SELECT * FROM runs WHERE run=?',(p['run_id'],)).fetchone()
            if existing:
                require(existing['owner']==a.owner and existing['plan_hash']==digest(p),'Run already owned or plan changed')
            else:
                for other in db.execute("SELECT plan FROM runs WHERE state!='finalized'"):
                    other=json.loads(other['plan'])
                    require(other['integration_branch']!=p['integration_branch'] and Path(other['integration_worktree']).resolve()!=Path(p['integration_worktree']).resolve(),'Integration branch/worktree already owned')
                require(not any(Path(x['worktree']).resolve()==Path(p['integration_worktree']).resolve() for x in db.execute("SELECT worktree FROM claims WHERE state!='integrated'")),'Integration worktree already owned by worker')
                db.execute('INSERT INTO runs VALUES(?,?,?,?,?,?,NULL)',(p['run_id'],p['epic'],a.owner,canonical(p),digest(p),'active'))
            return {'run_id':p['run_id'],'state':'active','store':str(common(a.repo)/'auto-bmad-parallel.sqlite3')}
        p=get_run(db,a)
        if a.command=='status':
            claims=rows(db,a.run)
            return {'run_id':a.run,'claims':[{**assignment(p,c),'heartbeat_age_seconds':round(time.time()-c['heartbeat'],2),'stale':time.time()-c['heartbeat']>300,'result_sha':c['result_sha'],'integration_sha':c['integration_sha'],'block_reason':c['block_reason']} for c in claims.values()], 'admission':report(a.repo,p,claims),'journals':[dict(x) for x in db.execute('SELECT * FROM journal WHERE run=?',(a.run,))]}
        require(branch(p['integration_worktree'])==p['integration_branch'],'Integration branch identity changed')
        if a.command=='claim':
            require(a.worker and a.generation==1,'New claims require worker and generation 1; automatic transfers are unsupported')
            s=story(p,a.story); claims=rows(db,a.run)
            admission=report(a.repo,p,claims); require(a.story in admission['ready'],'Story not ready: '+canonical(admission['blocked'].get(a.story,[])))
            all_claims=[dict(x) for x in db.execute("SELECT c.*, r.plan FROM claims c JOIN runs r ON c.run=r.run WHERE c.state!='integrated'")]
            require(sum(x['run']==a.run for x in all_claims)<p['max_workers'],'Worker capacity reached; blocked claims retain ownership')
            require(len(all_claims)<2,'Repository worker capacity reached')
            for other in all_claims:
                require(other['story']!=a.story,'Story already owned across repository')
                require(not conflicts(s,story(json.loads(other['plan']),other['story'])),'Ownership path or semantic conflict')
                require(other['worker']!=a.worker,'Worker already owns an active assignment')
            wt=Path(a.worktree).resolve()
            require(not any(Path(json.loads(r['plan'])['integration_worktree']).resolve()==wt for r in db.execute("SELECT plan FROM runs WHERE state!='finalized'")),'Worker worktree owned by a coordinator')
            require(wt!=Path(p['integration_worktree']).resolve() and wt in worktrees(a.repo),'Worker needs a separate registered worktree')
            require(common(wt)==common(a.repo) and branch(wt)==a.branch,'Worker branch/common-dir mismatch')
            require(a.branch.startswith('codex/') and a.branch!=p['integration_branch'],'Worker requires isolated codex/ branch')
            clean(wt); base=sha(p['integration_worktree'],'HEAD'); require(sha(wt,'HEAD')==base,'Worker must start at exact current integration HEAD')
            for token in s['write_paths']:
                require((wt/token.rstrip('/')).resolve().is_relative_to(wt),'Owned path follows symlink outside worktree')
            require(hashlib.sha256((wt/s['spec_path']).read_bytes().replace(b'\r\n',b'\n')).hexdigest()==s['spec_revision'],'Worker spec drifted from approved revision')
            db.execute('INSERT INTO claims VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL)',(a.run,a.story,a.worker,1,a.branch,str(wt),base,time.time(),'claimed'))
            return assignment(p,get_claim(db,a))
        if a.command in {'heartbeat','block','submit'}:
            c=get_claim(db,a,worker=True)
            require(c['state'] in {'claimed','running','blocked','ready-for-integration'},'Worker cannot mutate after integration starts')
            if a.command=='heartbeat':
                require(workflow_version(c['worktree'])==p['workflow_version'],'Worker workflow changed since assignment')
                require(ancestor(a.repo,c['base_sha'],sha(c['worktree'],'HEAD')),'Worker no longer descends from pinned base')
                state='running' if c['state']=='claimed' else c['state']
                db.execute('UPDATE claims SET heartbeat=?,state=? WHERE run=? AND story=?',(time.time(),state,a.run,a.story))
            elif a.command=='block':
                require(a.reason and a.reason.strip(),'Block needs reason')
                db.execute("UPDATE claims SET state='blocked',block_reason=?,heartbeat=? WHERE run=? AND story=?",(a.reason,time.time(),a.run,a.story))
            else:
                clean(c['worktree']); e=read_json(a.evidence); result=validate_evidence(a.repo,p,c,e)
                db.execute("UPDATE claims SET state='ready-for-integration',result_sha=?,evidence=?,heartbeat=?,block_reason=NULL WHERE run=? AND story=?",(result,canonical(e),time.time(),a.run,a.story))
            return assignment(p,get_claim(db,a))
        if a.command=='repair':
            c=get_claim(db,a); require(c['state']=='awaiting-verification','Only pending combined verification permits coordinator repair')
            require(a.expected_head==c['integration_sha'],'Repair expected-head must match recorded integration SHA')
            clean(p['integration_worktree']); head=sha(p['integration_worktree'],'HEAD')
            require(head!=c['integration_sha'] and ancestor(a.repo,c['integration_sha'],head),'Repair must be committed descendant of recorded integration')
            require(not git(a.repo,'rev-list','--merges',c['integration_sha']+'..'+head),'Repair cannot integrate unassigned branches')
            validate_diff(a.repo,p,c,c['integration_sha'],head,repair=True)
            e=read_json(a.evidence); combined_evidence(p,c,e,head)
            db.execute('INSERT OR REPLACE INTO verifications VALUES(?,?,?,?)',(a.run,'__repair__'+a.story,head,canonical(e)))
            db.execute('UPDATE claims SET integration_sha=? WHERE run=? AND story=?',(head,a.run,a.story))
            db.execute('UPDATE journal SET after_sha=? WHERE run=? AND story=?',(head,a.run,a.story))
            return {'state':'awaiting-verification','integration_sha':head,'repair_recorded':True}
        if a.command=='verify':
            c=get_claim(db,a); require(c['state']=='awaiting-verification','Story has no merge awaiting checks')
            clean(p['integration_worktree']); head=sha(p['integration_worktree'],'HEAD'); require(head==c['integration_sha'],'Combined integration HEAD changed')
            e=read_json(a.evidence); combined_evidence(p,c,e,head)
            db.execute('INSERT OR REPLACE INTO verifications VALUES(?,?,?,?)',(a.run,a.story,head,canonical(e)))
            db.execute("UPDATE claims SET state='integrated' WHERE run=? AND story=?",(a.run,a.story))
            return {'state':'integrated','integration_sha':head}
        if a.command=='finalize':
            claims=rows(db,a.run)
            require(all(s['id'] in claims and claims[s['id']]['state']=='integrated' for s in p['stories']),'Required stories remain unintegrated or blocked')
            clean(p['integration_worktree']); head=sha(p['integration_worktree'],'HEAD')
            require(all(ancestor(a.repo,c['integration_sha'],head) for c in claims.values()),'Integrated history missing from final HEAD')
            e=read_json(a.evidence); combined_evidence(p,None,e,head,final=True)
            db.execute("UPDATE runs SET state='finalized',final_sha=? WHERE run=?",(head,a.run))
            db.execute('INSERT INTO verifications VALUES(?,?,?,?)',(a.run,'__final__',head,canonical(e)))
            return {'state':'finalized','integration_sha':head,'epic':p['epic'],'next':'Continue existing E_final publication, CI and merge approvals; helper does not publish or change sprint status'}
    raise Refusal('Unsupported operation')

class JsonParser(argparse.ArgumentParser):
    def error(self,message): raise Refusal('CLI usage: '+message)

def parser():
    p=JsonParser(description=__doc__)
    p.add_argument('--repo',default='.')
    sub=p.add_subparsers(dest='command',required=True)
    for name in ['version','plan','init','status','claim','heartbeat','block','submit','integrate','repair','verify','finalize']:
        cmd=sub.add_parser(name)
        if name in {'plan','init'}: cmd.add_argument('--plan',required=True)
        if name not in {'version','plan'}: cmd.add_argument('--owner',required=True)
        if name not in {'version','plan','init'}: cmd.add_argument('--run',required=True)
        if name in {'claim','heartbeat','block','submit','integrate','repair','verify'}: cmd.add_argument('--story',required=True)
        if name in {'claim','heartbeat','block','submit'}:
            cmd.add_argument('--worker',required=True); cmd.add_argument('--generation',type=int,default=1)
        if name=='claim':
            cmd.add_argument('--branch',required=True); cmd.add_argument('--worktree',required=True)
        if name=='block': cmd.add_argument('--reason',required=True)
        if name in {'submit','repair','verify','finalize'}: cmd.add_argument('--evidence',required=True)
        if name in {'integrate','repair'}: cmd.add_argument('--expected-head',required=True)
    return p

def main(argv=None):
    try:
        result=execute(parser().parse_args(argv))
        print(json.dumps({'ok':True,**result},sort_keys=True)); return 0
    except (Refusal,OSError,ValueError,sqlite3.Error,subprocess.SubprocessError,TypeError,KeyError) as e:
        print(json.dumps({'ok':False,'error':str(e),'error_type':type(e).__name__},sort_keys=True)); return 1

if __name__=='__main__': sys.exit(main())
