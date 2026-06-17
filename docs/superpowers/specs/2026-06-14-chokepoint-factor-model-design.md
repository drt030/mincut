# Chokepoint factor model + first-glance disclosure contract — design

**Date**: 2026-06-14
**Author**: brainstorming session (Claude Opus 4.8)
**Status**: design, pending user review (no code written yet)
**Builds on**: `docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md` (ADR-0008 ontology, shiso-leaf investor focus, `transactability`, supply concentration, reserved `capacityLeadTimeMonths`). Touches ADR-0002 / ADR-0005 (maturity framing), ADR-0006 / ADR-0007 (graph surface). A new **ADR-0010** will record the factor model + composite redefinition (ADR-0009 is already taken — supplier-edge semantics).

## Problem / motivation

Three threads converge here.

1. **Commercial intent.** The repo's near-term goal is to ride the **白毛股神 / Serenity** AI-supply-chain hype (overseas chokepoint investor, viral in Chinese finance media June 2026; audience is **US-first, then global**). Her "瓶颈 / chokepoint theory" is *the same persona the repo already committed to on 2026-06-10* — the shiso-leaf hunter of irreplaceable, high-barrier, supply-concentrated, market-ignored upstream segments — now validated by a live hype wave. So this is a sharpening, not a pivot.

2. **The recurring acceptance failure.** Agents repeatedly report "pass" while the user instantly spots problems (low-level UI, disclosure violations, not-user-centered). Root cause: the *enforceable* layer measures code-strings (`check:graph-ux`) and data-schema (`validate:data`); the failures live at the **rendered-experience + first-glance-disclosure** altitude, where there is no gate. The fix is a **disclosure contract** that makes the right information first-glance-visible, made part of acceptance.

3. **"Maturity" is a vague, audience-burdening axis.** For a commercial / procurable node, maturity is high by construction and carries no signal; the real risk is concentration / cost / replication difficulty. The factor taxonomy needs to be concrete, audience-neutral, theory-grounded, and matched to Serenity's lens.

## Decisions

### 1. Four structural axes (the chokepoint factor model)

The node-level factor taxonomy. Each axis is irreducible and absorbs prior ad-hoc factors. Grounded in established frameworks (Kraljic purchasing portfolio; EU critical-raw-materials supply risk; TRL/MRL readiness; Buffett/Morningstar economic moat) and matched to Serenity's reverse-engineered screen.

- **Cost (成本)** — value at stake per unit: node cost ÷ parent rollup (interval cost, ADR-0003, already computed). Hard number.
- **Criticality (关键性 / downstream dependency)** — **NEW axis.** Capex-weighted downstream demand routing through the node: reverse-`requires` traversal from the node up to ancestor products, **each ancestor product weighted by its evidence-backed capex / demand scale, not counted equally** — so Criticality = Σ over ancestor products (fan-in share × product capex). Bones: `graphTraversal.ts`; sharing already tracked by `multiParentVisibleNodes`. This is the **downstream** direction ("who depends on it") — explicitly *not* supplier dependency (that is Concentration) and *not* the node's own inputs (handled by recursion on its children). Demand-certainty / capex is **evidence-backed product data**, not a separate axis. **Scope reality:** capex-weighting only *re-orders* nodes when a node is shared across *multiple products* (the deferred cross-product view); within a single product the product's capex is a constant multiplier, so within-product it yields an absolute "demand-at-stake" magnitude for display while the *ranking* is driven by structural fan-in. The formula is written cross-product-ready now so the deferred view drops in without a rewrite.
- **Concentration (集中)** — supply fragility: holder count (distinct non-deprecated orgs via `manufactured_by` / `implemented_by`, `supplyConcentration.ts`, ≤3 = concentrated) **plus geographic / sovereign concentration** — the audience-neutral, US-first reframe of "国产替代" (export-control / sovereign access risk, works in both directions).
- **Barrier (壁垒)** — how hard to replicate / substitute / build, assembled from the signals that actually have data: `transactability` (`must_build` ⇒ high), `hard_to_develop` tag, technical readiness (`maturityScore` / `maturityLabel`), capacity-expansion speed (`capacityLeadTimeMonths`, reserved 2026-06-10, mostly unpopulated). **Substitute count is deferred** — the `substitutes` edge relation exists in schema but has **0 instances in current data**, so it joins later when populated. **Maturity dissolves into Barrier** — it is no longer a user-facing axis or a first-glance label; it becomes one internal input to Barrier, surfaced (as "is it proven / how far built") only for `must_build` / frontier nodes.

**Hard→soft spectrum (and why it matters):** Cost and Concentration are hard graph-derived numbers; Criticality is structural; **Barrier is judgment-heavy** (assembled from proxies). The softer the axis, the more the evidence layer must carry it — every Barrier claim must carry a rationale + evidence (`evidenceIds`, default `unreviewed`), or it degrades into Serenity-style unsourced assertion. This is exactly where the documented moat (4-tier evidence-review ladder + local validation gate) earns its keep.

### 2. Composite chokepoint axis (redefine `bottleneck-risk`; activates the deferred "Opportunity color mode")

Two-level information architecture: **4 component axes** (drill-in, each independently judged and evidenced) **+ 1 composite chokepoint score** (the headline / default lens).

- **Composite = geometric mean of the three quantile-normalized axes:** `chokepoint = (crit̂ · conĉ · barr̂)^(1/3)`, each `x̂` **quantile-normalized to [0,1]** over the active graph's node distribution — the same empirical-quantile method `bandForCost` already uses (Q20/Q40/Q60/Q80), so heterogeneous raw units (capex-weighted fan-in, integer holder counts, the Barrier sub-composite) become commensurate. Concentration is **inverted** first (fewer holders ⇒ higher; 0 holders ⇒ max). Barrier is itself a sub-composite of {substitute count, `hard_to_develop` + rationale, `capacityLeadTimeMonths`, readiness}, normalized to [0,1] before entering.
- **Why geometric mean, not raw product:** it *is* the multiplicative form (honors the multiplicative structure) and preserves **真瓶颈 vs 伪瓶颈** suppression — any one low axis drags the score down — but it does **not** collapse toward zero the way `0.5 × 0.5 × 0.5 = 0.125` does, so the bands stay populated. **Then band the composite by its own empirical quantiles** (Q20/Q40/Q60/Q80), mirroring `bandForCost`, so the warmest band always holds the top chokepoints regardless of residual compression.
- **Missing axis ⇒ flagged incomplete, never silently zeroed.** An unknown must not masquerade as a confident 0 and kill the score; compute over the known axes and mark the node low-confidence (ties into the evidence layer).
- **Cost is an orthogonal $-magnitude overlay** — it sizes the prize, it does not decide chokepoint-ness. A cheap-but-everything-depends-on-it node (InP substrate) must still score as a top chokepoint; folding cost into the composite would hide it.
- This **redefines `nodeRisk`** (`src/lib/nodeRisk.ts`, today `(1 − maturityScore/100) × cost_share`, forced-high on non-empty `bottleneckOf`; consumed by `edgeStyleFor.ts`) into the pipeline above. It activates the **"Opportunity color mode"** deferred on 2026-06-10.

### 3. First-glance disclosure contract (首屏信息充分性)

The heart of the acceptance standard. For every node/surface, the user must **see what they want at first glance** — completeness and salience, not correctness.

- **Three principles:** progressive (don't disclose what isn't wanted), direct (what *is* wanted is visible at first glance, no clicking/scrolling/hovering), sustained (the relevant readout persists across lens-switch and drill-down — ADR-0007 stable identity).
- **Three-question test** per user-question on a surface: (1) present? (2) first-glance? (3) in the user's own terms, not an internal abstraction?
- **Node-kind-conditional first glance:** light up only the *elevated* axis(es) for this node. No abstract tag (maturity / bottleneck) at first glance — cash it into a concrete, decision-relevant headline: e.g. "可外购，但供应高度集中" (procurable · concentrated) / "瓶颈：成本 + 供应集中" / "必自建 + 验证到哪一步".
- **Correctness/honesty is explicitly OUT of scope here** — qualifier salience, vendor/proxy disclosure, claim verification are the **audit agent's** job (the evidence-review ladder, the documented moat). This contract governs *completeness + first-glance*, not whether a number is right.
- **Per-node chokepoint checklist = the per-node acceptance rubric.** A node page passes when a user can, at first glance, run Serenity's screen on it: real chokepoint? cost share? who depends on it / what capex pulls it? barrier / sovereign exposure? evidence weakness? Making this the acceptance test is what makes *agent-pass* and *user-pass* converge.

### 4. Criticality display — the multi-parent / DAG problem

The data is a **DAG** (nodes carry multiple `parentIds`; `graphTopologyAudit.ts` already tracks `multiParentVisibleNodes`); the canvas renders a **tree** (one `primaryParentId` per node). Criticality — a node shared by many parents — is therefore **computable but tree-hidden**.

- **Compute ≠ display.** Criticality feeds the composite score today regardless of layout (the hidden parent edges exist in data). The axis is *not* dropped for a display limitation.
- **Why the tree hides it:** a tree renders divergence (decomposition) cleanly but cannot draw convergence (sharing) via edges. Decomposition-readability (ADR-0007) and chokepoint-visibility pull opposite ways; this is structural, not a bug.
- **Display approach (within-product, respects ADR-0007):**
  - **Always-on node channel** — a badge / halo / size on the node = "depended on by N" (fan-in count). A switchable analysis channel per ADR-0007; positions stay stable. Extends the 2026-06-10 red-ring badge precedent.
  - **On-demand re-root "dependents" view** — selecting a node flips the radial tree to root *on* that node, with everything that depends on it radiating outward. Reuses the same stable radial-tree layout (no hairball); it is the chokepoint's-eye view of "who can't do without me".
- **Scope: within-product now.** Cross-product criticality (Serenity's "InP underpins *all* AI optical products") is **deferred** — it requires a multi-product / multi-layer view that supersedes the single-tree ADR-0007, which is a fundamental view-architecture change and its own ADR.

### 5. Investor overlay stays out of the structural product (compliance)

Serenity's five-factor screen splits into structure (kept) and investor judgment (kept out):

- **Demand-certainty** → folds into Criticality as evidence (capex commitments).
- **Mispricing / 认知错配** → **dropped from the product.** It needs a live valuation/price view the repo does not have, it is a market opinion not a structural fact, it is the locus of Serenity's post-hoc-narrative flaw, and surfacing "underpriced" crosses the **荐股** line. (Already recorded as "explicitly not modelled; the user judges this themselves" on 2026-06-10.)
- **Catalyst** → **deferred.** A dated-event feed is an ongoing data-ops burden on a static structural graph, and is trade-timing-flavored.
- The investor persona is served *by* the four structural axes; the user forms their own mispricing / catalyst view. The product makes **no trade calls.**

### 6. Positioning & compliance guardrails

- **Positioning:** "Serenity's chokepoint lens, rendered as a rigorous, evidence-checked, navigable graph." Borrow the lens and vocabulary (瓶颈 / chokepoint, 紫苏叶); do **not** borrow the hype, the unaudited returns, or stock recommendations.
- **Differentiator = the documented moat.** Per `competitive-landscape.md`, the 4-tier evidence-review ladder + local validation gate are absent in all 7 deeply-verified competitors. They are precisely what Serenity lacks: her cited metrics do not hold (绿的谐波 "60% share" vs independent 28–35%; AXTI "40%" mis-transmitted as 90%; ignored gross-margin compression 53%→33.6%). Our evidence-status surfacing shows each claim *with* its review status and conflicts — that is the product's reason to exist next to her.
- **Compliance:** analytical / educational tool, not 跨境荐股. No "buy ticker X", no "Serenity-certified" marketing, no leaning on unaudited returns. The existing `InvestorAnswerPanel` caveat ("候选暴露…不等于投资建议") is already on the safe side; keep that posture everywhere.

## Blast radius / containment

- **Tier A — presentation (do now):** first-glance headline derivation; criticality badge + re-root view; composite redefinition. Files: `NodeDetailRail.tsx`, `NodeDetailPanel.tsx`, `edgeStyleFor.ts` (`nodeRisk`), a criticality helper over `graphTraversal.ts`, `radialLayout.ts` (re-root). Tests to update: `detailRail.test.ts` (pinned to the maturity badge), `graphControls.test.ts` (lens legend).
- **Tier B — lens/legend vocabulary (same pass as A):** rename the `maturity` lens to a Barrier / "must-build frontier" reading; align legend wording so canvas vocabulary matches the detail panel (the one real consistency risk — must ship together with A, never apart).
- **Tier C — data re-model (NOT now):** `maturityLabel` stays as an internal field (it drives the ADR-0005 decomposition-stop and the lens). No schema churn, no ADR supersession in this iteration.

## Considered alternatives

- **Keep maturity as a standalone user-facing axis** — rejected: vague, cognitive burden, conflates TRL / buyability / concentration.
- **Merge Cost + Criticality into one "value at stake" axis** — rejected: hides the cheap-but-critical chokepoint (InP / the $50 laser gating a $5M cluster), which is Serenity's signature signal.
- **Full DAG layout to draw shared dependencies** — rejected: breaks ADR-0007 stable positioning; use the badge + re-root view instead.
- **Model mispricing / catalyst in-product** — rejected: subjective, needs live price data, and crosses the stock-recommendation compliance line.

## Non-goals (roadmap, not this iteration)

- Cross-product / multi-layer chokepoint view (supersedes ADR-0007) — future ADR.
- Catalyst event feed.
- The broader acceptance-process plumbing — verdict-spine mapping (QA `pass|conditional_pass|fail` ↔ master `accept|fix_next|ask_user|defer|stop`), and a `docs/ACCEPTANCE.md` change-type → gate router. This design delivers the per-node disclosure rubric that is the *heart* of that standard; the plumbing is a separate spec.
- Uncertainty-math upgrade (Guesstimate / Squiggle-style distribution sampling) — a known competitive weakness, separate track.

## Acceptance sketch

1. A node's first-glance detail shows the *elevated* axis as a concrete headline; no abstract "maturity: X" appears at first glance.
2. A shared node shows a "depended on by N" badge; selecting it offers a "who depends on me" re-root view.
3. The default lens ranks nodes by the composite chokepoint score (Criticality × Concentration × Barrier), not the old `(1 − maturity) × cost`.
4. Every Barrier claim in the panel carries a rationale + evidence, or is flagged.
5. Lens-legend vocabulary matches detail-panel vocabulary (no maturity / risk / buyability conflation visible to the same user at once).
6. No stock-ticker buy-calls and no unaudited-return claims anywhere in the product surface.

## Open questions / tuning (for ADR-0009)

- ~~Composite weights / curve~~ **resolved (2026-06-14): geometric mean of per-axis quantile-normalized [0,1] values, then quantile-band the composite** (reuses the `bandForCost` empirical-quantile pattern). Equal exponents (1/3) initial, tunable. Missing axis → flagged incomplete, not zeroed.
- ~~Criticality demand-weighting~~ **resolved (2026-06-14): weight ancestor products by evidence-backed capex / demand scale, not equally** (Criticality = Σ fan-in share × product capex). It re-orders nodes only cross-product (deferred); within-product it sets absolute magnitude, not ranking. Requires capex / demand-scale captured as evidence-backed data on `product` nodes — a population task, `unreviewed` by default.
- ADR scope: ADR-0010 records the factor model + composite; ADR-0002 / ADR-0005 get an amendment noting maturity is now an internal Barrier input, not a user-facing axis.
