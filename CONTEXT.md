# Capability Graph Explorer

A graph-backed research tool for reasoning about how products, technologies, and capabilities become mature, manufacturable, scalable, affordable, and adopted. The graph is the reasoning substrate — visualization, maturity estimates, validation reports, and research tasks all derive from structured local graph data.

## Project purpose (north star)

This tool exists for a learner studying manufacturing — how products of industry are built, where the **bottlenecks** sit in the dependency tree, and **how those bottlenecks evolve over time**.

Two learning modes drive every design choice:

1. **Forward-looking**: for an emerging product, surface the key bottlenecks that gate its arrival, so the learner can ask "what has to happen for this to exist?"
2. **Retrospective**: for a mature product, replay the bottleneck sequence stage by stage, so the learner can see "what unblocked what, and when?"

The **time dimension is core, not decorative**. The current v0 scalar maturity is a simplification; the time-slider (per ADR-0002 `maturityHistory` reservation) is the eventual user-facing affordance and the anchor for retrospective mode.

UX, content, and modelling decisions serve those two learning modes. A feature that is correct but does not help a learner trace bottlenecks is lower priority than one that does.

## Language

**Capability node**:
A graph node of `kind: "capability"` representing a demand / need / desired outcome that one or more **Product nodes** can satisfy. Sits *above* products. Example: `affordable_small_warehouse_automation` is the capability; the parcel-sorting robot, delta sorter, conveyor diverter, mobile robot sorter, and hybrid human-robot sorter are alternative Products under it. **In v0, the Capability node is a structural container only** — it groups Products and anchors **Product boundary** distinctions, but the **Validation gate** does not score Capabilities and Capability nodes carry no aggregated maturity. Capability-level scoring (e.g., "is this capability satisfied?", "which Product candidate dominates?") is a deferred future concern. The Capability's `targetContext` (total scenario: facility size, daily throughput, parcel-spec range, etc.) should be filled in *now* so future scoring logic has its input ready, but the score itself stays unset.
_Avoid_: Demand, need, requirement (these are fine in conversation; canonical term is "capability" matching the schema).

**Product node**:
A graph node of `kind: "product"` representing one specific architecture that satisfies a Capability. Two product candidates under the same Capability are *neighbors*, not the same product. Decomposing a Product (walking down `requires` / `part_of`) stays inside one Product by construction — boundary distinctions don't arise during decomposition.
_Avoid_: Product category, product line, product family.

**Product boundary**:
The line that distinguishes one Product from a *neighboring* Product candidate **under the same Capability**. Boundary distinction is meaningful only at this sibling-Product layer; it does not arise during the recursive decomposition of a single Product. Two sibling architectures fall in different Products when their technology stacks differ at one or more **Key technologies** (operational test: would the maturity story differ qualitatively?). Boundary judgment is partly subjective and is recorded by deciding which `kind: "product"` node a candidate attaches under.
_Avoid_: Product scope, product definition.

**Key technology**:
A technology node that is **hard to develop** — i.e. its development cost / risk is high enough that having vs not-having it is a qualitative rather than quantitative difference for any product depending on it. Computer-vision-based object recognition is a key technology; a better bearing or screw is incremental. The judgment is intrinsic to the technology (how hard to develop), not to any one product. Maturity (`maturityLabel`) is *current* state; key-tech status is *historical/intrinsic difficulty* and changes slowly. Quantitative-to-qualitative transitions (量变到质变) do happen and re-classification is a deliberate human decision recorded on the node.
_Avoid_: Critical technology, hard tech (these are fine in conversation but stick to "key technology" in canonical docs).

**Active v0 graph**:
The subgraph rooted at `low_cost_parcel_sorting_robot_300k_rmb` and its allowed recursive children. Other product fixtures in `/data` are not part of the active graph and are not exposed by default in the home/graph surface.
_Avoid_: Active scope (used internally but ambiguous), main graph.

**Cost target (parcel-sorting robot v0)**:
**300,000 RMB**, denominated as **installed/deployed sale price for a single sorting cell** containing one robot arm, one vision system, one end effector (gripper or suction), safety guarding, controller, and integration to the customer's existing conveyor. **Excluded**: the customer's pre-existing conveyor itself, annual software/maintenance fees, and consumables. **Year**: 2025 RMB.
_Avoid_: BOM cost, factory-gate price, 3-year TCO (these are different numbers and shouldn't be conflated with the target).

**Decomposition frontier**:
A node where decomposition has explicitly stopped but is known to be incomplete — a legitimate target for the agent-assisted import workflow. Marked via the `decomposition_frontier` tag. Distinct from the *default* stop (commodified leaves, see **Decomposition stop condition**), which doesn't need a tag.

**Decomposition stop condition**:
Stop decomposing downward when a node represents a technology / component / material that is **commodified at industrial scale in the relevant region/era of the Product's targetContext**. The whole point of decomposition is to surface manufacturing difficulty and bottlenecks; commodified inputs (electricity, common steel/aluminium, screws, sheet metal in 2025-China) carry no manufacturability story and don't need to be decomposed. Operationally, "commodified" is encoded as `maturityLabel ∈ {mature, widely_adopted}` on the node. Continue decomposing past a `mature`/`widely_adopted` node only with a stated override reason (supply concentration, geopolitical risk, specific research question, historical/counterfactual study). Commodification is **relative to the Product's context** — the same physical artifact (e.g. a steel screw) is a commodified leaf for a 2025 Chinese parcel-sorting robot but a real frontier in a 1820s industrial-base counterfactual study. For Products with non-current-day contexts, `maturityLabel` should reflect the era/region — possibly via a context-specific node copy (deferred until Phase 4/5).

**Candidate record**:
A node, edge, evidence, or task imported via `npm run import:candidates`. Defaults to `reviewStatus: "unreviewed"` and cannot be imported as `reviewed`, `disputed`, or `deprecated` outside `--dry-run --allow-reviewed` preview. The latter three statuses all imply that a human has already made a judgment, so they are not legitimate states for fresh agent-imported candidates.

**Review status ladder**:
The four `reviewStatus` values, with distinct semantics and gate effects:

| Status | Meaning | Gate effect | Who can write | Auto-task |
|---|---|---|---|---|
| `unreviewed` | Added but no human review. Default for fresh records. | Counts as coverage (presence). Caps relevant scores at 3/5. | Default for `import:candidates`; default for any new record | "Human-review this claim" task |
| `reviewed` | A human has looked at it and judges it plausibly true. | `reviewed + high confidence + non-vendor + non-internal evidence` → trusted, can lift to 5/5. Other reviewed records (medium/low confidence, vendor, internal) → weak, capped at 4. | Human only. Import is allowed only via `--dry-run --allow-reviewed` preview. | None |
| `disputed` | A human has looked **and finds counter-evidence or active disagreement**. Distinct from `unreviewed` (which means "not yet looked at"). | Counts as coverage but caps relevant scores at 2/5 — *lower* than `unreviewed`, because `unreviewed` is "unknown" while `disputed` is "known to be problematic". | Human only. Not allowed in `import:candidates`. | "Resolve dispute" task |
| `deprecated` | Was once true / once accepted but is now superseded or no longer applicable. Soft delete — kept for graph history and lineage. | **Completely excluded** from gate scoring. Not counted in trusted, weak, or coverage tallies. UI hides by default. | Human only. Not allowed in `import:candidates`. | None |

The asymmetry between `unreviewed` and `disputed` is deliberate: rewarding `disputed` with the same 3/5 cap as `unreviewed` would create an incentive to mark uncertain claims `disputed` to "occupy a slot" while signalling caution. Capping `disputed` lower than `unreviewed` keeps the honest signal — "we looked and found a problem" — without letting it lift the score.

**Validation gate**:
A scoring procedure that answers predefined competency questions about a Product node using only local graph data. Must not consult the web, model memory, or external search at gate time. The agent-assisted online research/import workflow is a separate loop that runs *before* the gate.
_Avoid_: Gate, scorer (used informally — prefer the full term in docs).

**Node maturity**:
Per-node `maturityScore` (0–100) and `maturityLabel` (`unknown` … `mature` / `blocked`) representing **the maturity of that technology / capability / module / Product *in the world*** at a specific point in time. For a Product node, the answer to *"how mature is a product matching this architecture and target, commercially, *as of* a given date?"*. Always paired with **`maturityAsOf`** — an ISO date string (`YYYY-MM` precision in v0) marking when the assessment is valid. Required whenever any maturity field is set. **Slow-changing**: a prototype-stage product scores around 45–60 and stays there until the world changes, not as our model improves.

`maturityHistory` (optional array of `{asOf, score?, label?, source?}` entries) is reserved for the future time-slider feature. As of commit b28aa0c, 5 illustrative nodes carry seeded `maturityHistory` entries to support the static timeline stub on the product detail page; broader population is deferred until the time-slider lands. Outside those seeded nodes, agent and human re-assessments simply overwrite the scalar `maturityScore`/`maturityLabel`/`maturityAsOf` triple. When the time-slider lands, the current scalar becomes the latest entry in `maturityHistory` and earlier assessments populate the rest.

**Gate overall score**:
Per-run `overallScore` (0–5) produced by the **Validation gate**, computed as the average of competency-question scores. Measures **how well the local graph data supports answering competency questions about the target Product**, *not* how mature the Product is in the world. A gate overall of 5/5 means "the graph adequately answers our questions" — it does **not** mean the Product is mature. **Fast-changing**: lifts as we add evidence, fill metrics, expand frontiers; goal is to lift this without inflating Node maturity.

The two scales **interact at one point**: the gate's `estimated_maturity` competency question reads the target Product's `maturityScore` / `maturityLabel` and scores the question 0–5 based on supporting evidence and coverage. So Node maturity is one *input* to the gate, but the gate overall is mostly about evidence/coverage quality.

**Route** (legacy concept, *not used in v0 modelling*):
The schema's `has_route` relation remains, but **a Product is committed to a single fixed architecture**; alternative architectures are modelled as **sibling Product nodes under the same Capability**, not as Routes within one Product. The user's parcel-sorting Product (`low_cost_parcel_sorting_robot_300k_rmb`) is fixed to **vacuum suction** as the end-effector; the gripper variant is a separate sibling Product (`parcel_sorting_robot_with_gripper_300k_rmb`) deferred from v0 expansion. The `has_route` relation is preserved in the schema for possible future use (e.g., genuine intra-Product configurable variants if the modelling need ever appears) but should not be added to v0 data.

## Relationships

- A **Capability node** has one or more **Product nodes** as alternative ways to satisfy it. Boundary distinctions live at this layer.
- A **Product node** has zero or more **Routes** (inside its boundary) and recursively decomposes into modules, methods, materials, etc. Decomposition does not encounter boundary distinctions.
- The **Active v0 graph** is the recursive closure of one **Product node** under allowed relations.
- **Candidate records** are imported as `unreviewed`, then human-reviewed before they raise the **Validation gate** score.
- A **Decomposition frontier** marks where the agent-assisted import loop is expected to extend the graph next.
- A **Key technology** is a *property of a tech node*, not of a Product. Its main use is downstream (maturity scoring, bottleneck reasoning, gate scoring, what-if analysis), not boundary enforcement during decomposition.
- **Metrics** (cost, throughput, accuracy, range, etc.) are first-class `metric`-kind nodes attached via `measured_by` edges. Data-layer they are separate nodes; display-layer they fold into the parent node's visualization (compact metrics strip), so users see the parent's KPIs in-place rather than as orbiting bubbles. Shared metrics (multiple visible parents) revert to standalone rendering.
- **Cost rollup** evaluates both branches at every layer and returns `max(direct, children-sum × 1.15)` — never the smaller value (per ADR-0003 amendment 2026-05-10). A directly-known subsystem price is treated as a candidate alongside the bottom-up sum, not as a priority short-circuit; the larger of the two becomes the rolled-up estimate. Stop recursion at commodified leaves (per **Decomposition stop condition**), which carry their own cost metric. Costs are **range-valued** (`{min, typical, max}`) and accumulate via interval arithmetic. Multi-currency leaves carry a `currency` field; a project-level FX constant table (`scripts/fx-constants.ts`) converts to RMB at rollup. When direct < children-sum, the result carries a `directLowerThanChildren: true` flag that drives a ⚠ inversion badge in the UI — almost always a data-entry mistake (a parent should never be cheaper than its parts). **Leaf-cost data sources**, ranked by typical reliability: industry reports / standards (reviewed) → public market price databases (reviewed) → vendor catalogs (reviewed but auto-tagged `vendor_claim`, weak) → agent-imported online research (defaults `unreviewed`) → hand-set placeholders (`unreviewed`, low confidence). Agent-imported cost candidates must carry `evidenceIds`.

## Graph visualization conventions

Per the 2026-05-10 graph redesign (`docs/superpowers/specs/2026-05-10-graph-redesign.md`):

- **Two-stage exploration**: `/graph` is a state machine over `{stage: "overview" | "focused"}`. **Overview** = fitView the whole graph at zoom ~0.2–0.55; every card is in `.compact` mode (title + 14px heat block only). **Focused** = setCenter on the selected node at zoom 0.8 with full cards. Click any card to enter focused; ESC returns to overview. The "↩ Global view" toolbar button appears only in focused stage.
- **Color modes (`ColorModeSelect`)** — five values for the toolbar dropdown; the choice sets each edge's `style.stroke` to a tint derived from the *target node*:
  - `relation` — legacy class-based stroke (the original behaviour; default gray)
  - `cost` — blue → amber → red heat by typical RMB cost (normalized to 100k cap)
  - `maturity` — Likert mapping by `maturityLabel` (red for `hypothesis`, green for `commercially_available`)
  - `overall` — red → amber → green gradient by `maturityScore`
  - `bottleneck` — heat by `nodeRisk` = `(1 - maturityScore/100) × cost_share`; cost_share normalizes the node's rolled-up RMB against the graph's max. **Default mode** since "see the bottleneck path at a glance" is the primary user ask. Edges between two high-risk nodes (`risk ≥ 0.4`) get a +2 strokeWidth boost so the path stands out.
- **Compact-mode heat block**: in overview stage, each card's `::before` strip widens to 14px and shows the colorMode-tinted color. Gives a heat-map view of all 22 cards at fit-to-screen even when titles are illegible.
- **Layout**: positions come from a deterministic `explorationLayout({focusId, expandedIds, stage})` pre-order pass — not from ELK. Replaces the legacy ELK pipeline whose `incrementalLayout` was returning empty Maps. Pre-order means expanding a node pushes its later siblings strictly downward (predictable reflow).

## Example dialogue

> **Dev:** "Can a delta robot sorter be a **Route** of `low_cost_parcel_sorting_robot_300k_rmb`?"
> **Domain expert:** "No — delta and articulated arm have different **Key technologies** (the delta parallel-kinematics control problem is itself a key tech, separate from articulated-arm motion planning). It's a neighboring **Product node**."

> **Dev:** "What about an industrial arm with a slightly improved bearing supplier?"
> **Domain expert:** "Bearing improvements are incremental, not a **Key technology** swap. Same Product. Just a non-key variant."

> **Dev:** "Industrial arm + LiDAR profile sensing instead of camera CV?"
> **Domain expert:** "CV-based parcel pose recognition *is* a key technology — it's what unlocked the architecture. Swapping to LiDAR line-scan removes that key tech (LiDAR can't do pose recognition the same way). Different Product."

## Flagged ambiguities

- "Active scope" appears in code (e.g. `check:active-graph-scope`, `--allow-active-scope-expansion`) and means **Active v0 graph**. Code/CLI keeps the short form; docs prefer the full term.
- The plan's exclusion list (delta, humanoid, mobile, conveyor diverter, human-robot hybrid) is consistent with the **Key technology** principle but doesn't articulate it. The principle is canonical; the enumeration is a useful approximation. But the enumeration's job is *neighboring-Product distinction* (which sibling Product under `affordable_small_warehouse_automation` you're working in), not *decomposition gating*.
- The sibling Product candidates under `affordable_small_warehouse_automation` (`delta_robot_sorting`, `conveyor_diverter_sorting`, `mobile_robot_sorting`, `hybrid_human_robot_assisted_sorting`) were renamed in commit 3b392b3 to drop the legacy `_route` suffix; canonical term remains **neighboring Product candidate**. Older docs / ADR-0004 still reference the suffixed IDs for historical context; current data and references should use the suffix-free IDs.
