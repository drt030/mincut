# Commercial Portfolio v1 Readiness Plan

Updated: 2026-06-17.

Current acceptance comes from `docs/ACCEPTANCE.md` and `docs/QA-agent.md`.
Historical baseline notes below may mention grey/neutral nodes as audit
findings; they are not approval to render grey user-facing nodes.

This plan resets the launch definition from "AI compute page is live" to
"the product reads as a credible multi-domain chokepoint-map portfolio."
It is the execution contract for the next commercial-readiness pass.

## Goal

MinCut v1 should present a small portfolio of real research domains with
clear access states and a consistent free/paid boundary:

- AI compute: complete full-free flagship demo and trust proof.
- Parcel robot: complete full-free depth demo proving recursive
  decomposition.
- SpaceX reusable launch: primary hot-domain QA path and future paid/preview
  candidate until its access state is intentionally promoted.
- Humanoid robotics: primary hot-domain QA path and future paid/preview
  candidate until its graph, evidence, route, and gate state support a
  paid/live drop.

The graph pages must pass topology, visual-readability, and information
disclosure gates. A user must not see unclassified grey nodes, chaotic
primary lines, or a site that appears to contain only the AI compute chain.

## Initial Baseline Evidence

Checked against the pre-reset worktree on 2026-06-12:

- `src/lib/domains.ts` registers only `/d/ai-compute` and `/d/parcel-robot`.
- `data/nodes/humanoid_actuator.json` has a thin skeleton: one capability
  and three product nodes. `data/edges/humanoid_actuator_edges.json` links
  product -> capability with `enables`.
- Current active graph traversal walks outgoing edges from the root. Using
  `humanoid_robot_actuator_joint` as root returns only the capability node,
  so a humanoid capability-root route would render empty/incorrectly.
- Controlled fusion exists mainly in `data/nodes/test_products.json`,
  `data/edges/test_products_edges.json`, and
  `data/nodes/test_product_material_depth.json`. It is fixture-grade, not a
  registered domain.
- AI compute full-depth canvas, scoped at
  `ai_accelerator_module_hbm_cowos`, has about 85 structural nodes. Its grey
  nodes are material nodes.
- Parcel robot full-depth canvas, scoped at
  `low_cost_parcel_sorting_robot_300k_rmb`, has about 84 structural nodes.
  Four non-material grey nodes are `engineering_method` nodes:
  `gripper_tcp_pattern_calibration`,
  `servo_drive_motion_control_loop`,
  `servo_drive_thermal_emc_design`,
  `jam_detection_and_recovery`.
- Root cause for those parcel grey nodes: `filterCanvasGraph` treats
  `implemented_by -> know-how` edges as canvas tree edges, while
  `subsystemHue` classifies hue ancestry through `requires` only.
- `RadialEdge` already supports `primary` and `cross` edge kinds. Cross
  edges are hidden below detail zoom and dashed/low-opacity at detail zoom,
  but no real-data acceptance gate verifies whether the default viewport is
  visually readable.

## 2026-06-12 Implementation Snapshot

Historical snapshot after the 2026-06-12 reset pass. Re-run the route
registry, topology, and browser checks for current truth before using these
numbers in a QA report:

- `src/lib/domains.ts` now separates portfolio entries from live graph
  routes. `/d/ai-compute` and `/d/parcel-robot` are the only live routes.
  `humanoid-robotics` and `controlled-fusion` are portfolio entries only.
- AI compute is modeled as `full-free-flagship`; parcel robot is modeled as
  `full-free-depth-demo`; humanoid robotics and controlled fusion are live
  research routes but have been demoted to `audit-preview` until reviewed
  evidence, local gate reports, checkout, and entitlement checks support a
  paid-candidate promotion.
- `src/lib/subsystemHue.ts` now traces canvas colour ancestry through the
  same `implemented_by -> know-how` relation used by the canvas filter, so
  parcel engineering-method nodes no longer appear as unexplained grey
  structural nodes.
- `src/lib/graphTopologyAudit.ts` and
  `scripts/check-graph-topology.ts` provide the route-level topology
  verifier. `npm run check:graph-ux` now runs both the static UX checks and
  this topology gate.
- Latest topology gate output:
  - AI compute: 85 structural nodes, 7 neutral material nodes, 0 neutral
    non-material nodes, 84 primary edges, 9 cross edges.
  - Parcel robot: 84 structural nodes, 0 neutral material nodes, 0 neutral
    non-material nodes, 84 primary edges, 4 cross edges.
- Detail reader panels now lead with industrial importance, then the stuck
  point, current evidence/signal, supplier/ticker quick path, and deeper
  details behind disclosures.
- Non-US ticker chips now add venue labels such as `000660.KS · Korea`,
  `688211.SS · Shanghai`, and `ABBN.SW · SIX Swiss`.
- Mobile route pages render the route/detail rail before the dense graph
  canvas, and the layer toggle is static in mobile flow so it does not cover
  first-screen detail text.
- AI compute overview edges are capped in mid-zoom: ordinary high-risk edges
  no longer render at raw 7px risk widths, and branch emphasis is reduced in
  overview. Screenshot/DOM check after the fix reported 0 red edges wider
  than 2.5px on the AI compute detail desktop view.

## Non-Negotiable Acceptance Gates

### 1. Portfolio IA Gate

The landing page, header/domain switcher, and route cards must expose a
portfolio, not a single-chain product.

Required route states:

| Domain | Required state | Meaning |
| --- | --- | --- |
| AI compute | `full-free flagship` | Complete graph, suppliers, tickers, evidence, and gate context visible without unlock. |
| Parcel robot | `full-free depth demo` | Complete graph and exposure visible without unlock; secondary to AI compute. |
| SpaceX reusable launch | `preview`, `audit-preview`, or paid/future-paid candidate until promoted | Primary hot-domain QA path; access state must match graph/evidence/readiness. |
| Humanoid robotics | `preview`, `audit-preview`, or paid/future-paid candidate until promoted | Primary hot-domain QA path; access state must match graph/evidence/readiness. |

Done means a first-time retail/investing reader can answer:

1. What can I explore now for free?
2. What future domains might be paid?
3. Which domains are not ready yet?
4. What signal or review work is needed before a domain becomes live?

### 2. Domain Promotion Gate

A domain may be registered as a live `/d/<slug>` route only after all of the
following are true:

- Product boundary is explicit: product/capability, target user/context,
  architecture, cost/performance target where relevant, and neighboring
  products kept separate.
- Root traversal returns a meaningful canvas and detail rail for the intended
  root. Capability roots must include inbound `enables` products or use an
  explicit route root model.
- Graph has at least one useful decomposition layer beyond first-level
  modules for the maturity-sensitive or bottleneck-sensitive branch.
- Evidence and review status are honest. Agent-generated records remain
  `unreviewed`; human-reviewed claims are flipped only by the owner.
- Gate dry-run has been executed and its gaps are acceptable for the route
  state being advertised.
- Route copy states `live`, `preview`, `waitlist`, or `paid candidate`
  truthfully.
- No paid route is promoted until Stripe env, entitlement mapping, leak
  checks, and post-checkout smoke exist for that exact domain.

### 3. Graph Topology Gate

Every domain graph used in a user-facing route must satisfy:

- Visible user-facing grey/unclassified nodes in the default canvas equal
  zero. This includes material nodes; if a node cannot receive a meaningful
  color family, hide it from the primary graph or move it to a secondary
  surface until its display semantics are defined.
- Canvas tree semantics and color ancestry semantics agree on relation set.
  Know-how should stay hidden from the default artifact map and appear only
  in the Barrier Sources layer or detail panel. If a secondary layer renders
  know-how, artifact context must keep a meaningful subsystem color family.
- Every multi-parent visible canvas node has exactly one primary layout
  parent.
- Secondary parent edges must not affect node position. They render only as
  low-opacity context lines, preferably hidden in overview and dashed at
  detail zoom.
- A verifier reports primary/cross counts and lists all non-material neutral
  nodes by route.

### 4. Visual Readability Gate

Automated graph checks are not enough. Each route must pass fresh visual
review on the actual rendered page.

Reviewer prompt:

> You are seeing this page for the first time as a retail investor or
> industry researcher. In the first 10 seconds, can you identify the main
> chain, the top bottleneck, where supplier/ticker information lives, and
> where evidence lives? List the first three places your attention goes and
> whether that matches the intended reading order.

Pass criteria:

- Main chain and selected node are visually obvious.
- Primary edges read as structure; secondary/cross edges read as context.
- Visual emphasis does not reward internal metadata over user questions.
- No dense grey cluster or edge bundle dominates the default viewport.
- Mobile route still offers a usable rail-first fallback when the canvas is
  too dense.

### 5. Detail Disclosure Gate

Node detail first screen must follow the expected investor/research logic:

1. Why this node matters.
2. What is stuck or scarce.
3. Key factors and evidence.
4. Supplier/ticker exposure.
5. Deeper technical detail behind disclosure controls.

Internal metadata is secondary. Heat, bottleneck role, review state, raw tags,
domain tags, kind, and exhaustive upstream/downstream lists may appear only
when they serve the current question or are tucked behind progressive
disclosure.

### 6. Reviewer Separation Gate

No worker may be its own final judge.

Minimum roles per substantial slice:

- Implementer or data worker.
- Consumer reviewer: validates whether the route answers likely retail
  investor questions.
- Attention reviewer: validates first-glance attention, visual hierarchy, and
  information overload.
- Graph-topology reviewer: validates primary parents, neutral nodes, and
  cross-edge behavior.

Reviewers rotate. Reusing the same reviewer for repeated sign-off is not
allowed when the prior review already influenced implementation.

## Execution Tasks

### Task A: Topology Contract and Verifier

Status: implemented for current live routes on 2026-06-12. Keep this task
open for any new domain promoted to a live graph route.

Owner surface:

- `src/lib/radialLayout.ts`
- `src/lib/subsystemHue.ts`
- `src/lib/canvasGraph.ts`
- `scripts/check-graph-ux.mjs` or a new focused verifier
- `tests/radialLayout.test.ts`
- `tests/subsystemHue.test.ts`

Deliverables:

- Decide and document the canvas relation set for color ancestry.
- Eliminate user-facing grey/unclassified graph nodes by assigning meaningful
  display semantics or moving unsuitable records out of the primary map.
- Add an automated route-level verifier that reports:
  - structural node count
  - neutral/material audit buckets when useful for debugging
  - any user-facing grey/unclassified node ids
  - primary edge count
  - cross edge count
  - multi-parent visible nodes and chosen primary parent
- Ensure cross edges never drive layout.

Validation:

- `npm run check:graph-ux`
- `npm run check:graph-topology`
- focused tests for layout/hue
- verifier output for `/d/ai-compute`, `/d/spacex-reusable-launch`,
  `/d/humanoid-robotics`, and `/d/parcel-robot` when the regression graph is relevant

### Task B: Portfolio IA and Route States

Status: implemented for the current portfolio surface on 2026-06-12.

Owner surface:

- `src/lib/domains.ts`
- `src/components/LandingContent.tsx`
- `src/components/AppHeader.tsx`
- `src/components/ExposureAccessBanner.tsx`
- `src/components/RouteDetailRail.tsx`
- `src/components/LanguageProvider.tsx`
- route/landing tests

Deliverables:

- Add explicit route state metadata such as `full-free-flagship`,
  `full-free-depth-demo`, `waitlist`, `preview`, and `paid-candidate`.
- Landing page and header show the portfolio states without implying
  SpaceX reusable launch or humanoid robotics are paid/live before their
  access states intentionally say so.
- Future paid copy ties monetization to verified living maps, updates, and
  curated exposure for under-disclosed domains.
- AI compute remains free everywhere.

Validation:

- landing/header route tests
- browser smoke on `/`, `/d/ai-compute`, `/d/spacex-reusable-launch`,
  `/d/humanoid-robotics`, and `/d/parcel-robot` when the regression graph is relevant
- copy grep: no AI-compute paid checkout language

### Task C: Humanoid Robotics Readiness Audit

Owner surface:

- `docs/agents/humanoid-decomposition-brief.md`
- current humanoid domain node/edge/evidence files
- `src/lib/graphTraversal.ts`
- `src/lib/domains.ts`

Deliverables:

- Confirm the current whole-robot root model and product boundary.
- Identify missing decomposition and evidence needed before preview/live.
- Do not register as live paid until the promotion gate passes.
- If shown before ready, show as waitlist/researching with the missing pieces.

Validation:

- route-scope test proving humanoid route does not render a one-node graph
- data validation
- gate dry-run if/when promoted beyond waitlist

### Task D: Future Controlled Fusion Readiness Audit

Owner surface:

- `data/nodes/test_products.json`
- `data/edges/test_products_edges.json`
- `data/nodes/test_product_material_depth.json`
- `data/evidence/test_products_evidence.json`
- future formal fusion domain files

Deliverables:

- Decide whether controlled fusion should start as:
  - tokamak commercial power plant,
  - broader controlled-fusion capability, or
  - another bounded architecture.
- Move only validated, launch-appropriate data out of test fixtures into
  formal domain files.
- Define the minimum evidence/review/gate bar for preview state.
- This is not a primary 2026-06-17 QA path unless the owner promotes it.
- Keep route as waitlist if fixture-grade data remains the source.

Validation:

- no user-facing route reads directly from fixture-grade assumptions without
  explicit preview/researching state
- data validation
- gate dry-run once formalized

### Task E: Detail Disclosure Audit

Status: implemented for the current route rail and detail panels on
2026-06-12; still requires final fresh reviewer sign-off after the visual
edge-weight fix.

Owner surface:

- `src/components/NodeDetailPanel.tsx`
- `src/components/RouteDetailRail.tsx`
- `src/components/ProductView.tsx`
- detail/rail tests

Deliverables:

- Preserve the launch order:
  why important -> what is stuck -> evidence/factors -> supplier/ticker ->
  deeper details.
- Hide or demote internal tags, raw score fields, and exhaustive relation
  lists.
- Add tests that pin first-screen priority labels and tab order.

Validation:

- focused component tests
- browser read-order smoke for AI compute, SpaceX reusable launch, humanoid robotics,
  and parcel when the regression graph is relevant
- screenshot/DOM smoke confirming mobile rail-first and no first-screen
  floating-control overlap

### Task F: Fresh Review Rounds

Run after Tasks A-E land.

Status: in progress. Fresh reviewer `Hooke` failed the page after the first
implementation pass because AI compute still looked like an internal
debug graph and the thesis started with graph/evidence bookkeeping. The
follow-up fix reduced overview risk-edge dominance and rewrote the thesis to
lead with industrial importance. A fresh reviewer must re-check after this
fix before commercial v1 can be called passed.

Reviewers:

- Consumer reviewer for retail/investor questions.
- Attention reviewer for visual hierarchy.
- Graph-topology reviewer for unclassified/grey nodes, primary/cross edges, and root
  traversal.

Acceptance:

- Each reviewer receives the current rendered route, not implementation
  notes.
- Findings are fixed or explicitly waived by the owner.
- A fresh reviewer signs off after material changes.

## Suggested Sequencing

1. Task A first. Topology and verifier are prerequisites for judging visual
   quality.
2. Task B in parallel with Task A if file ownership is controlled.
3. Task C and Task D as separate research-readiness audits. Do not rush them
   into live routes.
4. Task E after Task B, because route state copy influences detail disclosure.
5. Task F after implementation slices, with fresh reviewers.

## Definition of Done

The commercial portfolio v1 goal is complete only when:

- `docs/plans/MASTER-PLAN.md` points to this readiness plan.
- Product UI clearly presents AI compute, parcel robot, SpaceX reusable launch,
  and humanoid robotics with truthful access states.
- AI compute and parcel remain complete free demos.
- SpaceX reusable launch and humanoid robotics have honest preview/audit-preview states, or are promoted only
  after the domain promotion gate passes.
- Route-level graph verifier passes with no user-facing grey/unclassified
  nodes.
- `npm run check:graph-topology` passes for every live domain route.
- Multi-parent layout reports exactly one primary parent per visible shared
  node and context-only secondary edges.
- Fresh reviewers pass consumer, attention, and topology checks.
- `npm run verify`, `npm run validate:data`, and relevant gate dry-runs pass
  or have documented non-blocking warnings.
