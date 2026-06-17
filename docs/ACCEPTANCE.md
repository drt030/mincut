# MinCut — Acceptance Standard

> **MinCut** — *Find the bottlenecks in how things get made.*
>
> This is the single front door for "is this change done, and does it meet the bar?" It exists so that **"an agent says pass" and "the owner spots a problem on sight" converge**. Per the project rule: for ANY new requirement or change, this standard is updated and approved BEFORE implementation starts.

Status: active working standard, updated 2026-06-17. Owner decisions from 2026-06-17 supersede older docs where conflicts exist. This document defines *what counts as pass*; `docs/QA-agent.md` defines *how to run* the QA agent and points back here.

---

## 0. Who judges what (no overlap)

| Layer | Judges | Owner |
|---|---|---|
| **Machine gates** | structure & schema: `lint`, `build`, `check:graph-ux`, `check:graph-topology`, `validate:data`, `check:disclosure` (new, §4) | automated, hard-fail |
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
- **If Concentration is elevated, is the supplier state worded honestly?** A known small holder set may say "2–3 家" / "{N} makers"; a zero-holder model state means supply-source gap or unverified holder coverage, not a confirmed "0 suppliers" / "仅 0 家" count.
- **How much money is attached?** — Cost may appear as a separate magnitude line or Cost lens, but must not be phrased as the reason the node is a chokepoint.
- The Cost + Dependency + Concentration + Barrier breakdown is available on drill-in, with Cost visually and verbally separated from the structural Chokepoint reason.

**Fails** if: the answer is buried (needs digging), shown as internal jargon, the elevated axis isn't surfaced, or a zero-holder Concentration gap is presented as a confirmed supplier count. (Whether each nonzero number is *correct* is the audit agent's job, not this checklist's.)

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
reported or key default-visible artifact/material/equipment nodes are clipped
outside the canvas wrapper on initial load, including cases where fit-view is
correctly targeting visible nodes but the canvas minimum zoom clamps the actual
viewport too tightly.

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

### 3c. Website-level chokepoint scenarios

From the rendered site (no repo access), an investor/operator/analyst can answer: the biggest chokepoint and which axis drives it; who supplies the chokepoint node and whether they're public/private; the rolled-up cost vs target and the coverage gap; where the evidence is weak.

### 3d. Compliance guardrail

MinCut is an **analytical tool, not stock advice**. No "buy ticker X", no unaudited-return claims, no "Serenity-certified" language. Exposure/ticker context must read as evidence, not a recommendation.

---

## 4. Machine floor (`check:disclosure`)

A new automated check (to be built) enforces the cheapest slice without an agent:

- the first-glance chokepoint headline is present in the rendered detail surface, with Cost kept separate from the structural reason;
- the detail headline has a dedicated zero-holder Concentration gap path, so a missing modeled holder set cannot render as "0 suppliers" / "仅 0 家";
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
| **UI / lens / canvas** | `lint`, `build`, `check:graph-ux`, `check:graph-topology`, **`check:disclosure`** | **QA agent §3 (browser, mandatory)** |
| **product surface** (detail, disclosure) | above + `check:disclosure` | **QA agent §3 + §3c scenarios** |
| **commercial launch** | `check:commercial-readiness` | QA agent §3 + §3c + §3d |

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
