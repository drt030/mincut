import json, sys
from collections import defaultdict, deque

ROOT='/Users/wth/dev/civilization'

def load(domain):
    nodes=json.load(open(f'{ROOT}/data/nodes/{domain}.json'))
    edges=json.load(open(f'{ROOT}/data/edges/{domain}_edges.json'))
    # edges file may be {edges:[...]} or [...]
    if isinstance(edges,dict): edges=edges.get('edges',edges)
    return nodes, edges

KNOW_HOW={'engineering_method','manufacturing_process'}
CANVAS_KINDS={'product','technical_route','module','engineering_method','manufacturing_process','equipment','material'}
GENERIC_OP={'deployment','maintenance','operator_training','installation'}
RAW_SUPPLY={'raw_material','mining','supply_chain'}

def is_know_how(n): return n['kind'] in KNOW_HOW
def has_tag(n,tags): return any(t in tags for t in n.get('tags',[]))
def explicitly_key(n):
    tags=set(n.get('tags',[]))
    return ('hard_to_develop' in tags or 'bottleneck' in tags
            or len(n.get('bottleneckOf',[]))>0 or len(n.get('frontierFor',[]))>0)
def is_op_workflow(n):
    label=f"{n['id']} {n['name']}".lower()
    return 'workflow' in label and has_tag(n,GENERIC_OP)
def is_raw_supply(n): return has_tag(n,RAW_SUPPLY) and not explicitly_key(n)
def is_canvas_node(n):
    if n['kind'] not in CANVAS_KINDS: return False
    if is_op_workflow(n): return False
    if n['kind']=='material': return explicitly_key(n)
    if n['kind']=='manufacturing_process' and is_raw_supply(n): return False
    return True
def is_artifact_canvas(n): return is_canvas_node(n) and not is_know_how(n)

def is_canvas_tree_edge(e, nbid):
    rel=e['relation']
    if rel=='requires':
        s=nbid.get(e['source']); t=nbid.get(e['target'])
        if s and t and is_know_how(s) and is_artifact_canvas(t): return False
        return True
    if rel=='has_route': return True
    if rel!='implemented_by': return False
    t=nbid.get(e['target'])
    return t is not None and is_know_how(t)

def default_focal(nodes):
    # V0_TARGET first; else first product. We'll just take first product whose domain matches.
    for n in nodes:
        if n['kind']=='product': return n
    return None

def build_tree(nodes, edges, maxdepth=4, root_id=None):
    nbid={n['id']:n for n in nodes}
    base_eligible={n['id'] for n in nodes if is_canvas_node(n)}
    if root_id is None:
        focal=default_focal(nodes)
    else:
        focal=nbid.get(root_id)
    if focal is None: return None
    base_eligible.add(focal['id'])
    tree_edges=[e for e in edges if is_canvas_tree_edge(e,nbid) and e['source'] in base_eligible and e['target'] in base_eligible]
    children=defaultdict(list)
    for e in tree_edges:
        children[e['source']].append(e['target'])
    reachable=set(); depth_by={focal['id']:0}; q=deque([focal['id']])
    while q:
        cur=q.popleft()
        if cur in reachable: continue
        reachable.add(cur)
        d=depth_by.get(cur,0)
        if maxdepth is not None and d>=maxdepth: continue
        for ch in children.get(cur,[]):
            if ch in reachable: continue
            nd=d+1
            if ch not in depth_by or nd<depth_by[ch]:
                depth_by[ch]=nd; q.append(ch)
    return dict(focal=focal, reachable=reachable, depth_by=depth_by, children=children, nbid=nbid, tree_edges=tree_edges, base_eligible=base_eligible)

def summarize(domain, root_id=None, label=None):
    nodes,edges=load(domain)
    r=build_tree(nodes,edges,root_id=root_id)
    if r is None:
        print(f"NO FOCAL for {domain}"); return
    nbid=r['nbid']; reach=r['reachable']; depth=r['depth_by']
    print(f"\n{'='*70}\nDOMAIN: {domain}  focal={r['focal']['id']} ({r['focal']['name']})  label={label}")
    print(f"  total nodes in file: {len(nodes)}")
    # node kind breakdown (whole file)
    kinds=defaultdict(int)
    for n in nodes: kinds[n['kind']]+=1
    print(f"  file kind breakdown: {dict(sorted(kinds.items()))}")
    print(f"  RENDERED focal-tree node count (maxdepth=4): {len(reach)}")
    # depth histogram
    dh=defaultdict(int)
    for nid,d in depth.items():
        if nid in reach: dh[d]+=1
    print(f"  rendered depth histogram: {dict(sorted(dh.items()))}")
    # rendered kind breakdown
    rk=defaultdict(int)
    for nid in reach: rk[nbid[nid]['kind']]+=1
    print(f"  rendered kind breakdown: {dict(sorted(rk.items()))}")
    return r

if __name__=='__main__':
    summarize('ai_compute_chain', label='FLAGSHIP')
    summarize('spacex_reusable_launch', label='TARGET')
