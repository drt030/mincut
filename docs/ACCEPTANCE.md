# MinCut — Acceptance Standard

> **MinCut** — *Find the bottlenecks in how things get made.*
>
> This is the single front door for "is this change done, and does it meet the bar?" It exists so that **"an agent says pass" and "the owner spots a problem on sight" converge**. Per the project rule: for ANY new requirement, change, or owner-reported QA miss, this standard or the QA runbook is updated and replay-verified BEFORE implementation starts.

Status: active working standard, updated 2026-06-20. Owner decisions from 2026-06-20 supersede older docs where conflicts exist. This document defines *what counts as pass*; `docs/QA-agent.md` defines *how to run* the QA agent, including feedback-driven independent replay, and points back here.

---

## 0. Who judges what (no overlap)

| Layer | Judges | Owner |
|---|---|---|
| **Machine gates** | structure & schema: `lint`, `build`, `check:graph-ux`, `check:graph-topology`, `check:graph-layouts`, `validate:data`, `check:disclosure` (new, §4) | automated, hard-fail |
| **QA / acceptance agent** | **disclosure: does the user get the right info, first-glance, in their words** (§3) | `docs/QA-agent.md`, browser-based |
| **Evidence-credibility audit agent** | **honesty**: does a cited source actually support the claim | `docs/superpowers/specs/2026-06-14-evidence-credibility-audit-agent-design.md` |
| **Master agent** | the accept / fix decision, from QA + implementation evidence | `docs/master-agent.md` |

The QA agent owns **completeness + first-glance salience**. It does NOT re-judge source honesty (audit agent) or schema (validate:data). Keeping these separate is what makes each runnable.

---

## 1. The core principle

A change is acceptable when, **from the rendered product**, a user pursuing a real goal **sees what they want at first glance, in their own terms** — and is not misled by what is hidden or dressed up as internal jargon.

Three disclosure principles (every UI/product change is judged against them):

- **Progressive** — don't dump; reveal on intent. What the user doesn't want yet is hidden but reachable.
- **Direct** — what the user *does* want is visible at first glance: no click, scroll, or hover required.
- **Sustained** — the relevant readout persists across lens switches and drill-down; the user never loses the thread.

---

## 2. The model vocabulary (what the product is about)

MinCut scores every node on four structural axes and one composite. The **acceptance rubric and the UI must use exactly this vocabulary** — canvas, detail panel, and QA report all agree (see ADR-0010, and the spec `2026-06-14-chokepoint-factor-model-design.md`).

- **Four readouts**: **Cost** · **Dependency** (downstream criticality) · **Concentration** (supply fragility + geography) · **Barrier** (replication / substitution difficulty; absorbs the old "maturity").
- **Composite — Chokepoint**: `(dependency × concentration × barrier)` geometric mean. Cost is an orthogonal $-overlay that sizes the opportunity; it is not a reason a node is a chokepoint.

**Canvas lenses — exactly three:**

1. **System decomposition** — structure only, no analysis coloring.
2. **Chokepoint** — the composite (default lens).
3. **Cost** — where the money is (orthogonal to chokepoint-ness).

There is **no Maturity lens** and **no separate Dependency / Concentration / Barrier lens**. The Cost + Dependency + Concentration + Barrier breakdown lives in the **node detail panel** (drill-in), with the elevated structural axis surfaced first and Cost shown separately when available.

**Display node layers:**

- **Artifact** nodes (`product`, `technical_route`, `module`, `equipment`, key `material`) are the default canvas nodes.
- **Know-how** nodes (`engineering_method`, `manufacturing_process`) are Barrier Sources: hidden from the default canvas, summarized on their host artifacts, and explorable in a secondary Barrier Sources layer or detail panel.
- **Organization** nodes are market-actor/exposure evidence. They must not appear as default canvas nodes.
- **Metric, evidence, context, principle, and regulation** records stay in detail, gate, or evidence surfaces, not as default canvas nodes.

Know-how becomes a standalone user-facing node only when it contributes to Barrier, Concentration, holder/exposure, evidence, `bottleneckOf`, `frontierFor`, or shared-dependency reasoning. Low-signal process notes belong in the host artifact detail.

---

## 3. The acceptance rubric (what the QA agent checks)

### 3a. Per-node first-glance chokepoint checklist

For any node a user inspects, at **first glance** they can answer — in plain language, not raw internal labels:

- **Is it a chokepoint, and how much of one?** (the composite verdict)
- **Which structural axis makes it one?** — the *elevated* chokepoint axis among Dependency / Concentration / Barrier, stated concretely (e.g. "可外购，但供应高度集中（2–3 家）" / "多个关键模块依赖它"), **not** a raw tag like `maturity: prototype`.
- **If Concentration is elevated, is the supplier state worded honestly?** Holder counts derived from graph edges are **modeled holder coverage**, not proof that the real world has only that many suppliers. A known small holder set may say "modeled holders: {N}" / "已建模供应方 {N} 家"; it must not say or imply "only / sole / exclusive / 仅 / 唯一" unless a separate high-tier sole-source / supplier-concentration claim is explicitly evidenced per ADR-0009. A zero-holder model state means supply-source gap or unverified holder coverage, not a confirmed "0 suppliers" / "仅 0 家" count.
- **How much money is attached?** — For structural nodes, this is a cost-scale / capex proxy, not broad market size or revenue. It may appear as a separate magnitude line or Cost lens, but must not be phrased as the reason the node is a chokepoint.
- **Are estimated / typical values worded for readers?** User-facing numeric estimates must not expose internal percentile jargon such as `P50` / `p50`. Use reader language such as `est.` in English or `估算` / `约` in Chinese, and keep the explicit range separate when shown.
- **What is the relief / mitigation cycle?** Every user-facing structural node needs either explicit `capacityLeadTimeMonths` or a clearly labeled proxy estimate. "Not yet quantified" is not acceptable as a final first-glance readout; if no direct source exists, show a conservative estimated band and state that it needs source replacement.
- **What commercial scale is attached to supplier leads?** Every surfaced supplier / company lead needs either an explicit revenue, share, capacity, shipment, listing, or enterprise-value metric, or a clearly labeled commercial-scale proxy from available graph facts such as listing status and relationship type. The proxy must not be presented as reviewed financial data.
- **Do parent and child scale/timing readouts make graph sense?** For direct structural decomposition edges, a parent node's displayed cost-scale proxy must not be lower than the sum/rollup of its displayed children, and a parent node's displayed relief / mitigation cycle must not be shorter than any direct structural child. If a parent carries a direct authored cost/capex value, low-confidence child estimates without their own sourced value must be sanity-checked against that parent budget after known child rollups, and shown as parent-bounded estimates when scaled. If a parent carries a direct authored value that is below its child-derived rollup, the data must be corrected or blocked by a machine gate rather than silently normalized in UI.
- The Cost + Dependency + Concentration + Barrier breakdown is available on drill-in, with Cost visually and verbally separated from the structural Chokepoint reason.
- When a saved node-detail IA sample exists, the rendered detail must preserve the same visible hierarchy, not only the same text order. For `docs/plans/assets/node-detail-ia-commercial-supplier-lines-v4.png`, the first reader path requires a sample-style identity hero, leading quote block, 2x2 core readout, decomposition table/card treatment, evidence card, and supplier/company cards.
- Default route entry state is not selected-node detail. On first route load before the user clicks a graph node, the rail may show route guidance / a start card, but it must not also render a duplicate selected-node summary for the same start node.
- The selected-node core readout has exactly four reader-facing tiles: **Impact scope** / **影响范围**, **Substitution feasibility** / **替代可行性**, **Blocking mode** / **阻断方式**, and **Current status** / **当前状态**. Cost/capex scale, Chokepoint-axis diagnostics, evidence state, and supplier/company detail belong in their own detail, Cost-lens, evidence, exposure, or supplementary surfaces, not as extra core-readout tiles.
- The selected-node core readout must use a stable 2x2 tile layout in the rail.
  Do not collapse the four readout tiles into a single cramped row just because
  CSS can technically fit four columns; a one-row layout makes the cards harder
  to scan and misuses the narrow detail rail. Only fall back below 2 columns on
  genuinely tiny/mobile widths where two columns would overflow.
- The saved-sample primary reader path must not insert a separate "Where it is stuck" / "具体卡点" section between `Node interpretation` / `节点解读` and `Decomposition` / `结构拆解`. Concrete constraint mechanisms belong in the core `Blocking mode` tile, the `Node interpretation` paragraph, and the decomposition rows.
- The selected-node `Decomposition` / `结构拆解` block must explain this node's actual decomposition boundary. Its heading, count line, summary sentence, and child rows should tell the reader what system boundary is being split and why the child modules matter. A reusable template such as "direct modules", "the parent needs these dependencies", or "each child can have its own suppliers/evidence/bottlenecks/cost/lower decomposition" is not sufficient when it repeats across nodes without naming the current mechanism.
- The saved-sample primary reader path must not add raw model diagnostics that are not in the sample. The Cost / Dependency / Concentration / Barrier axis grid may remain available in an explicit drill-in or supplementary appendix, but a standalone "Chokepoint axes" / "卡点四轴" block is not part of the first-glance core readout.
- Weak/thin evidence and missing holder coverage are data-quality states. They must be visible, but they must not be used as the concrete "why this is a chokepoint" / "具体卡点" reason.
- Missing or sparse modeled holder coverage must be worded as a model/evidence coverage state, not as a confirmed real-world absence, exclusivity, or sole-source conclusion.
- Chokepoint explanations must name the concrete mechanism: constrained holder set, capacity expansion lead time, process yield, equipment lead time, material shortage, substitution barrier, routing dependency, or another graph-backed reason. "This route's scale depends on this constraint" is not enough.
- Key Chokepoints surfaces contain only top-band Chokepoints or explicitly authored bottlenecks. Lower-band constraints, ordinary dependency nodes, and evidence gaps belong in decomposition, inspect-next, evidence, or research-gap surfaces unless clearly labeled as candidates.
- Non-top ordinary nodes must not receive the same "Where it is stuck" / "具体卡点" treatment as confirmed Chokepoints. If they are shown as candidate constraints, that uncertainty must be explicit.

**Fails** if: the answer is buried (needs digging), shown as internal jargon, estimated or typical values are labeled with `P50` / `p50` in user-facing UI or reports, the elevated axis isn't surfaced, the explanation only restates that the node is important, structural-node cost/capex proxy is mislabeled as broad market or commercial scale, relief timing or supplier commercial scale is blank / silently omitted / left as an unqualified unknown, a proxy estimate is presented as reviewed fact, a parent structural node's cost-scale proxy is below its child rollup, an unsourced child estimate visibly exceeds or overfills a direct authored parent cost/capex value without being parent-bounded or flagged, a parent structural node's relief / mitigation cycle is shorter than a direct structural child, a zero-holder Concentration gap is presented as a confirmed supplier count, a nonzero modeled holder count is presented as "only / sole / exclusive / 仅 / 唯一" without an explicit ADR-0009-grade sole-source claim, weak evidence / missing holder coverage is presented as the bottleneck reason, saved node-detail sample visual hierarchy is replaced by the old sidebar/card treatment even when the text order is correct, selected-node decomposition copy repeats generic framework text instead of naming the current node's decomposition mechanism, or ordinary non-top nodes are dressed as confirmed Chokepoints. (Whether each nonzero number is *correct* is the audit agent's job, not this checklist's; whether the UI overclaims what the count means is this checklist's job.)

### 3b. Vocabulary consistency

Canvas lens labels == detail-panel vocabulary == §2 model. **A mismatch is a fail** (e.g. a "Maturity" or "Bottleneck risk" lens label after the model moved to Barrier/Chokepoint). *(This is the check that would have caught the lens-label drift on 2026-06-15.)*

### 3b.1. Graph node-layer contract

Default graph views pass only when the rendered map behaves like an artifact
map: product/route/module/equipment/key-material nodes carry the structure,
while know-how, organization, metric, evidence, and context records stay out of
the default canvas.

Know-how must read as **Barrier Sources**, not as generic technical clutter:
attached know-how should either be summarized on the host artifact or rendered
as purposeful diamond nodes in the secondary layer. The layer must preserve the
artifact map's spatial memory and cannot introduce grey user-facing nodes.

Live commercial route graphs must not run expensive global card/edge packing on
every user request. Their default product and Barrier Sources layouts are
generated artifacts with graph fingerprints, and `check:graph-layouts` must fail
when a required layout is missing or stale.

Fails if: organization/ticker nodes appear as default graph nodes; metric or
evidence records appear as graph nodes; know-how appears without explaining a
Barrier/holder/evidence/chokepoint signal; any rendered user-facing node is
grey/unclassified; nodes appear in a sector or visible branch that contradicts
their decomposition or documented primary parent; a visible `primary` edge
crosses unrelated first-layer sectors without being classified as a cross-edge
or intentional shared dependency; a node's fill color implies a different
subsystem family than its primary visible branch or layout sector; final
packed/rendered node coordinates cross out of their radial sector or sit so
close to a neighboring sector border that the ownership reads wrong; the source
graph around a reported node contains duplicate visible structural edges, stale
edge ids, or edge claims that describe a different source/target relationship
than the actual edge data; a visible material node acts as the structural
parent of a non-material canvas node without an explicit modeled host artifact;
source graph traversal treats outgoing `part_of` from a child/material as an
outgoing decomposition child;
six or more visible same-layer edges from one node collapse into an
indistinguishable line bundle instead of using readable port/anchor separation
or another explicit grouping treatment;
edge endpoints or arrowheads appear detached from the rendered source/target
node or point ambiguously into empty canvas space;
primary tree edges read as decorative curls, loop-like S-curves, or
high-curvature cubic bends rather than low-curvature dependency links, even
when endpoint gap measurements are small;
QA passes graph geometry without sampling root/top-chokepoint/high-fanout
incident edges and naming the sampled edge pairs;
numeric node badges appear without visible/inspectable meaning and can be
mistaken for rank, evidence count, or score;
first-layer product sectors appear as unnamed colour regions without visible
module labels, a sector legend, or an equivalent always-visible explanation;
reported or key default-visible artifact/material/equipment nodes are clipped
outside the canvas wrapper on initial load, including cases where fit-view is
correctly targeting visible nodes but the canvas minimum zoom clamps the actual
viewport too tightly; a live route page recomputes the global packed graph
layout during normal page rendering instead of loading a current generated
layout artifact.

Default artifact node titles must name the artifact, not the exposure thesis.
Supplier names, tickers, public-company hints, and verdict suffixes such as
"limiting tool" belong in detail, evidence, exposure, metrics, notes, or route
copy. The same rule applies to localized canvas labels. Proper nouns are
acceptable when they are the literal product, architecture, or standard being
modeled, but not when they are merely example vendors in a component/equipment
title.

Route onboarding and node detail are separate information layers. "Start here"
/ "从这里开始" may guide the route, but it is not a peer state of
selected-node detail; the UI must not present it alongside "Detail" / "详情" as
equivalent selected-node modes.

The Cost lens must declare what edge color and width encode. If width is route
contribution, confidence, or another derived signal rather than target-node
absolute cost, the legend/detail rail must explain that distinction.

### 3c. System overview / route-default system read

The default rail state before a node is selected is a **system overview**, not
selected-node detail and not route navigation. It must help a public-market
retail investor or industry researcher understand the product system at the
right level before drilling into nodes.

The accepted information architecture is:

1. **System thesis** — one concise sentence that frames the system-level
   question without duplicating the graph or table rows.
2. **Row contract table** — the seven reader-facing rows below, placed directly
   under the system overview thesis. The UI should not add a visible
   intermediate heading such as `System read` / `系统读法`; `System read` is the
   internal QA contract name, not a required display layer.
   The row contract should sit directly in the rail, not inside another
   bordered card. Light row separators are fine; an outer card border or accent
   stripe below the `System overview` heading makes the surface look like an
   unnecessary extra layer.

Do not add a separate dashboard-style 2x2 "core readout" to the route-default
system overview unless it adds a genuinely new decision layer. The graph
already covers visual chokepoint orientation, and the row contract table
should carry the explanatory content. A 2x2 that merely repeats `System target`,
`Constraint mechanism`, `Improvement path`, or `Industry-chain impact` fails.

Required `System read` rows:

| Row | Required content |
|---|---|
| **System target** | The concrete product/system outcome that must be delivered. |
| **Production path** | The high-level path from major inputs/modules to a shippable system. This gives users enough process context to understand later constraints. |
| **Constraint mechanism** | The system-specific causal mechanism by which one slow, scarce, low-yield, concentrated, or hard-to-substitute step constrains total throughput. |
| **Improvement path** | The current most effective improvement direction for the whole product/system, stated in reader language and grounded in graph chokepoints. Do not expose internal "MinCut" terminology in the overview. |
| **Industry-chain impact** | The commercial/investor-facing implication: where orders, capex, pricing power, supply priority, or resource concentration are likely to accrue along the chain. |
| **Main risks** | Concrete ways the system conclusion can fail or slow down, such as mismatched expansion, yield ramp, demand reversal, concentration, qualification, or policy constraints. |
| **Evidence support** | The positive conclusion that current evidence supports. Product overview copy should not expose internal defects such as "needs evidence" or "still missing data"; evidence gaps belong to owner/QA surfaces. |

Quality bar:

- Every row must add non-overlapping information. If two row labels can be
  swapped without changing the meaning, the overview fails.
- Each row must be specific to the current system. A sentence that can be
  moved unchanged from AI compute to humanoid robotics, reusable launch, or
  another domain fails unless it names a genuinely shared modeled mechanism.
- Domain nouns alone are not enough. The copy must explain a causal mechanism,
  observable signal, or decision implication.
- Use positive conclusions. Avoid filler such as "do not just look at X" unless
  the sentence immediately replaces it with a concrete, system-specific read.
- Keep the overview at system level. It may name major system objects such as
  HBM, advanced packaging, reducers, actuators, launch cadence, or heat shield
  refurbishment, but it must not turn into a node-navigation list, supplier
  card, ticker pitch, equipment dump, or implementation manual.
- Commercial impact must serve the target user: an investor/operator/researcher
  should understand what part of the chain becomes more important, not receive
  generic "demand strong, supply tight" phrasing.
- Company names and tickers appear only when the overview has direct graph and
  evidence support and the route access state allows it. Otherwise, company
  exposure belongs in node detail/exposure surfaces.
- The whole visible overview surface is in scope: headings, eyebrow text,
  section subtitles, small right-side labels, tile labels, helper copy, and
  table cells. A small label such as `TOC lens` can fail the overview if it
  exposes framework or internal vocabulary.

Grounding and selection rules:

- Prefer active, reviewed or machine-verified evidence for reader-facing
  claims. Do not use `deprecated`, `failed`, dead-source, or rejected evidence
  to support an overview claim.
- Structural graph facts such as direct `requires` edges, `bottleneckOf`,
  `capacityLeadTimeMonths`, tags, and reviewed node descriptions may support a
  system-level overview, but they must not be used to introduce unsupported
  numbers, company/ticker claims, or sole-source language.
- If several bottlenecks are jointly required for throughput, state the
  coupled constraint set instead of forcing a false single "top" chokepoint.
  A single improvement path is required, but it may be a coupled path such as
  "increase HBM supply, advanced packaging capacity, substrate/interposer
  supply, and test throughput together" when the graph supports that coupling.
- When `bottleneckOf`, direct production-path dependencies, chokepoint score,
  and evidence strength disagree, choose the row wording in this order:
  direct production-path constraints with active evidence; authored
  `bottleneckOf` tied to the product/root; quantified or reviewed capacity /
  yield / lead-time evidence; then lower-confidence graph tags. If no clear
  order emerges, say the system is constrained by a named coupled set rather
  than inventing a precise ranking.
- `Improvement path` must name the concrete system-level improvement mode:
  capacity expansion, yield/test improvement, qualification of additional
  suppliers or routes, second-source ramp, substitution, or integration
  throughput. It cannot only restate the constrained objects.
- `Industry-chain impact` may identify affected chain positions, exposure
  surfaces, or diligence priorities. Claims such as order growth, pricing
  power, capex concentration, or supplier budget capture require evidence
  support for the relevant chain position; otherwise use more conservative
  language such as "diligence should focus on" or "resource pressure is likely
  to concentrate around".
- Grouped commercial outcome claims are judged per chain position and per
  outcome. For example, saying that HBM, advanced packaging, substrates, and
  test equipment all gain orders, pricing power, and capex requires support
  for each material combination; otherwise the overview must narrow the
  outcome or phrase it as a diligence focus.
- `Evidence support` must contain only positive, reader-facing conclusions
  supported by current evidence. It must not contain navigation, placement, or
  implementation copy such as "node detail will show..." / "在节点详情中展开".

Hard fails:

- Missing `Production path`, `Improvement path`, `Industry-chain impact`, or
  `Evidence support`.
- Visible internal jargon such as `MinCut`, raw model diagnostics, or UI
  instructions in the reader-facing overview.
- Generic TOC / SWOT / value-chain framework prose that is not grounded in the
  current graph.
- User-facing copy that describes product data gaps or "needs verification"
  instead of stating what current evidence supports.
- Any visible overview microcopy exposes a framework label or internal term
  such as `TOC lens`, `MinCut`, raw score axes, or QA/data-readiness wording.
- `Improvement path` only says to "improve the bottleneck", "increase the
  shortest resource", or another tautology without naming the current
  system-level improvement direction.
- `Industry-chain impact` only says "prices rise", "orders increase", or
  another generic capacity-shortage outcome without identifying the affected
  chain positions.
- `Evidence support` contains navigation/placement instructions, references to
  future detail surfaces, or unsupported assurance language.

For any implementation or content update that changes a system overview, QA
must score each row against this contract before the change is accepted. Passing
build/lint is not acceptance.

Scoring does not override hard fails. If a row has one useful sentence plus a
forbidden tail such as navigation copy, framework labels, or unsupported
commercial certainty, the surface still fails. The row may score `1` only to
record that part of the content is reusable; it cannot be accepted until the
forbidden text is removed or rewritten.

### 3d. Website-level chokepoint scenarios

From the rendered site (no repo access), an investor/operator/analyst can answer: the biggest chokepoint and which axis drives it; who supplies the chokepoint node and whether they're public/private; the rolled-up cost vs target and the coverage gap; where the evidence is weak.

### 3e. Compliance guardrail

MinCut is an **analytical tool, not stock advice**. No "buy ticker X", no unaudited-return claims, no "Serenity-certified" language. Exposure/ticker context must read as evidence, not a recommendation.

For a paid launch, the purchase and support policy must be reachable before
checkout and state the actual offer in plain language: the one-time price,
what the current collection includes, that there is no automatic renewal or
promised update schedule, the refund window, how to contact support and
restore access, what payment/usage data is handled, and that the research is
not investment advice. Internal operator routes must not be publicly reachable
or indexable in production.

The current low-price snapshot experiment keeps three commercial states
separate: `entitlement` is the technical access boundary, `allAccessRole`
declares whether a route is in the current $9 collection, and `portfolioState`
states research/evidence maturity. A clearly labeled `audit-preview` may be
included in the current snapshot only when its role and maturity are visible at
the offer and route entry. `core` is a bundle role, not a higher evidence grade;
early-research and hypothesis add-ons must keep those labels after unlock.
Payment never relaxes the evidence bar: each surfaced company lead still needs
a concrete graph path, relationship type, visible review/source state, and an
explicit limitation. An entitlement by itself must never create a checkout.
Paid-delivery readiness also requires an actual completed Checkout Session to
traverse `/unlock` and deliver the four exposure layers. When live credentials
are unavailable, a real Stripe test-mode `$9` Session is sufficient only when
the repository's delivery verifier also proves the secure cookie, all-access
scope, AI Compute free state, replay recovery, and invalid-Session failure;
configuration checks and mocked Stripe responses alone are insufficient.

---

## 4. Machine floor (`check:disclosure`)

A new automated check (to be built) enforces the cheapest slice without an agent:

- the first-glance chokepoint headline is present in the rendered detail surface, with Cost kept separate from the structural reason;
- the detail headline has a dedicated zero-holder Concentration gap path, so a missing modeled holder set cannot render as "0 suppliers" / "仅 0 家";
- nonzero holder-count copy is explicitly framed as modeled holder coverage and generic UI strings cannot render "only / sole / exclusive / 仅 / 唯一" from `holdersForNode` counts;
- user-facing structural nodes and supplier leads have an explicit-or-estimated answer for relief timing and supplier commercial scale, with estimates labeled as proxies rather than reviewed facts;
- user-facing numeric estimates use reader wording (`est.`, `估算`, or `约`) rather than internal percentile labels such as `P50` / `p50`;
- parent/child structural decomposition respects cost-scale rollup and relief-cycle max constraints, so authored parent values cannot be lower or shorter than the direct children shown below them, and unsourced child estimates are bounded by direct authored parent cost/capex values when no better child source exists;
- canvas lens labels match the §2 vocabulary (3b) by static assertion.

It is **necessary, not sufficient** — it cannot judge whether disclosure is *clear*; that stays with the QA agent.

---

## 5. Verdict spine (QA → Master)

The QA agent emits `pass | conditional_pass | fail` with per-criterion evidence (commands, browser URL + viewport, journeys, findings). The Master agent maps it:

| QA verdict | Master decision | When |
|---|---|---|
| `fail` | `fix_next` | a §3 criterion is violated and the fix is clear |
| `fail` | `ask_user` | the product-goal interpretation is genuinely ambiguous |
| `conditional_pass` | `defer` | known gaps are **visible + documented** and don't block the v0 loop |
| `pass` | `accept` | all §3 criteria met with browser evidence |
| any | `stop` | the direction conflicts with repo goals |

The Master may reject an implementation that passes machine gates but fails §3 — passing tests is not passing acceptance.

---

## 6. The router — which gates per change type

| Change type | Machine gates | Agent acceptance |
|---|---|---|
| **data** | `validate:data`, `check:active-graph-scope`, gate `--dry-run` | evidence-audit agent if claims/sources changed |
| **scoring / lib** | `lint`, `build`, `test` | — (covered by review) |
| **UI / lens / canvas** | `lint`, `build`, `check:graph-ux`, `check:graph-topology`, `check:graph-layouts`, **`check:disclosure`** | **QA agent §3 (browser, mandatory)** |
| **product surface** (detail, disclosure) | above + `check:disclosure` | **QA agent §3 + §3d scenarios** |
| **commercial launch** | `check:commercial-readiness` | QA agent §3 + §3d + §3e |

> **Rule:** any change that touches what the user sees runs the QA agent against §3. Machine-green is never sufficient for a UI/product change.

---

## 7. How to run an acceptance pass

1. Classify the change (§6) and run its machine gates.
2. For UI/product changes: clean dev server + the QA agent walks the rendered product against §3, in a browser, producing `pass | conditional_pass | fail` + evidence.
3. Master maps the verdict (§5) and decides `accept | fix_next | ask_user | defer | stop`.
4. Record evidence (screenshots / scenario answers) under `docs/ux-flow-reports/<date>-<head>-*.md`.

---

## 8. Out of scope (tracked elsewhere)

Evidence/source honesty (audit agent); the full UX flow-tour rewrite for ADR-0007 (`docs/ux-flow-tours.md`); cross-product / multi-layer view (future ADR). This standard is the *contract*; `docs/QA-agent.md` is updated to run §3, `docs/master-agent.md` to use §5, and `docs/TESTING.md` / `docs/coding-agent.md` to reference §6.
