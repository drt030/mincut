# MinCut — Acceptance Standard

> **MinCut** — *Find the bottlenecks in how things get made.*
>
> This is the single front door for "is this change done, and does it meet the bar?" It exists so that **"an agent says pass" and "the owner spots a problem on sight" converge**. Per the project rule: for ANY new requirement or change, this standard is updated and approved BEFORE implementation starts.

Status: draft pending owner approval (2026-06-15). Supersedes the scattered acceptance criteria in `docs/QA-agent.md` (rubric moves here; that doc becomes the *how-to-run* for the QA agent and points back here).

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

- **Four axes**: **Cost** · **Dependency** (downstream criticality) · **Concentration** (supply fragility + geography) · **Barrier** (replication / substitution difficulty; absorbs the old "maturity").
- **Composite — Chokepoint**: `(dependency × concentration × barrier)` geometric mean; Cost is an orthogonal $-overlay, not folded in.

**Canvas lenses — exactly three:**

1. **System decomposition** — structure only, no analysis coloring.
2. **Chokepoint** — the composite (default lens).
3. **Cost** — where the money is (orthogonal to chokepoint-ness).

There is **no Maturity lens** and **no separate Dependency / Concentration / Barrier lens**. The four-axis breakdown lives in the **node detail panel** (drill-in), with the elevated axis surfaced first.

---

## 3. The acceptance rubric (what the QA agent checks)

### 3a. Per-node first-glance chokepoint checklist

For any node a user inspects, at **first glance** they can answer — in plain language, not raw internal labels:

- **Is it a chokepoint, and how much of one?** (the composite verdict)
- **Which axis makes it one?** — the *elevated* axis among Cost / Dependency / Concentration / Barrier, stated concretely (e.g. "可外购，但供应高度集中（2–3 家）" / "瓶颈：成本 + 集中"), **not** a raw tag like `maturity: prototype`.
- The full four-axis breakdown is available on drill-in.

**Fails** if: the answer is buried (needs digging), shown as internal jargon, or the elevated axis isn't surfaced. (Whether each number is *correct* is the audit agent's job, not this checklist's.)

### 3b. Vocabulary consistency

Canvas lens labels == detail-panel vocabulary == §2 model. **A mismatch is a fail** (e.g. a "Maturity" or "Bottleneck risk" lens label after the model moved to Barrier/Chokepoint). *(This is the check that would have caught the lens-label drift on 2026-06-15.)*

### 3c. Website-level chokepoint scenarios

From the rendered site (no repo access), an investor/operator/analyst can answer: the biggest chokepoint and which axis drives it; who supplies the chokepoint node and whether they're public/private; the rolled-up cost vs target and the coverage gap; where the evidence is weak.

### 3d. Compliance guardrail

MinCut is an **analytical tool, not stock advice**. No "buy ticker X", no unaudited-return claims, no "Serenity-certified" language. Exposure/ticker context must read as evidence, not a recommendation.

---

## 4. Machine floor (`check:disclosure`)

A new automated check (to be built) enforces the cheapest slice without an agent:

- the first-glance elevated-axis headline is present in the rendered detail surface;
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
