# Product / Know-how layer split — design

**Date**: 2026-06-10
**Author**: brainstorming session (Claude Fable 5)
**Status**: historical implementation design. The branch has since been merged, and the current UI contract is amended by ADR-0008 (2026-06-17), `docs/ACCEPTANCE.md`, and `docs/GRAPH_UX.md`.
**Related ADRs**: ADR-0004 (capability/product layering, unchanged), ADR-0005 (decomposition stop — amendment required), ADR-0006 / ADR-0007 (graph surface this design extends). A new ADR-0008 will record the ontology decision.

## Problem

The graph canvas mixes two ontologically different things. Of the ~107 canvas
nodes in the active graph, ~71 are artifacts you can buy or build (`product`,
`module`, `equipment`, `material`) and 36 are activities or embodied knowledge
(`engineering_method` 27, `manufacturing_process` 9). A servo motor and
"vision model deployment optimization" render identically, but one is a
purchasable thing and the other is know-how held by organizations.

The original instinct — "make every node a product" — resolves, after
analysis, into: **every dependency has a transactional form or it doesn't,
and that distinction is itself the signal worth modelling.** Procurable
know-how is a service product; non-procurable know-how is exactly where
make-vs-buy bites and where bottleneck moats live. Forcing the latter into
fictional "service" nodes would erase the strongest signal the graph can
offer.

Audience analysis sharpened this. The project's north star stays "a learner
studying manufacturing" — but *learner* is an umbrella. Personas are
**learning focuses** on the same substrate, and the currently prioritized
focus is the **retail secondary-market investor** hunting chokepoint
suppliers (the "shiso leaf" / 紫苏叶 strategy: irreplaceable, high-barrier,
supply-concentrated, market-ignored upstream segments). For that focus, the
know-how layer is the moat map, supply concentration is a first-class
signal, and honest uncertainty (review status, evidence provenance) is the
tool's credibility anchor.

## Decisions

### 1. Ontology: kinds stay, display-layer umbrella term "Know-how"

- `engineering_method` and `manufacturing_process` remain distinct schema
  kinds. No node is renamed, merged, or converted to a service node.
- **Know-how** (Chinese alias: 技术诀窍) becomes the canonical display-layer
  umbrella term covering both kinds. It enters the CONTEXT.md Language
  section. The term deliberately avoids "capability", which stays reserved
  for the ADR-0004 demand container.
- The `capability` kind and its semantics are untouched by this design.

### 2. New node field: `transactability`

Optional field on `engineering_method` / `manufacturing_process` nodes:

```
transactability?: "procurable" | "must_build"
```

- `procurable`: a real market sells this as a service/dataset/license
  (contract assembly, data annotation, deployment consulting). Conceptually
  these *are* products — service products — which resolves the original
  "all nodes should be products" instinct without moving any node.
- `must_build`: no one sells it separately; it exists embodied in firms'
  products or vertical integration. These are the moat/bottleneck
  candidates.
- Claims should carry evidence via the existing `evidenceIds` mechanism and
  default to `reviewStatus: "unreviewed"` discipline like any other claim.
- `validate:data` warns when a know-how node lacks `transactability`;
  backfill of the 36 existing nodes is part of implementation.

### 3. Graph surface: two layers, one skeleton

Consistent with ADR-0007 (stable identity, switchable interpretation), the
layer toggle is a lens over one persistent map, not a second map.

**Product layer (default).** Canvas shows artifact kinds only: `product`,
`module`, `equipment`, `material`. Answers "what do you buy/build". The
canvas-kind set in `canvasGraph.ts` drops `engineering_method` /
`manufacturing_process` for this layer.

**Know-how layer.** Same radial skeleton; know-how nodes light up as diamond
markers attached to their structural parents. **2026-06-17 amendment:**
artifact context must keep a muted subsystem color, not grey placeholders,
and no user-facing graph node may render as grey/unclassified. Node fill
encodes the current Barrier Sources vocabulary; kind (`engineering_method`
vs `manufacturing_process`) demotes to a detail-panel chip.

**Bottleneck surfacing across layers.** Hiding know-how must not hide
bottlenecks (north star + scenario Q1 both depend on the default view
answering "where is the biggest bottleneck"). Rule: a product-layer node
gets a red-ring badge with a count when it has a `requires` /
`implemented_by` edge to a hidden know-how node carrying non-empty
`bottleneckOf`. The detail panel lists those know-how nodes under a
"Know-how" section (mirroring the ADR-0006 metric-folding pattern) with
jump links into the know-how layer; the know-how layer offers the reverse
jump ("hosted by …").

**Edges.** Edges with a hidden endpoint do not render in the product layer;
they fold into the host node's detail panel instead.

### 4. Investor-focus minimal increments

- **Organization listing status.** `organization` nodes gain optional
  `listingStatus: "public" | "private" | "subsidiary" | "unknown"` and
  `ticker?: string`. This was already required by the
  investor-operator-scenarios success criteria (scenario Q3) but had no
  schema home. Backfill for the 93 existing orgs is implementation work
  (agent-assisted, lands `unreviewed`).
- **Supply concentration is derived, not stored.** Holder count = distinct
  non-deprecated organizations reachable via `manufactured_by` /
  `implemented_by` from a node. Shown in the know-how layer and detail
  panel ("N holders, M listed"). Zero holders renders as an explicit red
  flag — either a data gap or true scarcity, both worth surfacing (3 such
  nodes exist today).
- **ADR-0005 amendment.** Current stop condition halts decomposition at
  commodified nodes; chokepoints live precisely in "mature but
  supply-concentrated" segments, so the existing supply-concentration
  override is promoted from exception to rule: `maturityLabel ∈ {mature,
  widely_adopted}` **and** holder count ≤ threshold (initial value 3,
  tunable) ⇒ the node is treated as a decomposition frontier (frontier
  penalty + auto-task, per the ADR-0005 state table) instead of a default
  stop leaf.
- **Reserved field, not populated** (maturityHistory pattern):
  `capacityLeadTimeMonths?: number` — capacity-expansion lead time, the one
  shiso-leaf criterion with no graph counterpart. Schema reserves it;
  population deferred.
- **Explicitly not modelled**: market attention / expectation gap
  (机构覆盖/预期差). No reliable data source; the user judges this
  themselves.

### 5. Documentation changes

- CONTEXT.md: add **Know-how** Language entry; update the graph
  visualization section (canvas-kind list and node counts change with the
  layer split).
- `docs/investor-operator-scenarios.md`: reframe "Target Audiences" as
  learning focuses with retail secondary-market investor first; add
  scenario questions for supply concentration, listing status, and
  substitution pressure (sibling-product maturity as substitution risk).
- New ADR-0008 recording the layer-split ontology decision and
  `transactability`; amendment text appended to ADR-0005.
- README north star is **not** rewritten.

## Considered alternatives

- **Service-ify everything** (every know-how node becomes a "service
  product"): rejected — invents markets that don't exist and erases the
  must_build signal.
- **Merge know-how into host products** (know-how becomes a "why hard"
  text attribute): rejected — 12 of 36 know-how nodes carry
  bottleneck/frontier/key-tech flags; merging demotes the bottleneck story
  to prose and loses maturity/cost/evidence anchoring.
- **Separate parallel map** for know-how: rejected in favor of a layer
  toggle on the same skeleton — spatial memory and ADR-0007 stable
  identity are worth more than an independent layout.

## Non-goals (recorded for roadmap, not this iteration)

- Opportunity color mode (composite shiso-leaf score as a sixth color
  mode).
- Per-node evidence subscription feed (the Bayesian update loop as a
  product feature).
- Shareable chain-card export (one-image bottleneck narrative).
- Humanoid-robot chain expansion (first expansion target — highest node
  overlap with existing data: reducers, servos, encoders, machine vision).
- Renaming procurable know-how nodes into service-product phrasing.
- Capability-level scoring (still deferred per ADR-0004).

## Acceptance sketch

1. Default `/graph` canvas contains only artifact-kind nodes; the know-how
   toggle reveals the know-how layer with transactability coloring.
2. Scenario Q1 ("largest bottleneck") remains answerable from the default
   view via red-ring badges; each host's badge count equals its hidden
   bottleneck know-how dependencies.
3. Scenario Q3 surfaces listing status on organization entries in the
   detail panel.
4. `validate:data` passes with the new optional fields; warnings fire for
   know-how nodes missing `transactability`.
5. Existing gate, cost-rollup, and task-generation behavior unchanged
   (layers are display-level; data-level traversals still see know-how
   nodes).
