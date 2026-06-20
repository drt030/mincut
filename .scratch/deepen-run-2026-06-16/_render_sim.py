import json, os, glob
from collections import defaultdict, deque
ROOT='/Users/wth/dev/civilization'

# Load ALL node/edge files (combined graph, as graphLoader does)
def load_all():
    nodes=[]; edges=[]
    for f in sorted(glob.glob(f'{ROOT}/data/nodes/*.json')):
        nodes+=json.load(open(f))
    for f in sorted(glob.glob(f'{ROOT}/data/edges/*.json')):
        d=json.load(open(f))
        if isinstance(d,dict): d=d.get('edges',[])
        edges+=d
    return nodes,edges

KNOW_HOW={'engineering_method','manufacturing_process'}
CANVAS_KINDS={'product','technical_route','module','engineering_method','manufacturing_process','equipment','material'}
GENERIC_OP={'deployment','maintenance','operator_training','installation'}
RAW_SUPPLY={'raw_material','mining','supply_chain'}
SUPPLIER_RELS={'manufactured_by','implemented_by','qualified_supplier','reported_capable_supplier','second_source_candidate','capacity_provider','strategic_supplier_to'}
GATED_TAGS={'spacex_reusable_launch','spacex_orbital_data_center','humanoid_actuator','humanoid_robotics','ai_dc_power_chain','controlled_fusion'}
OPEN_TAGS={'ai_compute_chain','parcel_sorting_robot'}  # plus non-locked gated; for space route, locked = spacex_* only

def is_know_how(n): return n['kind'] in KNOW_HOW
def has_tag(n,tags): return any(t in tags for t in n.get('tags',[]))
def explicitly_key(n):
    tags=set(n.get('tags',[]))
    return ('hard_to_develop' in tags or 'bottleneck' in tags or len(n.get('bottleneckOf',[]))>0 or len(n.get('frontierFor',[]))>0)
def is_op_workflow(n):
    label=f"{n['id']} {n['name']}".lower(); return 'workflow' in label and has_tag(n,GENERIC_OP)
def is_raw_supply(n): return has_tag(n,RAW_SUPPLY) and not explicitly_key(n)
def is_canvas_node(n):
    if n['kind'] not in CANVAS_KINDS: return False
    if is_op_workflow(n): return False
    if n['kind']=='material': return explicitly_key(n)
    if n['kind']=='manufacturing_process' and is_raw_supply(n): return False
    return True
def is_artifact_canvas(n): return is_canvas_node(n) and not is_know_how(n)
def is_canvas_tree_edge(e,nbid):
    rel=e['relation']
    if rel=='requires':
        s=nbid.get(e['source']); t=nbid.get(e['target'])
        if s and t and is_know_how(s) and is_artifact_canvas(t): return False
        return True
    if rel=='has_route': return True
    if rel!='implemented_by': return False
    t=nbid.get(e['target']); return t is not None and is_know_how(t)

def reachable_from(nodes,edges,root):
    out=defaultdict(list)
    for e in edges: out[e['source']].append(e['target'])
    ids={root}; q=deque([root])
    while q:
        s=q.popleft()
        for t in out.get(s,[]):
            if t in ids: continue
            ids.add(t); q.append(t)
    return ids

def strip_space_exposure(nodes,edges):
    # locked = spacex_reusable_launch + spacex_orbital_data_center (entitlement space absent)
    locked={'spacex_reusable_launch','spacex_orbital_data_center'}
    nbid={n['id']:n for n in nodes}
    # supplier-locked orgs: org reached by supplier rel from a host carrying a locked tag
    supplier_locked=set()
    for e in edges:
        if e['relation'] not in SUPPLIER_RELS: continue
        t=nbid.get(e['target'])
        if not t or t['kind']!='organization': continue
        host=nbid.get(e['source'])
        if host and any(tag in locked for tag in host.get('domain',[])):
            supplier_locked.add(e['target'])
    hidden=set()
    open_chain={'ai_compute_chain','parcel_sorting_robot','humanoid_actuator','humanoid_robotics','ai_dc_power_chain','controlled_fusion'}
    for n in nodes:
        if n['kind']!='organization': continue
        if 'free_teaser' in n.get('tags',[]): continue
        dt=n.get('domain',[])
        own_locked=any(t in locked for t in dt)
        own_open=any(t in open_chain for t in dt)
        if own_locked and not own_open: hidden.add(n['id']); continue
        if n['id'] in supplier_locked: hidden.add(n['id'])
    nodes2=[n for n in nodes if n['id'] not in hidden]
    edges2=[e for e in edges if e['source'] not in hidden and e['target'] not in hidden]
    return nodes2,edges2,hidden

def build_canvas(nodes,edges,root,maxdepth=4):
    nbid={n['id']:n for n in nodes}
    base={n['id'] for n in nodes if is_canvas_node(n)}; base.add(root)
    te=[e for e in edges if is_canvas_tree_edge(e,nbid) and e['source'] in base and e['target'] in base]
    children=defaultdict(list)
    for e in te: children[e['source']].append(e['target'])
    reach=set(); depth={root:0}; q=deque([root])
    while q:
        cur=q.popleft()
        if cur in reach: continue
        reach.add(cur); d=depth.get(cur,0)
        if maxdepth is not None and d>=maxdepth: continue
        for ch in children.get(cur,[]):
            if ch in reach: continue
            nd=d+1
            if ch not in depth or nd<depth[ch]: depth[ch]=nd; q.append(ch)
    return reach,depth,children,te,nbid

def render(root, gated, maxdepth=4):
    nodes,edges=load_all()
    # 1. scope to reachable
    rids=reachable_from(nodes,edges,root)
    nodes=[n for n in nodes if n['id'] in rids]; edges=[e for e in edges if e['source'] in rids and e['target'] in rids]
    hidden=set()
    if gated:
        nodes,edges,hidden=strip_space_exposure(nodes,edges)
    reach,depth,children,te,nbid=build_canvas(nodes,edges,root,maxdepth)
    return dict(scoped_nodes=nodes,scoped_edges=edges,reach=reach,depth=depth,children=children,nbid=nbid,hidden=hidden,all_nbid={n['id']:n for n in nodes})

def report(name,root,gated):
    r=render(root,gated)
    reach=r['reach']; depth=r['depth']; nbid=r['all_nbid']
    print(f"\n{'='*72}\n{name}  root={root}  gated={gated}")
    print(f"  scoped graph: {len(r['scoped_nodes'])} nodes / {len(r['scoped_edges'])} edges  (orgs hidden by gate: {len(r['hidden'])})")
    print(f"  RENDERED focal-tree nodes (depth<=4): {len(reach)}")
    dh=defaultdict(int); 
    for nid in reach: dh[depth[nid]]+=1
    print(f"  depth histogram: {dict(sorted(dh.items()))}")
    rk=defaultdict(int)
    for nid in reach: rk[nbid[nid]['kind']]+=1
    print(f"  rendered kind breakdown: {dict(sorted(rk.items()))}")
    return r

if __name__=='__main__':
    report('FLAGSHIP (gated=False, full free)','ai_accelerator_module_hbm_cowos',False)
    report('SPACEX (gated=True, space locked) — PRODUCTION RENDER','spacex_reusable_launch_stack',True)
    report('SPACEX (gated=False, ungated for compare)','spacex_reusable_launch_stack',False)

def deep_map(name,root,gated):
    print(f"\n{'#'*72}\nDEEP MAP: {name}")
    r=render(root,gated,maxdepth=None)  # NO depth cap -> see true structural depth
    reach=r['reach']; depth=r['depth']; nbid=r['all_nbid']; children=r['children']
    print(f"  UNCAPPED rendered nodes: {len(reach)}  max depth reached: {max(depth.values())}")
    dh=defaultdict(int)
    for nid in reach: dh[depth[nid]]+=1
    print(f"  uncapped depth histogram: {dict(sorted(dh.items()))}")
    # nodes at depth>=4 that have children (i.e. clipped by the cap=4)
    clipped=[nid for nid in reach if depth[nid]>=4 and any(c in reach for c in children.get(nid,[]))]
    print(f"  nodes at depth>=4 WITH children (clipped by depth-4 cap): {len(clipped)}")
    for nid in sorted(clipped, key=lambda x: depth[x]):
        kids=[c for c in children.get(nid,[]) if c in reach]
        print(f"    [d{depth[nid]}] {nid} ({nbid[nid]['kind']}) -> {len(kids)} clipped kids: {[ (c,nbid[c]['kind']) for c in kids][:6]}")

if __name__=='__main__':
    pass
