---
status: accepted
---

# Decomposition stop = commodified leaves; Key technology = hard-to-develop nodes

## Context

The graph is the project's reasoning substrate, and recursive decomposition is the mechanism by which it grows. Two related questions had no canonical answer prior to grilling:

1. **When should decomposition stop?** The plan said "added only when useful for the current product-domain question" — operationally vague. Without a stop rule, the agent-assisted import workflow has no termination criterion, the gate cannot tell a deliberate leaf from an unfinished branch, and the cost rollup has no natural termination.

2. **What makes a node a "Key technology"?** The plan implied a notion of "important dependency" but didn't define it. Without a definition, the boundary check (which architectures are the same Product?) and the maturity / bottleneck story have no anchor.

Two observations from the grilling discussion drove both answers:

- The whole *point* of decomposition is to surface manufacturing difficulty and bottlenecks. Anything already commodified at industrial scale carries no manufacturability story and shouldn't be decomposed.
- "Key technology" is a property of a node intrinsic to *how hard it is to develop*, not a property of the Product that depends on it. Computer-vision-based object recognition is hard to develop; a better bearing is incremental.

## Decision

### Decomposition stop condition

Stop decomposing downward when a node represents a technology / component / material that is **commodified at industrial scale in the relevant region/era of the Product's targetContext**. Operationally, "commodified" is encoded as `maturityLabel ∈ {mature, widely_adopted}` on the node.

Three explicit states:

| Node state | Meaning | Gate effect |
|---|---|---|
| `maturityLabel ∈ {mature, widely_adopted}` | Default stop. Treat as commodified leaf. | No frontier penalty. |
| `maturityLabel ∈ everything else` (or absent) | Should be decomposed. Default frontier. | Frontier penalty + auto-task to expand. |
| `tags` includes `decomposition_frontier` | Explicit frontier (overrides `maturityLabel`). | Frontier penalty + auto-task. |

`validate:data` requires every node to have a `maturityLabel` (otherwise the stop condition is undefined).

Continuing past a `mature`/`widely_adopted` node is allowed when there is a stated override reason — supply concentration, geopolitical risk, a specific research question, or a historical / counterfactual study. Such overrides are recorded in the node's `notes`.

Commodification is **relative to the Product's `targetContext`** (region and era). The same physical artifact can be a commodified leaf for a 2025-China parcel-sorting Product and a real frontier in a 1820s industrial-base counterfactual study. For Products with non-current-day contexts, `maturityLabel` should reflect the era — possibly via context-specific node copies (deferred until Phases 4/5 in the roadmap).

### Key technology

A "key technology" is a node that is **hard to develop** — i.e. the development cost / risk is high enough that having vs not-having it produces a qualitative rather than quantitative difference for any Product depending on it.

Operationally for v0:

- A `tags: ["hard_to_develop"]` tag on `module`, `technical_route` (legacy), `engineering_method`, `material`, or `bottleneck` nodes marks them as Key technologies.
- Tagged nodes must carry a `notes` or `description` explaining what makes them hard (`validate:data` rule).
- The boundary discussion (ADR-0004) refers to "shared key technology" as the test for whether two architectures are sibling Products or the same Product — but this test is **applied at the Capability layer**, not during a single Product's decomposition.
- The tag's main downstream uses are: maturity scoring weight, bottleneck reasoning, gate scoring, what-if analysis. It is **not** used to gate-check imports during decomposition.

Phase-2 schema refinement may promote `hard_to_develop` from a tag to a `developmentDifficulty: "incremental" | "hard" | "breakthrough"` field, with a `difficultyRationale` text companion. The v0 tag is the migration substrate for that field.

### How the two interact with cost (ADR-0003)

Cost rollup stops at commodified leaves: those leaves are exactly where well-known commercial prices exist. Continuing past a commodified leaf is the same kind of decision as continuing past it for any other reason — done with intent, not by default.

## Considered alternatives

### For decomposition stop

- **Kind-based stop list** (`material`, `scientific_principle`, etc. always stop). Rejected: kind doesn't capture commodification; some `material` nodes are commodified, others (rare-earth magnets, semiconductor-grade silicon) are decomposition frontiers.
- **Explicit `expansion_complete` tag, mirroring `decomposition_frontier`**. Rejected: the same-named-node-different-context problem (a steel screw is a leaf for one Product and a frontier for another) makes per-node tags wrong. Stop is per-Product-context, not per-node.
- **Always recurse to fundamental physics / mineral extraction.** Rejected: most depth past commodified leaves carries no manufacturability story for the Product in question.

### For Key technology

- **Explicit `key_dependency_of` relation pointing from each Key technology to each Product that depends on it.** Rejected as overspecified once the user clarified that "Key technology = hard to develop" is intrinsic to the technology, not a per-Product declaration. Key technology is a node property; dependencies are already in `requires` edges.
- **Inferred Key technology from graph structure** (e.g., any node with high in-degree from Products is "key"). Rejected: structural in-degree doesn't track development difficulty; a commonly-required commodified part has high in-degree but is not a Key technology.
- **Promote `hard_to_develop` to a schema field immediately in v0.** Rejected as Phase-2 work; v0 holds at tag level to avoid schema churn.

## Consequences

- `validate:data` requires `maturityLabel` on every node; rejects records with `tags: ["hard_to_develop"]` and no `notes`/`description`.
- `gateRunner.ts` frontier judgment changes from "tag-only" to "`decomposition_frontier` tag OR (`maturityLabel ∉ {mature, widely_adopted}` AND no expanded children)".
- The agent expansion workflow (`docs/NODE_EXPANSION.md`) gains rules: skip nodes that are `mature`/`widely_adopted` unless an override reason is stated; tag visibly hard-to-develop intermediate nodes with `hard_to_develop`.
- Existing nodes need a domain pass to (a) ensure all have `maturityLabel`, (b) tag the genuinely hard-to-develop ones (CV object recognition, robust real-time perception under variation, motion planning, etc.).

## Revisit when

- The `hard_to_develop` tag begins to require sub-states (e.g., distinguishing "hard but solved" from "still actively researched"), at which point the Phase-2 `developmentDifficulty` field promotion happens.
- Counterfactual / historical Product studies need per-context maturity, prompting a context-keyed maturity representation (Phases 4/5).
- The "20% of supply from one country" or similar geopolitical override reasons accumulate enough cases to need their own first-class flag rather than free-text in `notes`.

## Amendment 2026-06-10 — supply concentration promotes mature nodes back to frontier

Per the product/know-how layer design
(`docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md`, ADR-0008):
the original decision listed "supply concentration" as a stated-override
*exception* for continuing past a commodified node. The investor learning
focus inverts that: chokepoints live precisely in "mature but
supply-concentrated" segments, so the exception becomes the rule.

Amended stop condition: a node with `maturityLabel ∈ {mature, widely_adopted}`
is a default stop **only when its supply is broad**. When its holder count
(distinct non-deprecated organizations via `manufactured_by` /
`implemented_by` edges, computed by `src/lib/supplyConcentration.ts`) is
≤ 3, the node is treated per the frontier row of the state table above:
frontier penalty + auto-task, decomposition-eligible.

The threshold starts at 3 (`CONCENTRATION_THRESHOLD`) and is tunable.
Zero holders also counts as concentrated — either a data gap or true
scarcity, both worth a frontier task.
