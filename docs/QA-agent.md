# QA Agent

## Purpose

The QA agent is an intelligent, adversarial product reviewer for this repo. Its job is to decide whether the current local application is ready to be shown, sold, or held back, not whether a fixed checklist happens to pass.

The commercial audience is public-market retail investors who want to learn a hot industrial chain, understand bottlenecks, and discover company/ticker diligence leads. The product promise is not "stock picks." It is:

- Free: learn the industrial chain, product decomposition, chokepoints, evidence trail, Barrier, and Cost context.
- Paid or future paid: inspect company, supplier, ticker, and exposure leads tied to the bottlenecks.
- Trust demo: AI compute may expose the full company/ticker layer for free so users can judge the method before paying elsewhere.

The agent should behave like a strict first-time retail investor, industry researcher, and product owner combined:

- It reads the current repo goals before judging the product.
- It derives its own test plan from the current docs, code, data, and UI.
- It uses the running website like a real user.
- It reports user experience, commercial promise, investment-insight credibility, data/modeling gaps, paywall risks, bugs, and improvement opportunities.
- It is allowed to be critical. A vague "looks good" report is a failed QA run.

This document is the source-of-truth prompt/runbook for any Codex, Claude, or browser-capable agent asked to perform QA on MinCut. The acceptance contract itself lives in `docs/ACCEPTANCE.md`.

## Non-Goals

The QA agent is not a fixed browser script.

Do not reduce QA to a hard-coded list of selectors, page paths, or button clicks. The repo changes quickly, and the QA agent must adapt by reading the current product intent and inspecting the actual UI.

The QA agent is not responsible for implementing fixes unless the user explicitly asks it to. Its default output is a rigorous assessment.

The QA agent must not add new product domains, broaden the v0 boundary, or invent graph facts while testing.

The QA agent must not turn the product into unqualified investment advice. During QA, company/ticker content should be judged as diligence leads or exposure candidates, not buy/sell/hold recommendations.

The QA agent must not hide the paid/free boundary from the report. The boundary can be presented gently in the UI, but QA must verify that users are not surprised by a paywall and are not misled about what is free.

## Required Inputs

Before testing, read the current project surfaces:

- `docs/ACCEPTANCE.md` — **the authoritative acceptance standard.** §3 is the rubric you judge against; §5 is how your verdict maps to the Master decision. This QA doc is the *how-to-run*; `ACCEPTANCE.md` is *what counts as pass*.
- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`
- `docs/GRAPH_UX.md`
- `docs/NODE_EXPANSION.md`
- `docs/plans/parcel-sorting-robot-v0.md`
- `docs/plans/commercial-portfolio-v1-readiness.md`
- `package.json`

Then inspect any files needed to understand the current behavior:

- `src/app/**`
- `src/components/**`
- `src/lib/**`
- `data/nodes/**`
- `data/edges/**`
- `data/evidence/**`
- `data/tasks/pending_tasks.json`
- `data/gate_questions/default_product_questions.json`

Do not assume these files are unchanged from memory. Read them from the workspace.

## Feedback Coverage Preflight

Whenever a user reports a product, graph, commercial, or QA defect, run this as a **blocking preflight before product implementation**. The goal is to improve the acceptance net first, then fix the concrete bug.

1. Restate the reported failure in user-facing terms, including the route, language, node, lens, viewport, or interaction if known.
2. Map the failure to `docs/ACCEPTANCE.md` §3 and the relevant gate below. Classify coverage as:
   - `covered`: an existing rule names the same user-visible failure mode closely enough that a future QA run would know to test it;
   - `partial`: the docs contain broad adjacent language, but not the concrete failure mode or required reproduction scope;
   - `missing`: no rule would reliably make an agent test or report this class of issue.
3. Do not treat broad generic language as enough. A rule like "graph must be readable" is not sufficient coverage for a specific defect such as arrow endpoints floating away from nodes, unexplained numeric badges, non-chokepoints appearing in a Key chokepoints list, or evidence gaps being phrased as a confirmed bottleneck.
4. If coverage is `covered`, cite the exact section/bullet in the implementation notes and add or run a focused regression check where a reasonable seam exists. If no automated seam exists, define the targeted browser acceptance step that must be rerun.
5. If coverage is `partial` or `missing`, update `docs/QA-agent.md`, `docs/ACCEPTANCE.md`, or the relevant machine/test gate first. The product fix starts only after the acceptance delta is explicit.
6. For any QA miss, run an independent QA replay against the affected page/surface with the current QA docs before the product fix. The replay prompt must not include the user's exact symptom list; it should ask the QA agent to run this runbook and report what it independently finds.
7. Compare the replay findings with the user's reported failures. If any failure class is absent, improve this runbook, `docs/ACCEPTANCE.md`, `docs/agents/acceptance-judge-prompt.md`, or the relevant machine/test gate, then rerun an independent replay. Repeat until the replay independently reports the failure class, or document the concrete blocker that prevents replay.
8. The final handoff for a product-facing fix must include an "Acceptance coverage" line naming the existing rule or the doc/test update that now catches the issue, plus the independent replay result.

For the current graph/detail class of defects, QA must explicitly distinguish:

- visual edge geometry failures from graph-topology failures;
- numeric canvas badges from ranks, evidence counts, and hidden Barrier-source counts;
- a modeled supplier/holder coverage gap from a confirmed industry supply absence;
- a nonzero modeled holder count from a sourced sole-source / exclusivity claim; `holdersForNode` counts alone are coverage, not proof that only one supplier exists;
- top Chokepoints from non-top candidate constraints or ordinary decomposition nodes;
- weak evidence disclosure from the actual bottleneck reason.
- missing relief-cycle or supplier commercial-scale data from a legitimate low-confidence proxy estimate; blank / omitted first-glance data is a failure, while an explicitly labeled proxy estimate is an acceptable temporary data-quality state.
- structural-node cost-scale / capex proxy from broad market size, TAM, revenue, or supplier commercial scale. Detail tiles and Cost-lens copy should not make users think an authored fab capex or BOM proxy is the same thing as market size.
- reader-facing estimated / typical numeric values from internal percentile notation; `P50` / `p50` in UI, gate reports, product readouts, route rails, or detail panels is a failure. English should use reader labels such as `est.`; Chinese should use `估算` or `约`.
- parent/child scale consistency from mere value presence: structural cost-scale should roll up from direct structural children, relief / mitigation cycle should be at least the max of direct structural children, and low-confidence child cost estimates should be bounded by a direct authored parent cost/capex value when no better child source exists. A parent with a smaller authored or displayed value is still a failure even when every node has a nonblank value.
- selected-node `Decomposition` / `结构拆解` quality from mere presence: the QA agent must inspect the heading, count line, summary sentence, and at least two child rows. A block that repeats framework copy like "direct modules", "the parent needs these dependencies", or "each child can carry suppliers/evidence/bottlenecks/cost/lower layers" without naming the current node's actual system boundary or mechanism is a failure even if the child rows exist.

Current AI compute feedback replay classes that must be covered until fixed:

- primary edge curves/endpoints around the AI accelerator module look decorative, detached, or point ambiguously away from their source/target nodes;
- numeric badges on default graph nodes lack an inspectable explanation;
- `substrate_and_interposer` / package substrate & interposer and similar authored bottleneck nodes phrase missing holder coverage as "supply source unverified" or as the bottleneck itself;
- node-detail "why it matters" copy is generic, e.g. only says that route scale depends on the constraint without naming the concrete mechanism, holder, process, capacity, material, equipment, lead time, or routing dependency;
- non-top or ordinary dependency nodes appear in the same "Key Chokepoints" / "具体卡点" treatment as confirmed top Chokepoints;
- weak/thin evidence is surfaced as the concrete "Where it is stuck" / "具体卡点" reason instead of as an evidence limitation.
- selected-node `Decomposition` / `结构拆解` repeats generic framework text such as direct-module counts or "the parent needs these dependencies" across nodes instead of explaining the current node's actual decomposition boundary and child mechanisms.
- node-detail core readouts or supplier/company cards silently omit relief timing, supplier commercial scale, market-share / revenue / capacity clues, or a labeled proxy estimate when direct data is not yet sourced.
- structural node detail calls a cost/capex proxy broad "commercial scale" or "market size" instead of naming the cost-scale basis.
- structural parent nodes show cost-scale or relief-cycle readouts that are lower/shorter than the direct child nodes they decompose into; QA should inspect at least one expanded decomposition path when reviewing these fields, not only the selected node's own tile.
- a child structural node with no sourced cost/capex value shows a low-confidence estimate that visibly exceeds or overfills a direct authored parent cost/capex value instead of being parent-bounded or flagged.
- saved node-detail sample screens add standalone internal model diagnostics, such as a visible "Chokepoint axes" / "卡点四轴" grid, to the primary reader path instead of keeping that breakdown in explicit drill-in or supplementary surfaces.
- node-detail or route-detail Concentration copy renders a nonzero holder count as "only / sole / exclusive / 仅 / 唯一" when the graph only provides modeled `manufactured_by` / `implemented_by` holder coverage and no explicit ADR-0009-grade sole-source claim.
- system overview / route-default rail copy sounds like a generic framework summary rather than a concrete system read; per `docs/ACCEPTANCE.md` §3c it must include `System target`, `Production path`, `Constraint mechanism`, `Improvement path`, `Industry-chain impact`, `Main risks`, and `Evidence support`, with each row grounded in the current graph and useful to the investor/researcher audience.
- commercial route pages spend seconds before first render because the server recomputes the global packed graph layout on normal user requests instead of loading current generated layout artifacts; `npm run check:graph-layouts` must catch missing or stale artifacts.

## Feedback-Driven QA Replay Loop

Use this loop whenever a user points out a failure the QA process should have caught.

1. **Baseline replay:** send a fresh independent QA agent to the affected URL, route, language, viewport, or workflow. Provide the current QA/acceptance docs and the page/surface, but do not include the user's exact failure list.
2. **Coverage diff:** compare the independent report to the user's feedback by failure class, not exact wording. Mark each class as `found`, `missed`, or `not assessable`.
3. **Improve the net:** for every `missed` or unjustified `not assessable` class, update the most durable layer first:
   - `docs/ACCEPTANCE.md` for product contract language;
   - this runbook for browser/inspection behavior;
   - `docs/agents/acceptance-judge-prompt.md` for delegated judge prompts;
   - a machine/test gate when the failure can be checked deterministically.
4. **Replay again:** run a new independent QA replay after the acceptance update. Do not reuse the same agent's context if that context already contains the user's full symptom list.
5. **Stop condition:** proceed to product implementation only when the replay reports the failure class, or when the handoff states a concrete blocker and the exact manual acceptance step that remains.

The goal is not to prove the main agent remembered the feedback. The goal is to make the QA agent capable of actively discovering the problem from the product and the acceptance contract.

## Current QA Target

The graph model still has a v0 internal/development target:

```text
low_cost_parcel_sorting_robot_300k_rmb
```

This means the concrete 300,000 RMB parcel-sorting product currently intended by the repo: an industrial robot-arm and computer-vision based sorting robot/cell using a vacuum-suction end-effector.

The QA agent must protect this product boundary. Delta robot sorters, humanoid sorters, conveyor diverter-only systems, mobile sorting robots, and human-robot assisted systems are neighboring products unless the user explicitly changes the boundary.

Commercial QA is broader than the internal parcel-robot development target. For commercial paid-readiness and investor-facing QA, use these primary user-facing domains unless the user requests otherwise:

- AI compute: full-free trust demo, including company/ticker exposure.
- SpaceX reusable launch: hot-topic route and likely paid/future-paid exposure surface.
- Humanoid robotics: hot-topic route and likely paid/future-paid exposure surface.

Parcel robot is primarily a development/regression graph. Test it for data model, gate, graph UI, and boundary regressions, but do not treat it as the main commercial user journey unless it is explicitly promoted.

## QA Mindset

Be strict, specific, and evidence-driven.

The QA agent should ask:

- Can a new user understand what this tool is for within the first minute?
- Can a retail investor understand that the free layer teaches the chain, while company/ticker exposure may be paid outside the free AI-compute demo?
- Does the UI avoid promising buy/sell advice, guaranteed returns, or "definitely undervalued" conclusions?
- Can a researcher inspect the product graph, dependencies, evidence, Chokepoint, Barrier, Cost, gate output, and follow-up tasks?
- Does the UI make the graph useful as a reasoning substrate, or is it only a visualization?
- Does the data model preserve product boundaries, evidence status, and recursive decomposition?
- Are company/ticker leads tied to actual bottleneck, component, process, material, organization, or know-how graph records?
- Are paid, free, waitlist, preview, audit-preview, and paid-candidate states honest?
- Do gate results expose real gaps instead of implying unsupported confidence?
- Does the Chinese/English UI work well enough for the same research tasks?
- Are serious gaps visible to the user, or hidden in local JSON and docs?
- Would a user trust this tool after trying to answer a real research question?

Do not give credit for intentions that are only described in docs but not visible in the product.

## Dynamic Test Planning

Before interacting with the UI, produce a short private test plan from the current repo state.

The plan should include:

- The product promises the app currently makes.
- The free learning journey, paid company/ticker journey, and trust-demo journey that should exist.
- The highest-risk areas based on recent files and docs.
- What automated checks are relevant.
- What browser interactions are necessary.
- What would count as blocker, major, minor, and improvement-only findings.

The plan must be updated if the live app contradicts the docs or exposes unexpected behavior.

## Automated Evidence

Run the relevant commands when possible:

```bash
npm run validate:data
npm run check:active-graph-scope
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
npm run check:graph-ux
npm run lint
npm run build
npm test
```

For broad QA, prefer running all of them. If a command is skipped, explain why.

Automated checks are evidence, not a substitute for user testing. Passing build and lint does not mean the app is usable.

## Commercial QA Gates

The QA agent must use a real browser or browser automation when available. It should start from a clean dev server or a known-good running URL.

Test as a user trying to answer real questions, not as a script trying to satisfy selectors.

Run the following paid-launch gates for broad commercial QA. For smaller changes, run only the affected gates and state what was not tested.

### Gate 1: Commercial Promise And Paid Boundary

Target question: Can a retail investor understand the value proposition without feeling tricked by the paywall?

Required paths:

- `/`
- `/d/ai-compute`
- one future-paid or audit-preview route, preferably `/d/spacex-reusable-launch` or `/d/humanoid-robotics`
- English and Simplified Chinese first screens
- one desktop viewport and one mobile-ish viewport

Acceptance checks:

- The first screen communicates industrial-chain bottleneck research and company/ticker diligence leads without requiring docs.
- The map portfolio entry is continuous across `/` and every `/d/<slug>` route: after switching domains, the same map switcher remains visible/reachable, marks the current domain, and offers a clear route back to the default AI compute map.
- The map portfolio has one clear interaction model: compact domain shortcuts are direct quick-switch controls, while the full domain menu opens only from the `Maps` trigger. Hovering a shortcut may show a small label tooltip, but it must not open the full menu or create ambiguity about whether users should click the shortcut or a duplicate expanded card.
- The free layer is valuable on its own: chain decomposition, chokepoints, evidence summary, Cost/Barrier context, and navigation are usable.
- The paid layer is visible as a product boundary, but not presented as a hard-sell trap. Users should understand before clicking that company/ticker exposure may be paid outside the free AI-compute demo.
- AI compute is clearly marked as a full-free trust demo when applicable.
- The copy avoids buy/sell/hold language, guaranteed returns, "definitely undervalued" claims, or implied insider knowledge.
- Disclaimers are visible enough for a public-market retail audience.
- Before checkout, the buyer can reach a purchase/support policy that states the one-time price, current included collection, no automatic renewal or promised update schedule, refund window, contact and access-recovery path, payment/usage-data handling, and non-investment-advice boundary.
- The $9 collection distinguishes bundle role from research maturity: Humanoid and reusable launch are core maps, controlled fusion is an early-research add-on, orbital data center is a hypothesis-map add-on, and AI compute remains fully free. `core` must not be read as an evidence grade.
- Any `audit-preview` included in the current snapshot keeps its maturity label at the homepage offer, route entry, and after unlock. A route with only a legacy entitlement but no explicit `allAccessRole` cannot show checkout.

Hard fails:

- A paid CTA appears for a route whose data, evidence, checkout, or entitlement path is not ready.
- The user discovers the paid boundary only after being surprised by a locked company/ticker action.
- The first screen does not explain the investment-research value.
- Chinese mode makes the commercial promise or paid/free boundary unreadable.
- A paid checkout is offered without a reachable purchase/support policy, or the policy contradicts the checkout price, access scope, renewal, or refund terms.
- The offer hides an early-research/hypothesis maturity label, or an entitlement silently makes an unlisted route purchasable.

### Gate 2: Paid Insight Trust

Target question: Are company, supplier, and ticker leads credible enough to sell as diligence leads?

Required paths:

- Pick at least three top bottleneck nodes across AI compute and the current paid/future-paid candidate domains.
- For each node, open the company/supplier/ticker path.
- Inspect the linked graph edges, evidence, review status, and limitations for the top company leads.
- If a route is locked, verify that locked names/tickers do not leak through free HTML, visible UI, or obvious API output.

Acceptance checks:

- Every surfaced company/ticker lead is tied to a concrete graph node such as a bottleneck, component, process, material, equipment, organization, supplier, or know-how holder.
- The UI states the relationship type: direct supplier, equipment vendor, material supplier, capacity holder, customer exposure, indirect exposure, alternative route, or candidate needing verification.
- The UI gives a concise investment-research logic for the lead: scarcity, technical barrier, capacity constraint, switching cost, customer exposure, replacement difficulty, or supply-chain fragility.
- The UI states why the lead might be wrong or less actionable: weak evidence, revenue exposure too small, valuation already priced in, unverified supply relation, cyclicality, policy risk, or route uncertainty.
- Review status and source strength are visible and not inflated. Agent-generated records stay unreviewed unless owner-reviewed.
- Supplier/ticker leads are described as diligence leads or exposure candidates, never as direct investment advice.
- Paid snapshot membership does not exempt a relationship from evidence disclosure: active supplier relations need linked support or must be removed from the surfaced paid layer; owner review is not required for every lead when unreviewed/source-checked status and limitations are explicit.

Hard fails:

- A company/ticker lead has no clear graph path to the bottleneck or product route.
- Evidence supports only that the company exists, not that it is connected to the surfaced bottleneck.
- Free users can see locked company/ticker identities for a paid route.
- Unreviewed, vendor-only, or internal-note claims are presented as established facts.
- Gate, route, or evidence traversal mixes unrelated domains into the current paid insight.

### Gate 3: System Overview Read Quality

Target question: Does the route-default system overview tell a first-time
investor/researcher how this product system works, where the system-level
constraint sits, what improves the product, what commercial chain positions
matter, and what current evidence supports?

Required paths:

- `/d/ai-compute` before selecting any graph node, then after clicking blank
  canvas if that returns to a system overview.
- At least one other commercial domain overview when present, preferably
  `/d/spacex-reusable-launch` or `/d/humanoid-robotics`.
- Chinese first, then English if the route has localized overview copy.

Acceptance checks:

- The overview is visibly different from selected-node detail. It must not show
  duplicate node-detail sections or a "Start here" / "从这里开始" card as a peer
  selected-node state.
- The overview follows `docs/ACCEPTANCE.md` §3c: `System target`,
  `Production path`, `Constraint mechanism`, `Improvement path`,
  `Industry-chain impact`, `Main risks`, and `Evidence support`.
- The seven rows sit directly under the system overview thesis. A visible
  intermediate label such as `System read`, `System layer`, `系统读法`, or `系统层`
  is unnecessary and should be removed unless it carries new reader value.
- The row contract should not be wrapped in a separate bordered card below the
  `System overview` heading. Fail outer card borders, accent stripes, or nested
  card framing around the overview rows; light row separators inside the table
  are acceptable.
- The overview should not add a separate 2x2 core readout that repeats the
  graph or the `System read` table. If a compact tile board appears above the
  table, it must provide a new decision layer; otherwise fail it as duplicated
  first-screen space.
- Each row gets a 0/1/2 score:
  - `0`: generic, tautological, unsupported, or row role is missing.
  - `1`: directionally right but missing a concrete system object, causal
    mechanism, observable signal, or decision implication.
  - `2`: specific to this system, graph-grounded, concise, useful, and still at
    system level.
- Any row without a causal mechanism or decision implication is capped at `1`.
- Any row that can be reused unchanged for a different domain is capped at `1`.
- Any row that merely restates TOC/MinCut/SWOT/value-chain language is capped at
  `0.5` and should be reported as a fail if it affects comprehension.
- `Improvement path` must directly state the current system-level improvement
  direction. It cannot merely say "improve the bottleneck" or "increase the
  shortest resource."
- `Industry-chain impact` must serve the commercial audience by identifying
  affected chain positions or exposure surfaces such as component classes,
  capacity holders, equipment/material tiers, or service providers. Do not turn
  this into buy/sell advice.
- `Evidence support` must state what current evidence supports. It must not
  expose internal owner/QA defects such as "needs evidence", "still missing",
  or "not ready"; if the evidence is insufficient for a reader-facing claim,
  the claim should not ship.
- Judge every visible piece of overview text, not only table body rows. This
  includes small section meta labels, badges, eyebrow text, helper text, tile
  labels, and button/CTA copy. Framework or internal labels in those small
  surfaces still count as reader-facing failures.
- Check grounding priority before accepting a row:
  active reviewed or machine-verified evidence first; active graph structure
  and reviewed node descriptions second; unreviewed graph claims only for
  conservative structural wording; never deprecated/failed/dead-source evidence
  for reader-facing overview claims.
- If several direct bottlenecks jointly constrain throughput, allow a coupled
  constraint / coupled improvement path. Do not force a single top chokepoint
  unless the graph and active evidence clearly support the ranking.
- `Improvement path` must name both the constrained system area and the
  improvement mode: capacity expansion, yield/test improvement, qualification
  of additional suppliers/routes, second-source ramp, substitution, or
  integration throughput.
- `Industry-chain impact` must separate supported commercial claims from
  diligence focus. "Orders", "pricing power", "capex", "share", or "company
  exposure" language requires active evidence for that chain position. Without
  that support, write the impact as a diligence focus rather than a commercial
  outcome claim.
- Judge grouped commercial outcomes per chain position and per outcome. If a
  sentence says several positions will gain orders, pricing power, and capex,
  each position/outcome pairing needs evidence; otherwise cap the row at `1`
  and report the unsupported commercial certainty.
- `Evidence support` may not include UI placement or navigation wording such as
  "shown in node detail", "click through", "展开", or "see supplier cards".
- Row score totals do not cancel hard failures. If one row contains valid
  content plus a forbidden tail, score the useful part at most `1` for reuse,
  mark the surface failed, and require the forbidden text to be removed before
  acceptance.

Hard fails:

- Missing `Production path`, `Improvement path`, `Industry-chain impact`, or
  `Evidence support`.
- Reader-facing overview uses internal jargon such as `MinCut`, raw four-axis
  diagnostics, or UI instructions.
- Reader-facing overview uses framework labels such as `TOC lens` or other
  methodology badges that explain the framework instead of the system.
- The overview is a navigation list, supplier/ticker list, or node-detail
  substitute instead of a system-level read.
- The overview names companies, tickers, costs, cycles, shares, or capacity
  numbers that are not supported by the graph/evidence and allowed by the route
  access state.
- The overview relies on deprecated, failed, dead-source, or rejected evidence.
- `Evidence support` describes where information will be shown instead of what
  current evidence supports.
- The total row score is below 12/14, or any required row scores `0`.

### Gate 3A: Graph Map Interaction And Readability

Target question: Can users read and manipulate the map as a research surface rather than a decorative graph?

Required commercial paths:

- `/d/ai-compute`
- `/d/spacex-reusable-launch`
- `/d/humanoid-robotics`

Internal regression path:

- `/d/parcel-robot` or `/graph`, when graph data/gate/layout changes could affect the development target.

Acceptance checks:

- The root and main branches are visible in the first desktop viewport.
- The default map is an artifact map: visible nodes should be products, routes, modules, equipment, and key materials. Organization, metric, evidence, and context records must not appear as ordinary graph nodes.
- Know-how nodes (`engineering_method`, `manufacturing_process`) are hidden from the default map unless the tested surface is explicitly a Barrier Sources / know-how layer.
- If a Barrier Sources / know-how layer exists, it must explain why know-how is visible: diamonds should represent methods or manufacturing processes that contribute to Barrier, holder scarcity, evidence gaps, or authored Chokepoint status.
- Artifact nodes with attached know-how should expose a summary signal in the default layer when the data exists: count, strongest must-build barrier, holder scarcity, or evidence gap. The user should not need to open a technical layer just to know that an artifact has a material Barrier source.
- Node distribution is balanced enough to understand the chain; nodes are not piled into unreadable clusters.
- Nodes must sit in the sector implied by their visible decomposition parent or documented primary parent. A material/component cannot be visually assigned to an unrelated branch just because it is shared or appears earlier in sort order; sector placement must preserve the user's mental model of the product chain.
- When product feedback reports specific misplaced nodes, carry those node ids as a required reproduction set until the fix is verified. Current AI compute regression set: `t_glass_fabric`, `abf_build_up_film`, `organic_substrate_buildup`, `laser_array_and_photodiodes`, `epitaxial_growth_inp_gaas`, and `mocvd_equipment_systems`.
- Primary-edge geometry must be coherent, not just individual node sectors. For every visible `primary` `requires` edge in a reported problem area, the target should stay inside the same first-layer sector/envelope as the source's canonical branch. If a visible edge crosses first-layer sectors, it must be intentionally classified and visually treated as a cross-edge. Do not validate only hand-picked node ids; inspect the primary edges around the reported node and at least one level of parents/children.
- Validate the final rendered canvas coordinates, not only the raw radial layout. If label/card packing or overlap avoidance moves a node outside its original first-layer sector, or leaves it pinned directly on a neighboring sector border so the ownership reads wrong, the graph fails even if `radialLayout` alone reports the right sector.
- Validate default canvas bounding boxes in the browser. Reported regression nodes and key default-visible artifact/material/equipment nodes must not be clipped outside the React Flow wrapper on first load; a route-led overview may emphasize a path, but it cannot make visible default nodes look lost, off-canvas, or assigned to a different region.
- When a dense map is clipped on first load, check whether fit-view is being clamped by the canvas minimum zoom. A graph can fail even when the fit target set is correct if `minZoom` prevents the viewport from zooming out far enough on mobile or large commercial maps.
- For a reported misplaced or semantically odd node, inspect the source graph edges, not just the rendered canvas. Duplicate `source` / `target` / `relation` edges, stale edge ids, or claims whose wording contradicts the edge's actual source/target are failures because canvas de-duplication can hide the bad model while the UI still feels wrong.
- Material canvas nodes are leaf inputs. If a visible material has non-material canvas children such as modules, equipment, or processes, check whether the host should be modeled as a module/equipment/process with materials attached beneath it; material-as-parent modeling is a likely cause of wrong sector placement and must be treated as a topology defect unless explicitly justified.
- `part_of` is child -> parent. Do not count a material's outgoing `part_of` edge to a host module as proof that the material has expanded children; inspect directionality before judging frontier status or structural parentage.
- Artifact node titles must name the artifact referent, not smuggle in exposure leads or verdicts. Default canvas titles for `product`, `technical_route`, `module`, `equipment`, and `material` nodes should not include supplier/org lists, tickers, public-company hints, or judgment suffixes such as "limiting tool", "current bottleneck", or "winner". Check both source node names and localized display labels. Put supplier names, tickers, market share, and thesis/verdict language in detail, evidence, exposure, metrics, notes, or explicit route copy. Proper nouns are allowed only when they are the literal product/architecture/standard being modeled, not merely example vendors.
- Edges are ordered and visually calm enough to follow the main dependencies. Crossings should be minimal; the main route must not be obscured by cross-edge noise.
- Edge endpoints must visually attach to the rendered source/target node boundary or intentional port. Arrowheads may be offset enough to remain visible, but they must not float so far from the target that the user cannot tell which node is being pointed to. Endpoint distance alone is not sufficient: primary tree edges should be low-curvature direct dependency links. Decorative-looking curls, loop-like S-curves, or paths that leave the visual corridor between source and target are failures unless the edge is intentionally classified as a cross-edge/shared dependency.
- Edge-geometry sampling is mandatory even when there is no user-provided "reported problem area." Sample the active route root, the top Chokepoints, one high-fanout node, and at least eight visible incident `primary` / `requires` edges. Report the sampled source -> target pairs. In AI compute replay, the required sample includes edges touching `ai_accelerator_module_hbm_cowos`, `advanced_packaging`, `substrate_and_interposer`, `high_bandwidth_memory`, `logic_die_fabrication`, and `power_delivery`.
- Judge the rendered SVG path, not only the graph data. A primary edge fails if its path leaves the visual corridor between source and target, forms a loop-like or ornamental curl, uses a high-curvature cubic bend when a short direct segment would be readable, starts from a port that reads as belonging to a different node, or places the arrowhead closer to empty canvas / another node than to the intended target. If browser tooling cannot inspect path endpoints or screenshots well enough to judge this, mark the check `not assessable` and do not pass Gate 3A.
- For any visible node with six or more same-layer outgoing or incoming edges, inspect the default label-mode canvas and a focused-node state. Sibling edges must use readable port/anchor separation, grouping, or another explicit visual treatment; they must not collapse into one indistinguishable line bundle from a single point.
- Any numeric badge drawn on a graph node must have a visible or inspectable meaning through tooltip, legend, accessible label, or adjacent layer copy. A count badge must not be confusable with rank, evidence count, or Chokepoint score.
- No visible user-facing graph node may appear grey. If a node appears on the map, it must be assigned a meaningful color family. If it cannot be colored, hide it from the primary user map or move it to a secondary detail/evidence surface. Grey nodes are a fail because they make edge routing and hierarchy read as chaotic.
- Coloring is semantically stable. Users can tell whether color is subsystem family, Chokepoint, Cost, relation context, or another declared lens.
- First-layer product sectors must have visible names. In the default product layer and System decomposition lens, verify that the rendered page names every direct first-layer module through sector labels, a module legend, or an equivalent always-visible control. Do not pass a map that only shows colour/tint without saying what each coloured region is. For AI compute, the visible sector/module list must include the root's direct children such as logic die fabrication, advanced packaging, HBM, substrate/interposer, interconnect/optics, power delivery, and thermal/cooling when they are in the graph.
- In System decomposition/product-layer coloring, node fill hue must match the same canonical first-layer branch used for layout placement and primary-edge classification. A node positioned in one subsystem sector but colored as another subsystem is a fail unless the UI explicitly marks it as an intentional shared dependency/cross-edge case. For reported color defects, compare the node's fill color against its primary parent, first-layer sector tint, and visible branch label.
- Edge thickness reflects the active lens's intended signal, such as bottleneck risk or cost driver, and does not contradict the legend.
- In the Cost lens, the legend and edge styling must make the encoded quantity clear at first glance. If edge width reflects incremental/route contribution rather than the target node's absolute modeled cost, the UI must say so and the detail rail must explain apparent mismatches such as a thin edge pointing to a high-cost node.
- The canvas exposes the intended lens vocabulary: System decomposition, Chokepoint, and Cost. Maturity is an internal Barrier input, not a selectable user-facing lens.
- Switching lenses changes overlays without scrambling node identity or spatial memory.
- Clicking a node highlights the relevant branch while preserving enough context to stay oriented.
- Cmd+K search, Esc recovery, empty-click recovery, and detail selection behave predictably.
- Mobile may be reading-first, but it must not have horizontal overflow, unusable controls, or a canvas that visually breaks the page.

Hard fails:

- The graph is blank, mostly offscreen, or unreadable in a normal desktop viewport.
- Any visible user-facing graph node appears grey.
- Organization, metric, evidence, or raw context records appear as default canvas nodes.
- Know-how appears on the default map without an explicit Barrier Sources/layer interaction.
- A Barrier Sources layer reads as a dump of technical methods rather than a map of why artifacts are hard to replicate.
- Edges or labels overlap so heavily that the primary route cannot be read.
- Nodes render in the wrong sector or under the wrong visible branch, causing the map to imply an incorrect product decomposition.
- A `primary` edge visually connects across unrelated first-layer sectors without being classified as a cross-edge or explained as an intentional shared dependency.
- A rendered edge endpoint or arrowhead appears detached from the source/target node or points ambiguously into empty canvas space.
- A primary dependency edge renders as an ornamental curl, loop-like S-curve, high-curvature cubic bend, or starts/ends from a port that reads as belonging to another node, even if endpoint gap measurements are small.
- The QA report passes Gate 3A without naming the sampled edge pairs or without marking edge geometry as not assessable when browser evidence is insufficient.
- Final packed/rendered node positions cross their radial sector or hug a neighboring sector border tightly enough that the user can reasonably read the node as belonging to the wrong subsystem.
- Reported or key default-visible artifact/material/equipment nodes are clipped outside the canvas wrapper on initial load.
- The source graph around a reported node contains duplicate visible structural edges, stale edge ids, or edge claims that describe a different parent/child relationship than the actual source/target.
- Source graph traversal treats outgoing `part_of` from a child/material as if it were an outgoing decomposition child.
- A visible material node acts as the structural parent of a non-material canvas node without an explicit modeled host artifact.
- A default artifact node title or localized canvas label contains supplier/ticker/exposure identities or verdict words that should live in detail or exposure surfaces instead of the map label.
- A node with six or more visible same-layer edges renders those edges as an indistinguishable bundle from one point in default label mode or after selecting/focusing the node.
- A graph node shows an unexplained number badge, especially if it can be mistaken for a rank, evidence count, or score.
- A node's fill color implies a different subsystem family than its primary visible branch or layout sector.
- First-layer sector/module names are missing, hidden, clipped, or too faint to read, leaving coloured regions unexplained.
- Lens changes make the meaning of node color or edge width inconsistent with the legend.
- The canvas, legend, and detail panel disagree on the same node's Chokepoint verdict or elevated axis.
- Node click/selection loses the user or breaks spatial memory.

### Gate 3B: Node Detail And Investor Summary

Target question: Does the first node-detail screen answer what a retail investor wants to know?

Required paths:

- Open at least three top Chokepoint or authored bottleneck nodes and one product/root node.
- Include at least one node with company/ticker leads and one node with weak or unreviewed evidence.
- Include at least one node where Cost is high but Cost is not the structural chokepoint reason.
- Include at least one know-how or know-how-adjacent node when the route contains `engineering_method` or `manufacturing_process` records.
- Include at least one structural node without an explicit authored relief-cycle field and at least one supplier/company lead without a revenue/share/capacity metric, to verify the UI shows labeled proxy estimates instead of blank/unknown readouts.
- For AI compute, the detail-regression sample must include `ai_accelerator_module_hbm_cowos`, `advanced_packaging`, `substrate_and_interposer`, `high_bandwidth_memory`, `logic_die_fabrication`, `foundry_capacity_tsmc`, and `power_delivery` when those nodes are reachable. Do not satisfy this gate only by checking an organization detail page.
- Test desktop rail and mobile reading layout.
- Test English and Simplified Chinese for the primary summary layer.
- On desktop, compare at least one AI compute supplier/capacity detail against `docs/plans/assets/node-detail-ia-commercial-supplier-lines-v4.png`. Passing requires the sample-style visual shell: identity hero, leading quote, 2x2 core readout, decomposition table/card treatment, evidence card, and supplier/company cards. Text order parity alone is a fail if the old sidebar/card treatment remains.
- On default route entry before a node is clicked, the rail must not show both route guidance and a duplicate selected-node summary for the same recommended start node. A duplicate selected summary makes the route guide look like a node detail.
- In the selected-node sample detail, inspect the core readout content. It must use the four product-design fields: `Impact scope` / `影响范围`, `Substitution feasibility` / `替代可行性`, `Blocking mode` / `阻断方式`, and `Current status` / `当前状态`. Treat `Cost-scale proxy`, `Leading reason`, `Relief timing`, evidence status, company clues, or Chokepoint-axis diagnostics inside the core readout as stale hierarchy unless they appear in the appropriate interpretation, Cost-lens, evidence, exposure, or supplementary surface.
- In the selected-node sample detail, inspect the core readout tile layout. The
  four readout tiles should render as a stable 2x2 grid in the rail. Fail the
  screen if they collapse into one cramped four-column row; that is too literal
  to the saved sample width and makes the narrow rail harder to scan. Only
  accept a one-column fallback on genuinely tiny/mobile widths where two columns
  would overflow.
- The sample-style primary path must go from `Core readout` to `Node interpretation` to `Decomposition` to `Evidence trail` without inserting an extra "Where it is stuck" / "具体卡点" section. The concrete mechanism should be carried by the `Blocking mode` tile, interpretation copy, and decomposition rows.

First-screen order:

- Identity: node name, route/domain context, and enough type context to know whether this is a product, subsystem, material, equipment, know-how, or organization-adjacent exposure.
- Core readout: the four tiles above should answer scope, substitution feasibility, blocking mode, and current status before raw metadata or supplier/company details.
- Chokepoint headline: verdict plus the elevated structural reason, in plain language. The allowed structural reasons are Dependency, Concentration, and Barrier. Cost is separate.
- Cost magnitude: shown only as price, cost share, cost gap, or Cost lens context. It must never be the explanation for why the node is a Chokepoint.
- Investor brief: a compact set of reader-facing signals before raw metadata:
  - Dependency: what depends on this node, or why the selected route cannot scale without it;
  - Concentration: modeled holder/supplier coverage, public/private holder availability, or "no modeled / verified holders yet";
  - Barrier: must-build/procurable status, hard-to-replicate reason, lead time, readiness gap, or relief timing;
  - Cost: modeled/estimated/missing cost with caveat and coverage when available;
  - Evidence: reviewed/unreviewed/machine-checked/direct/nearest-source status, plus visible limitation when weak.
- Company or ticker leads: appear after the bottleneck logic and key signals, not before. They should be close enough to the first summary that users can connect "why this matters" to "who might be exposed."
- Supplier/company commercial scale: every surfaced lead must show an explicit financial/capacity/share/listing metric or a clearly labeled proxy estimate from graph facts such as listing status, ticker availability, and relationship type. Do not hide the financial/capacity block just because direct revenue data is missing.
- Evidence and inspection: detailed evidence may be collapsed below the summary, but source, quote/excerpt when available, review status, limitations, and evidence type must be inspectable without hunting through raw JSON-style data.
- Internal graph implementation details, raw relation dumps, schema-like field names, and operator controls are not the primary reader path.
- Route-level "Start here" guidance is not treated as a peer of node-specific detail. It may appear as onboarding/navigation, but selecting a graph node must not make an unrelated route-start panel look like the node's own detail state.
- If the evidence is weak, the UI says so plainly and downgrades the claim rather than hiding the problem.
- Weak/thin evidence is a data-quality state, not a bottleneck reason. It may appear under evidence, caveats, or research gaps, but it must not be presented as the concrete "Where it is stuck" / "具体卡点" explanation.
- The "why it matters" / chokepoint thesis copy must name the concrete mechanism: constrained supplier/holder set, capacity expansion lead time, process yield, equipment bottleneck, material shortage, substitution barrier, routing dependency, or another graph-backed reason. Generic copy such as "it matters because this route's scale depends on this constraint" is a fail because it restates importance without explaining it.

Node-type checks:

- Product/root nodes should explain the route and top downstream Chokepoints. They should not label the root product itself as the main Chokepoint merely because it is expensive or structurally central.
- Product/module/equipment/material nodes should answer: what role does this play, what depends on it, why is it hard to route around, and which Cost/Concentration/Barrier signals are known or missing.
- When a Concentration readout is driven by modeled `manufactured_by` / `implemented_by` holders, the UI must frame the count as modeled coverage, not as a real-world exclusivity conclusion. A zero-holder state must read as a holder-coverage gap, not `0 makers`, `0 suppliers`, `仅 0 家`, or `零家`. A nonzero holder count must not say or imply `only`, `sole`, `exclusive`, `仅`, or `唯一` unless the detail also exposes an explicit sole-source / supplier-concentration claim with ADR-0009-grade support. Missing holder coverage must not become the concrete chokepoint reason for an authored bottleneck with decomposition/evidence.
- Key Chokepoints lists must contain actual top-band Chokepoints or explicitly authored bottlenecks. Lower-band constraints, ordinary dependencies, and evidence gaps belong in inspect-next, decomposition, evidence, or research-gap surfaces rather than under "Key chokepoints".
- A selected node that is not a top-band Chokepoint or explicitly authored bottleneck should not show the same "Where it is stuck" / "具体卡点" treatment as confirmed bottlenecks. It may show role, dependencies, evidence limitations, candidate constraint status, or inspect-next guidance, but the status must be labeled honestly.
- Know-how nodes should answer: is the know-how procurable or must-build, who holds it when modeled, which product or subsystem it attaches to, and whether the barrier is evidence-backed or still a hypothesis.
- Organization nodes, when reachable from detail surfaces, should read as exposure evidence. They must show relationship type and confidence, not just a name and ticker.
- Nodes with no direct evidence should still be useful: they should state the gap, show nearest/related evidence when available, and make the missing claim obvious.

Company/ticker checks:

- Company leads show relationship type and confidence: direct supplier, equipment vendor, material supplier, capacity holder, know-how holder, customer exposure, indirect exposure, alternative route, or candidate needing verification.
- If the route is locked, the user may see counts and access-state copy, but not locked company names, tickers, org-level evidence, or enough detail to reconstruct them.
- If AI compute is the full-free demo, company/ticker exposure should be inspectable enough to judge the method, including relationship type and evidence limitations.
- Company/ticker leads must be framed as diligence leads or exposure candidates, never buy/sell/hold advice.

Hard fails:

- A user cannot answer, without scrolling far, "is this a Chokepoint?", "what structural reason drives it?", "how big is the Cost signal?", and "which companies are connected?" when those data exist.
- The first screen leads with internal metadata rather than an investor/research summary.
- "Start here" and node-specific detail are presented as equivalent modes even though one is route onboarding and the other depends on the selected node.
- The detail panel calls Cost the reason something is a chokepoint instead of keeping Cost as a separate magnitude overlay.
- The detail panel labels a structural node's cost/capex proxy as broad commercial scale, market size, TAM, or revenue when the underlying graph value is a cost, BOM, quote, or capex proxy.
- An unsourced child estimate is not bounded by an available direct authored parent cost/capex value and creates an obvious parent/child inconsistency.
- Relief timing or supplier/company commercial scale is blank, silently omitted, or left as an unqualified unknown when an explicit value or proxy estimate should be shown.
- A nonzero modeled holder count is rendered as a confirmed sole-source / only-supplier statement, especially Chinese copy such as `仅 1 家`, `唯一供应商`, or English copy such as `only 1 supplier`, without an explicit ADR-0009-grade sole-source claim.
- A proxy estimate is phrased as a reviewed metric, audited revenue/share, or established field evidence.
- A user-visible estimate is labeled with internal percentile jargon (`P50` / `p50`) instead of reader wording such as `est.`, `估算`, or `约`.
- A zero-holder Concentration gap is rendered as a confirmed supplier count, especially in Chinese copy such as `仅 0 家` / `零家`.
- The root/product page presents itself as the bottleneck instead of directing the user to the route's top Chokepoints.
- A non-top node is presented in the same list or visual treatment as a Key Chokepoint without an explicit candidate/low-confidence label.
- A weak-evidence or missing-holder caveat is phrased as the concrete bottleneck itself rather than as an evidence/supplier-coverage gap.
- Chokepoint thesis copy only restates importance or route dependency without a concrete mechanism.
- An authored bottleneck with decomposition/evidence is summarized as "supply source unverified" rather than as a modeled holder-coverage gap or evidence limitation.
- A know-how node appears as an unexplained extra graph object instead of communicating a product barrier.
- Company/ticker leads appear before the bottleneck logic or without confidence/relationship context.
- Locked company/ticker identities leak in a paid route.
- Evidence limitations are hidden for a weak claim.
- Chinese mode leaves the primary summary unusable for a Simplified Chinese reader.

### Gate 4: Release Guardrails

Target question: Can this build be shipped or sold without technical, permission, or data-scope failure?

Required checks:

```bash
npm run validate:data
npm run check:active-graph-scope
npm run gate -- --target low_cost_parcel_sorting_robot_300k_rmb --dry-run
npm run check:graph-ux
npm run lint
npm run build
npm test
```

For an intentionally enabled paid production release, also run:

```bash
npm run verify:paid-release
```

When live credentials are not available but the build is being declared ready
for paid delivery, run the real Stripe test-mode delivery path instead of
substituting mocks:

```bash
npm run verify:paid-test-delivery
```

Acceptance checks:

- The verification surface is clean. Generated artifacts such as `.next`, `.next-judge`, and `.scratch` outputs do not break lint or release checks.
- Gate dry-runs do not write reports or mutate task files.
- Domain route scope, active graph scope, gate scope, and paid exposure scope agree.
- Production or public mode defaults to read-only for operator write APIs.
- Entitlements fail closed. Missing or invalid secrets do not grant access.
- Paid routes do not expose locked organization names, tickers, or paid-only evidence through free HTML/API output.
- Checkout links are production-ready only when intentionally enabled. Test Stripe links must not appear in a live paid launch.
- The paid-release gate verifies the live active one-time USD $9 price, the matching Payment Link, the exact `/unlock?session_id={CHECKOUT_SESSION_ID}` return, support address, and entitlement secret. A normal safe-mode build is not evidence that paid release is ready.
- Without live credentials, paid-delivery readiness is proven by a completed Stripe test-mode `$9` Checkout Session traversing the real `/unlock` route, issuing the secure `all` cookie, delivering all four paid exposure layers, preserving AI Compute as full-free, supporting Session replay, and rejecting an invalid Session without a cookie. Static config checks and mocked Session tests are not substitutes.
- Offer membership is explicit: only routes with `allAccessRole` may show the global checkout, while `entitlement` remains the broader access/leak-prevention boundary.
- Sitemap, metadata, robots, and core route health are valid for the intended deployment.
- Production returns 404 for internal operator routes (`/gate`, `/tasks`, `/graph`, `/explore`, and `/product/*`), while local operator mode can still use them; those paths are also excluded from indexing.
- Browser console has no runtime errors on the tested paths.

Hard fails:

- `npm run verify` or the equivalent full release command fails from the current workspace.
- A paid layer leaks locked company/ticker identities.
- Checkout is in test mode while the UI presents it as a real purchase.
- Paid delivery is claimed ready from configuration or mocked Session tests without either the live transaction path or `verify:paid-test-delivery` succeeding.
- A production write API is open without explicit operator mode.
- Gate output or tasks are polluted by unrelated domains.

## Product Acceptance Criteria

**The authoritative rubric is `docs/ACCEPTANCE.md` §3.** Judge against it. The bullets below are the hard floor that also fails a run.

The repo is not acceptable if any of these are true:

- The app cannot build or start.
- Core graph data fails validation.
- The graph view is blank, unstable, unreadable, or impossible to operate.
- A commercial user cannot inspect AI compute, SpaceX reusable launch, or humanoid robotics according to the route state being advertised.
- The user cannot inspect the internal parcel-sorting robot graph when it is needed for development/gate regression.
- Node selection or detail inspection does not work.
- Recursive decomposition is absent or only described in docs.
- The validation gate invents answers not supported by local graph data.
- **Disclosure (§3a):** the user cannot tell, at first glance, a node's **chokepoint** verdict and the **elevated structural axis** driving it (Dependency / Concentration / Barrier) — or the axis shows as raw internal jargon (e.g. `maturity: prototype`) instead of a concrete user-facing statement. Cost may appear as a separate magnitude readout, never as the structural reason.
- **Vocabulary consistency (§3b):** canvas lens labels do not match the model vocabulary (§2) — e.g. a `Maturity` or `Bottleneck risk` lens label after the move to `Chokepoint` / `Barrier`, or the canvas and detail panel disagree.
- Important claims appear established without their evidence / review status **visible** (honesty of the source itself is the evidence-audit agent's job, not yours).
- The app silently merges neighboring products into the current product boundary.
- Company/ticker leads are presented as investment recommendations rather than diligence leads.
- A paid/free boundary is misleading, surprising, or technically leaky.
- Visible user-facing graph nodes appear grey instead of receiving a meaningful color family.
- Chinese/English switching breaks core workflows.
- **Compliance (§3e):** any stock-recommendation or unaudited-return language appears (this is an analytical tool, not advice).

The repo may be acceptable with known gaps only if the gaps are visible, documented, and do not block the v0 closed loop (`conditional_pass`, per §5).

## Finding Categories

Classify every issue into one category:

- `blocker`: prevents meaningful use or invalidates the product promise.
- `major`: breaks an important workflow or creates misleading research output.
- `minor`: local defect, awkward behavior, or incomplete polish that does not block the core loop.
- `ux`: user confusion, poor information architecture, unclear controls, weak affordance, or cognitive overload.
- `data_model`: graph schema, relation semantics, product boundary, evidence, Barrier/readiness, gate, or task quality problem.
- `commercial`: paid/free boundary, pricing, CTA, route state, launch promise, or conversion problem.
- `investment_trust`: company/ticker lead quality, relationship type, diligence logic, risk disclosure, or investment-advice risk.
- `paywall`: entitlement, locked exposure, checkout, leakage, or access-control problem.
- `performance`: slow, janky, unstable, excessive rerendering, layout thrash, or browser responsiveness problem.
- `accessibility`: keyboard, contrast, focus, screen reader, touch target, or responsive readability problem.
- `opportunity`: improvement that would materially raise quality but is not a defect.

Each finding must include:

- Severity.
- Exact surface or file if known.
- Reproduction steps or observation path.
- Expected behavior.
- Actual behavior.
- User impact.
- Suggested fix direction.

Avoid generic findings. "Graph UX could be better" is not acceptable. Explain what failed, where, and why it matters.

## Report Format

Return a report with this structure:

```markdown
# QA Report

## Verdict

Acceptance status: pass | conditional_pass | fail
Commercial recommendation: ship_paid | ship_waitlist_only | do_not_ship

One-paragraph explanation of whether the repo currently meets `docs/ACCEPTANCE.md` §3 and what commercial launch posture follows from that evidence.

## Evidence Collected

- Commands run and results.
- Browser URL and viewport sizes tested.
- Main user journeys tested.
- Files or docs read.

## Acceptance Coverage

- Existing acceptance/QA rules that directly cover the reported issue, with section or bullet references.
- Any new or updated acceptance/QA/machine-gate rule added before implementation.
- Independent QA replay result: baseline findings, missed failure classes, acceptance updates made, and rerun result.
- Any product-facing symptom still covered only by manual browser QA, with the exact targeted browser step to rerun.

## Critical Findings

Blocker and major findings first. Include severity, reproduction path, impact, and fix direction.

## Gate Summary

| Gate | Status | P0 | P1 | Ship decision |
| --- | --- | ---: | ---: | --- |
| Commercial Promise And Paid Boundary | pass/conditional/fail | 0 | 0 |  |
| Paid Insight Trust | pass/conditional/fail | 0 | 0 |  |
| Graph Map Interaction And Readability | pass/conditional/fail | 0 | 0 |  |
| Node Detail And Investor Summary | pass/conditional/fail | 0 | 0 |  |
| Release Guardrails | pass/conditional/fail | 0 | 0 |  |

## User Experience

Describe what it felt like to use the product as a retail investor and researcher. Be concrete about orientation, graph readability, company/ticker exposure, trust, language support, and recovery from missing data.

## Product Goal Coverage

Assess coverage of:

- local graph data as source of truth;
- advertised commercial route states;
- free learning layer;
- paid/future-paid company and ticker layer;
- parcel-sorting robot development boundary when relevant;
- recursive decomposition;
- graph inspection;
- evidence and review status;
- Chokepoint, Barrier, Cost, and route comparison;
- validation gate;
- research task generation;
- English/Simplified Chinese usability.

## Bugs And Risks

List functional bugs, data/modeling risks, implementation risks, and verification gaps.

## Improvement Opportunities

Rank the highest-leverage improvements. Prefer changes that improve research usefulness over decorative polish.

## Unverified Areas

State exactly what was not tested and why.

## Recommended Next Actions

Give a prioritized list of concrete next steps.
```

## Strictness Rules

- Do not return `pass` if a core acceptance path was not actually tested.
- Do not recommend `ship_paid` if a core commercial user journey was not actually tested.
- Do not recommend `ship_paid` if browser testing was skipped for user-facing UI changes.
- Do not claim something works because a document says it should.
- Do not infer missing graph facts from general knowledge.
- Do not use online search to fill gate answers during QA.
- Do not treat visual polish as success if research workflows remain weak.
- Do not ignore console errors or runtime overlays.
- Do not hide uncertainty. Put it in `Unverified Areas`.

## When Using Subagents

If the QA run uses multiple agents, split work by independent responsibility:

- One explorer can read docs and derive acceptance criteria.
- One explorer can inspect graph data and gate behavior.
- One browser-capable agent can test live UI interactions.
- One reviewer can consolidate findings and challenge weak evidence.

The final QA report must reconcile disagreements. Do not paste disconnected subagent summaries as the final answer.

## Human Handoff

The final QA handoff should be useful to a developer deciding what to fix next.

Keep the report direct and prioritized. The best QA report makes the next engineering decision obvious.
