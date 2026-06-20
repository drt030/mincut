import sys; sys.path.insert(0,'/Users/wth/dev/civilization/.scratch/deepen-run-2026-06-16')
import _render_sim as m
from collections import defaultdict

def dump(name,root,gated,maxdepth=None):
    r=m.render(root,gated,maxdepth=maxdepth)
    reach=r['reach']; depth=r['depth']; nbid=r['all_nbid']; children=r['children']
    print(f"\n{'='*78}\nTREE: {name}  (rendered nodes shown; cap={maxdepth})\n{'='*78}")
    def walk(nid,prefix=''):
        n=nbid[nid]
        mat=n.get('maturityLabel','?')
        tags=[t for t in n.get('tags',[]) if t in ('hard_to_develop','bottleneck')]
        bt='*BN' if (n.get('bottleneckOf') or 'bottleneck' in n.get('tags',[]) or 'hard_to_develop' in n.get('tags',[])) else ''
        print(f"{prefix}[d{depth[nid]}] {nid}  <{n['kind']}|{mat}>{bt}")
        kids=sorted([c for c in children.get(nid,[]) if c in reach], key=lambda x:nbid[x]['kind'])
        for c in kids: walk(c,prefix+'    ')
    walk(root)

# First-layer fan-out comparison
def fanout(name,root,gated):
    r=m.render(root,gated,maxdepth=None)
    reach=r['reach']; depth=r['depth']; nbid=r['all_nbid']; children=r['children']
    print(f"\n### FIRST-LAYER FAN-OUT: {name}")
    l1=sorted([c for c in children.get(root,[]) if c in reach])
    for c in l1:
        # count whole subtree size under c
        sub=set(); q=[c]
        while q:
            x=q.pop()
            if x in sub: continue
            sub.add(x)
            for k in children.get(x,[]):
                if k in reach: q.append(k)
        maxd=max((depth[x] for x in sub),default=depth[c])
        print(f"  {c} <{nbid[c]['kind']}>  subtree={len(sub)} nodes, deepest=d{maxd}")

fanout('FLAGSHIP','ai_accelerator_module_hbm_cowos',False)
fanout('SPACEX','spacex_reusable_launch_stack',True)
