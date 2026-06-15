# Chokepoint Scoring Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four-axis chokepoint factor model and a normalized geometric-mean composite score in a pure `src/lib` module, then point the `bottleneck-risk` lens at it — no UI work.

**Architecture:** A new `src/lib/chokepointScore.ts` computes three structural axes per node (Criticality = capex-weighted downstream fan-in; Concentration = inverted holder count; Barrier = a sub-composite of `transactability` / `hard_to_develop` / readiness / lead-time). Each axis is quantile-normalized to [0,1] over the active graph (the `bandForCost` pattern), combined by geometric mean, and banded by the composite's own empirical quantiles. Cost stays the existing orthogonal overlay. The `bottleneck-risk` band in `edgeStyleFor.ts` switches from `nodeRisk` to this composite. Maturity becomes an internal Barrier input, not a user-facing axis.

**Tech Stack:** TypeScript, Zod (schema), `node:test` + `node:assert/strict` (tests run via `npm test`), existing helpers `holdersForNode` (`supplyConcentration.ts`) and the quantile pattern in `edgeStyleFor.ts`.

**Spec:** `docs/superpowers/specs/2026-06-14-chokepoint-factor-model-design.md`

---

### Task 1: Record the decision (ADR-0010)

**Files:**
- Create: `docs/adr/0010-chokepoint-factor-model.md`

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0010-chokepoint-factor-model.md`:

```markdown
---
status: accepted
---

# Chokepoint factor model = four axes + geometric-mean composite

## Context

The `bottleneck-risk` lens ranked nodes by `nodeRisk = (1 - maturity/100) × cost_share`. That conflates maturity with cost and misses the chokepoint signal Serenity's audience cares about: a cheap component that everything depends on (InP substrate). "Maturity" is also a vague user-facing axis. See `docs/superpowers/specs/2026-06-14-chokepoint-factor-model-design.md` and the 2026-06-10 know-how-layer design.

## Decision

Four structural axes per node:

- **Cost** — value share, unchanged (`nodeCostSignalRmb`, ADR-0003). Orthogonal overlay, NOT part of the chokepoint composite.
- **Criticality** — capex-weighted downstream fan-in: distinct decomposition-parents, times the summed `demandScale` of dependent ancestor products (default weight 1 when `demandScale` is unset). Within a single product the weight is constant, so within-product ranking is the structural fan-in; the formula is cross-product-ready.
- **Concentration** — `1 / (1 + holderCount)` from `holdersForNode` (0 holders ⇒ 1.0, the strongest flag).
- **Barrier** — mean of the available signals in {`transactability=must_build`, `hard_to_develop` tag, `1 - readiness`, `min(1, capacityLeadTimeMonths/36)`}. Substitute count is deferred (the `substitutes` relation has no data yet). Maturity enters here as readiness — it is no longer a user-facing axis.

Composite (the redefined `bottleneck-risk` score):

- Quantile-normalize each axis to [0,1] over the graph's node distribution (the `bandForCost` empirical-quantile method).
- Combine by **geometric mean over the axes that are known** for the node — multiplicative structure (one low axis drags the score down → 真/伪 chokepoint) without the zero-collapse of a raw product.
- A node missing an axis is scored over its known axes and flagged `incomplete`; an unknown axis is **never** treated as 0.
- Band the composite by its **own** empirical quantiles (Q20/Q40/Q60/Q80).
- Authored `bottleneckOf` still forces band 5 (authored override outranks the computed score), preserving existing behavior.

Initial geometric-mean exponents are equal (1/k). Tunable; revisit when calibrated against real screened nodes.

## Consequences

- New `src/lib/chokepointScore.ts`; `edgeStyleFor.ts` `bottleneck-risk` band switches from `nodeRisk` to the composite. `nodeRisk` / `nodeRiskSignal` stay for any other consumer but are no longer the lens authority.
- New reserved node field `demandScale` (population deferred, `unreviewed`).
- Amends ADR-0002 / ADR-0005: `maturityLabel` remains the internal decomposition-stop input but is no longer surfaced as a user-facing "maturity" axis; it feeds Barrier.

## Revisit when

- Cross-product criticality is built (needs the multi-product view that supersedes ADR-0007).
- `substitutes` edges or `developmentDifficulty` get populated — fold them into Barrier.
- The geometric-mean exponents need calibration against real screening outcomes.
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0010-chokepoint-factor-model.md
git commit -m "docs: ADR-0010 chokepoint factor model + geometric-mean composite"
```

---

### Task 2: Reserve the `demandScale` node field

**Files:**
- Modify: `src/lib/schema.ts:230` (inside `nodeBaseSchema`, after `capacityLeadTimeMonths`)
- Test: `tests/schema.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create or append to `tests/schema.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { nodeSchema } from "../src/lib/schema";

test("nodeSchema accepts an optional positive demandScale", () => {
  const parsed = nodeSchema.parse({
    id: "p1",
    name: "Product 1",
    kind: "product",
    domain: ["test"],
    demandScale: 50,
  });
  assert.equal(parsed.demandScale, 50);
});

test("nodeSchema rejects a non-positive demandScale", () => {
  assert.throws(() =>
    nodeSchema.parse({ id: "p1", name: "P", kind: "product", domain: ["test"], demandScale: 0 }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/schema.test.ts`
Expected: FAIL — `demandScale` is stripped/unknown or the positive refinement is absent.

- [ ] **Step 3: Add the field**

In `src/lib/schema.ts`, inside `nodeBaseSchema`, immediately after the `capacityLeadTimeMonths` field (line ~230), add:

```ts
  /**
   * Reserved (population deferred, `unreviewed` by default), per ADR-0010 and
   * the maturityHistory/​capacityLeadTimeMonths reserved-field pattern: a
   * `product` node's capex / demand scale, used to weight downstream
   * Criticality. Within a single product it is a constant multiplier; it
   * only re-orders nodes across multiple products (the deferred cross-product
   * view). Unset ⇒ Criticality weight defaults to 1.
   */
  demandScale: z.number().positive().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/schema.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Run data validation to confirm no regression**

Run: `npm run validate:data`
Expected: PASS — the field is optional, no existing node sets it.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts
git commit -m "feat(schema): reserve demandScale node field (ADR-0010)"
```

---

### Task 3: Criticality — downstream fan-in

**Files:**
- Create: `src/lib/chokepointScore.ts`
- Test: `tests/chokepointScore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/chokepointScore.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import type { Edge, GraphData, Node } from "../src/lib/schema";
import { criticalityRaw, dependentAncestors, directDependents } from "../src/lib/chokepointScore";

function node(id: string, extra: Partial<Node> = {}): Node {
  return { id, name: id, kind: "module", domain: ["test"], ...extra } as Node;
}
function edge(source: string, target: string, relation: Edge["relation"]): Edge {
  return { id: `${source}_${relation}_${target}`, source, target, relation } as Edge;
}
export function graph(nodes: Node[], edges: Edge[]): GraphData {
  return { nodes, edges, evidence: [] } as unknown as GraphData;
}

test("directDependents counts distinct decomposition parents pointing at a node", () => {
  // a and b both require shared; c requires a. shared has two direct parents.
  const g = graph(
    [node("a"), node("b"), node("c"), node("shared")],
    [
      edge("a", "shared", "requires"),
      edge("b", "shared", "requires"),
      edge("c", "a", "requires"),
      edge("a", "shared", "measured_by"), // non-decomposition edge: ignored
    ],
  );
  assert.deepEqual(directDependents(g, "shared").sort(), ["a", "b"]);
  assert.equal(criticalityRaw(g, "shared"), 2);
  assert.equal(criticalityRaw(g, "a"), 1);
});

test("dependentAncestors walks transitively up the decomposition DAG", () => {
  const g = graph(
    [node("root", { kind: "product" }), node("mid"), node("leaf")],
    [edge("root", "mid", "requires"), edge("mid", "leaf", "requires")],
  );
  assert.deepEqual([...dependentAncestors(g, "leaf")].sort(), ["mid", "root"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — module `../src/lib/chokepointScore` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/chokepointScore.ts`:

```ts
import type { Edge, GraphData, Node } from "./schema";
import { holdersForNode } from "./supplyConcentration";

/** Decomposition relations whose source depends on the target (ADR-0005). */
const DECOMPOSITION_RELATIONS: ReadonlyArray<Edge["relation"]> = [
  "requires",
  "part_of",
  "has_route",
  "implemented_by",
];

/** Distinct nodes that directly depend on `nodeId` via a non-deprecated
 *  decomposition edge (its parents in the requires-DAG). */
export function directDependents(graph: GraphData, nodeId: string): string[] {
  const parents = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.target !== nodeId) continue;
    if (edge.reviewStatus === "deprecated") continue;
    if (!DECOMPOSITION_RELATIONS.includes(edge.relation)) continue;
    parents.add(edge.source);
  }
  return [...parents];
}

/** All nodes that transitively depend on `nodeId` (reverse decomposition
 *  reachability). Excludes the node itself. */
export function dependentAncestors(graph: GraphData, nodeId: string): Set<string> {
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const parent of directDependents(graph, current)) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      queue.push(parent);
    }
  }
  return seen;
}

/** Structural fan-in: how many distinct parents directly depend on the node.
 *  Most tree nodes = 1; shared (multi-parent) chokepoints = >1. */
export function criticalityRaw(graph: GraphData, nodeId: string): number {
  return directDependents(graph, nodeId).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chokepointScore.ts tests/chokepointScore.test.ts
git commit -m "feat(chokepoint): criticality fan-in (directDependents/criticalityRaw)"
```

---

### Task 4: Capex weighting — Criticality value

**Files:**
- Modify: `src/lib/chokepointScore.ts`
- Test: `tests/chokepointScore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/chokepointScore.test.ts`:

```ts
import { criticalityValue } from "../src/lib/chokepointScore";

test("criticalityValue defaults demand weight to 1 when no demandScale, known when shared", () => {
  const g = graph(
    [node("root", { kind: "product" }), node("a"), node("shared")],
    [edge("root", "a", "requires"), edge("a", "shared", "requires"), edge("root", "shared", "requires")],
  );
  // shared has 2 parents (root, a), no demandScale -> value 2, weight unknown
  const r = criticalityValue(g, "shared");
  assert.equal(r.value, 2);
  assert.equal(r.known, true);
  assert.equal(r.demandKnown, false);
});

test("criticalityValue multiplies fan-in by ancestor product demandScale", () => {
  const g = graph(
    [node("root", { kind: "product", demandScale: 10 }), node("shared")],
    [edge("root", "shared", "requires")],
  );
  const r = criticalityValue(g, "shared");
  assert.equal(r.value, 10); // fan-in 1 × demandScale 10
  assert.equal(r.demandKnown, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — `criticalityValue` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/chokepointScore.ts`:

```ts
export type AxisValue = { value: number; known: boolean };
export type CriticalityValue = AxisValue & { demandKnown: boolean };

/** Sum of `demandScale` over the dependent ancestor products. Defaults to
 *  weight 1 (and demandKnown=false) when no ancestor product sets it. */
function demandWeight(graph: GraphData, nodeId: string): { weight: number; demandKnown: boolean } {
  const ancestors = dependentAncestors(graph, nodeId);
  const scales: number[] = [];
  for (const id of ancestors) {
    const n = graph.nodes.find((node) => node.id === id);
    if (n?.kind === "product" && typeof n.demandScale === "number") scales.push(n.demandScale);
  }
  if (scales.length === 0) return { weight: 1, demandKnown: false };
  return { weight: scales.reduce((a, b) => a + b, 0), demandKnown: true };
}

/** Criticality = structural fan-in × ancestor-product demand weight. */
export function criticalityValue(graph: GraphData, nodeId: string): CriticalityValue {
  const raw = criticalityRaw(graph, nodeId);
  const { weight, demandKnown } = demandWeight(graph, nodeId);
  return { value: raw * weight, known: raw > 0, demandKnown };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chokepointScore.ts tests/chokepointScore.test.ts
git commit -m "feat(chokepoint): capex-weighted criticality value"
```

---

### Task 5: Quantile normalizer

**Files:**
- Modify: `src/lib/chokepointScore.ts`
- Test: `tests/chokepointScore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/chokepointScore.test.ts`:

```ts
import { quantileNormalizer } from "../src/lib/chokepointScore";

test("quantileNormalizer maps min->0, max->1 by empirical rank", () => {
  const norm = quantileNormalizer([1, 2, 3, 4, 5]);
  assert.equal(norm(1), 0);
  assert.equal(norm(5), 1);
  assert.equal(norm(3), 0.5);
});

test("quantileNormalizer is robust to one or zero values", () => {
  assert.equal(quantileNormalizer([])(7), 0);
  assert.equal(quantileNormalizer([42])(42), 0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — `quantileNormalizer` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/chokepointScore.ts`:

```ts
/** Empirical-rank normalizer to [0,1] over a value distribution — the same
 *  idea as `bandForCost`'s quantile binning, generalized. Returns a function
 *  mapping a value to (count strictly below) / (n - 1). Ties share a rank. */
export function quantileNormalizer(values: number[]): (v: number) => number {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return () => 0;
  if (sorted.length === 1) return () => 0.5;
  const denom = sorted.length - 1;
  return (v: number) => {
    let below = 0;
    for (const s of sorted) if (s < v) below++;
    return Math.max(0, Math.min(1, below / denom));
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chokepointScore.ts tests/chokepointScore.test.ts
git commit -m "feat(chokepoint): empirical-quantile normalizer"
```

---

### Task 6: Concentration value

**Files:**
- Modify: `src/lib/chokepointScore.ts`
- Test: `tests/chokepointScore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/chokepointScore.test.ts`:

```ts
import { concentrationValue } from "../src/lib/chokepointScore";

test("concentrationValue is 1.0 at zero holders and decreases as holders grow", () => {
  const g = graph(
    [
      node("part", { kind: "material" }),
      node("o1", { kind: "organization" }),
      node("o2", { kind: "organization" }),
    ],
    [edge("part", "o1", "manufactured_by"), edge("part", "o2", "manufactured_by")],
  );
  const lonely = graph([node("scarce", { kind: "material" })], []);
  assert.equal(concentrationValue(lonely, "scarce").value, 1); // 0 holders
  assert.equal(concentrationValue(g, "part").value, 1 / 3); // 2 holders -> 1/(1+2)
});

test("concentrationValue is unknown for non-supply-chain kinds", () => {
  const g = graph([node("cap", { kind: "capability" })], []);
  assert.equal(concentrationValue(g, "cap").known, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — `concentrationValue` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/chokepointScore.ts`:

```ts
/** Kinds for which holder-based concentration is meaningful (ADR-0005/0008). */
const SUPPLY_CHAIN_KINDS = new Set<Node["kind"]>([
  "product",
  "module",
  "equipment",
  "material",
  "engineering_method",
  "manufacturing_process",
]);

/** Concentration = 1 / (1 + holderCount). 0 holders ⇒ 1.0 (strongest flag,
 *  per supplyConcentration's "zero = scarcity-or-gap" convention). */
export function concentrationValue(graph: GraphData, nodeId: string): AxisValue {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node || !SUPPLY_CHAIN_KINDS.has(node.kind)) return { value: 0, known: false };
  const { total } = holdersForNode(graph, nodeId);
  return { value: 1 / (1 + total), known: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chokepointScore.ts tests/chokepointScore.test.ts
git commit -m "feat(chokepoint): concentration value (inverted holder count)"
```

---

### Task 7: Barrier sub-composite

**Files:**
- Modify: `src/lib/chokepointScore.ts`
- Test: `tests/chokepointScore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/chokepointScore.test.ts`:

```ts
import { barrierValue } from "../src/lib/chokepointScore";

test("barrierValue is high for a must_build, hard, unproven node", () => {
  const g = graph(
    [
      node("hard", {
        kind: "engineering_method",
        transactability: "must_build",
        tags: ["hard_to_develop"],
        maturityScore: 20,
      }),
    ],
    [],
  );
  const r = barrierValue(g.nodes[0]);
  assert.equal(r.known, true);
  assert.ok(r.value > 0.8, `expected high barrier, got ${r.value}`);
});

test("barrierValue is low for a procurable, mature node", () => {
  const g = graph(
    [node("easy", { kind: "engineering_method", transactability: "procurable", maturityScore: 90 })],
    [],
  );
  const r = barrierValue(g.nodes[0]);
  assert.ok(r.value < 0.2, `expected low barrier, got ${r.value}`);
});

test("barrierValue is unknown when no barrier signal is present", () => {
  const g = graph([node("bare", { kind: "module" })], []);
  assert.equal(barrierValue(g.nodes[0]).known, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — `barrierValue` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/chokepointScore.ts`:

```ts
/** Fallback readiness 0..100 from maturityLabel when maturityScore is absent. */
function readinessFromLabel(label: Node["maturityLabel"]): number | null {
  switch (label) {
    case "mature": return 90;
    case "widely_adopted": return 85;
    case "commercially_available": return 75;
    case "early_deployment": return 60;
    case "prototype": return 45;
    case "lab_proven": return 35;
    case "hypothesis": return 20;
    case "blocked": return 10;
    default: return null; // "unknown" / undefined → no readiness signal
  }
}

const LEAD_TIME_SOFT_CAP_MONTHS = 36;

/** Barrier = mean of the available signals, each in [0,1]:
 *  must_build (1) / procurable (0); hard_to_develop tag (1);
 *  1 - readiness; min(1, leadTime/36). Substitute count is deferred
 *  (no `substitutes` data yet). Unknown when no signal is present. */
export function barrierValue(node: Node): AxisValue {
  const signals: number[] = [];
  if (node.transactability === "must_build") signals.push(1);
  else if (node.transactability === "procurable") signals.push(0);
  if (node.tags?.includes("hard_to_develop")) signals.push(1);
  const readiness =
    typeof node.maturityScore === "number" ? node.maturityScore : readinessFromLabel(node.maturityLabel);
  if (readiness !== null) signals.push(Math.max(0, Math.min(1, 1 - readiness / 100)));
  if (typeof node.capacityLeadTimeMonths === "number") {
    signals.push(Math.min(1, node.capacityLeadTimeMonths / LEAD_TIME_SOFT_CAP_MONTHS));
  }
  if (signals.length === 0) return { value: 0, known: false };
  return { value: signals.reduce((a, b) => a + b, 0) / signals.length, known: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chokepointScore.ts tests/chokepointScore.test.ts
git commit -m "feat(chokepoint): barrier sub-composite from data-backed signals"
```

---

### Task 8: Geometric-mean composite + incomplete flag

**Files:**
- Modify: `src/lib/chokepointScore.ts`
- Test: `tests/chokepointScore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/chokepointScore.test.ts`:

```ts
import { chokepointScores } from "../src/lib/chokepointScore";

test("a high-criticality, concentrated, high-barrier node outranks a false bottleneck", () => {
  // `real`: shared (2 parents), 0 holders (concentrated), must_build+hard (high barrier).
  // `fake`: shared (2 parents), 0 holders, but procurable+mature (low barrier) -> 伪瓶颈.
  const g = graph(
    [
      node("p1", { kind: "product" }),
      node("p2", { kind: "product" }),
      node("real", { kind: "engineering_method", transactability: "must_build", tags: ["hard_to_develop"], maturityScore: 20 }),
      node("fake", { kind: "engineering_method", transactability: "procurable", maturityScore: 95 }),
    ],
    [
      edge("p1", "real", "requires"), edge("p2", "real", "requires"),
      edge("p1", "fake", "requires"), edge("p2", "fake", "requires"),
    ],
  );
  const scores = chokepointScores(g);
  assert.ok(scores.get("real")!.score > scores.get("fake")!.score, "real chokepoint must outrank false one");
  assert.equal(scores.get("real")!.incomplete, false);
});

test("a node missing an axis is scored over known axes and flagged incomplete", () => {
  const g = graph(
    [node("p", { kind: "product" }), node("cap", { kind: "capability" })],
    [edge("p", "cap", "requires")],
  );
  // capability: criticality known (1 parent), concentration unknown (not supply kind),
  // barrier unknown (no signal) -> incomplete, but still scored, never zeroed silently.
  const r = chokepointScores(g).get("cap")!;
  assert.equal(r.incomplete, true);
  assert.ok(Number.isFinite(r.score));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — `chokepointScores` not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/chokepointScore.ts`:

```ts
export type ChokepointResult = {
  score: number; // [0,1] geometric mean of normalized known axes
  incomplete: boolean; // at least one axis was unknown
  axes: { criticality: number | null; concentration: number | null; barrier: number | null };
};

/** Compute the composite for every node: per-axis raw → quantile-normalize
 *  over the known values → geometric mean over the node's known axes. An
 *  unknown axis is omitted (never coerced to 0); a node with any unknown axis
 *  is flagged `incomplete`. */
export function chokepointScores(graph: GraphData): Map<string, ChokepointResult> {
  const crit = new Map<string, AxisValue>();
  const conc = new Map<string, AxisValue>();
  const barr = new Map<string, AxisValue>();
  for (const n of graph.nodes) {
    crit.set(n.id, criticalityValue(graph, n.id));
    conc.set(n.id, concentrationValue(graph, n.id));
    barr.set(n.id, barrierValue(n));
  }

  const knownValues = (m: Map<string, AxisValue>) =>
    [...m.values()].filter((a) => a.known).map((a) => a.value);
  const critNorm = quantileNormalizer(knownValues(crit));
  const concNorm = quantileNormalizer(knownValues(conc));
  const barrNorm = quantileNormalizer(knownValues(barr));

  const out = new Map<string, ChokepointResult>();
  for (const n of graph.nodes) {
    const c = crit.get(n.id)!;
    const k = conc.get(n.id)!;
    const b = barr.get(n.id)!;
    const axes = {
      criticality: c.known ? critNorm(c.value) : null,
      concentration: k.known ? concNorm(k.value) : null,
      barrier: b.known ? barrNorm(b.value) : null,
    };
    const present = [axes.criticality, axes.concentration, axes.barrier].filter(
      (v): v is number => v !== null,
    );
    const score =
      present.length === 0
        ? 0
        : Math.pow(
            present.reduce((acc, v) => acc * Math.max(v, 1e-6), 1),
            1 / present.length,
          );
    out.set(n.id, { score, incomplete: present.length < 3, axes });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chokepointScore.ts tests/chokepointScore.test.ts
git commit -m "feat(chokepoint): geometric-mean composite with incomplete flag"
```

---

### Task 9: Composite banding + wire the `bottleneck-risk` lens

**Files:**
- Modify: `src/lib/chokepointScore.ts` (add `chokepointBandFor`)
- Modify: `src/lib/edgeStyleFor.ts:267-275` (`bottleneck-risk` case)
- Test: `tests/chokepointScore.test.ts`, then update any failing `tests/*` that pin old `bottleneck-risk` banding.

- [ ] **Step 1: Write the failing test for composite banding**

Append to `tests/chokepointScore.test.ts`:

```ts
import { chokepointBandFor } from "../src/lib/chokepointScore";

test("chokepointBandFor bands the composite by its own quantiles (top score -> band 5)", () => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  // 6 products each sharing a distinct part with increasing fan-in to spread scores.
  for (let i = 0; i < 6; i++) {
    nodes.push(node(`prod${i}`, { kind: "product" }));
    nodes.push(node(`part${i}`, { kind: "material", maturityScore: 100 - i * 15 }));
    edges.push(edge(`prod${i}`, `part${i}`, "requires"));
  }
  const g = graph(nodes, edges);
  const band = chokepointBandFor(g);
  const bands = nodes.filter((n) => n.kind === "material").map((n) => band(n.id));
  assert.ok(Math.max(...bands) === 5 && Math.min(...bands) === 1, `expected full band spread, got ${bands}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: FAIL — `chokepointBandFor` not exported.

- [ ] **Step 3: Implement composite banding**

Append to `src/lib/chokepointScore.ts`:

```ts
const bandCache = new WeakMap<GraphData, (nodeId: string) => 1 | 2 | 3 | 4 | 5>();

/** Band the composite by its OWN empirical quantiles (Q20/Q40/Q60/Q80), so
 *  the warmest band always holds the top chokepoints regardless of the
 *  geometric mean's compression. Cached per graph identity. */
export function chokepointBandFor(graph: GraphData): (nodeId: string) => 1 | 2 | 3 | 4 | 5 {
  const cached = bandCache.get(graph);
  if (cached) return cached;
  const scores = chokepointScores(graph);
  const sorted = [...scores.values()].map((r) => r.score).sort((a, b) => a - b);
  const q = (p: number): number => {
    if (sorted.length === 0) return 0;
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  };
  const t = [q(0.2), q(0.4), q(0.6), q(0.8)];
  const fn = (nodeId: string): 1 | 2 | 3 | 4 | 5 => {
    const s = scores.get(nodeId)?.score ?? 0;
    if (s >= t[3]) return 5;
    if (s >= t[2]) return 4;
    if (s >= t[1]) return 3;
    if (s >= t[0]) return 2;
    return 1;
  };
  bandCache.set(graph, fn);
  return fn;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/chokepointScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the lens**

In `src/lib/edgeStyleFor.ts`, add the import near the top (after the `nodeRisk` import on line 3):

```ts
import { chokepointBandFor } from "./chokepointScore";
```

Replace the `bottleneck-risk` case in `bandForEdgeTarget` (lines ~267-275):

```ts
    case "bottleneck-risk": {
      // Authored bottleneck attribution still outranks the computed score.
      if (Array.isArray(target.bottleneckOf) && target.bottleneckOf.length > 0) {
        return 5;
      }
      // ADR-0010: rank by the four-axis chokepoint composite, banded by its
      // own quantiles, replacing the old (1 - maturity) × cost nodeRisk.
      return chokepointBandFor(graph)(target.id);
    }
```

- [ ] **Step 6: Run the focused + full lib tests**

Run: `npm test -- tests/chokepointScore.test.ts`
Then: `npm test`
Expected: chokepoint tests PASS. If a pre-existing test (e.g. `tests/topNGlyph.test.ts`, `tests/graphTopologyAudit.test.ts`) asserts the OLD `bottleneck-risk` band/order for a specific node, update that expectation to the new composite (the node's new band is whatever the composite yields) and note the ADR-0010 reason in the test. Do NOT weaken an assertion to make it pass — recompute the correct expected value.

- [ ] **Step 7: Commit**

```bash
git add src/lib/chokepointScore.ts src/lib/edgeStyleFor.ts tests/
git commit -m "feat(chokepoint): band bottleneck-risk lens by composite (ADR-0010)"
```

---

### Task 10: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the repo verification suite**

Run: `npm run verify`
Expected: `lint` + `check:graph-ux` (+ `check:graph-topology`) + `test` all PASS.

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: PASS (no type errors from the new module or the `edgeStyleFor` change).

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(chokepoint): verification fixups for scoring layer"
```

---

## Self-Review

- **Spec coverage:** Decision 1 axes → Tasks 3–7 (criticality, concentration, barrier) + Cost unchanged (no task, intentional). Decision 2 composite → Tasks 8–9 (geometric mean, quantile band, `nodeRisk` superseded in the lens). Normalization (quantile + missing-flag) → Tasks 5, 8. Capex weighting → Tasks 2, 4. ADR → Task 1. **Not in this plan (correct — later plans):** first-glance disclosure / headline (presentation), criticality badge + re-root view, lens-legend rename. Those are Plans 2 and 3.
- **Placeholder scan:** every code step contains full code; no TBD/TODO.
- **Type consistency:** `AxisValue` `{value, known}` used by concentration/barrier; `CriticalityValue` extends it with `demandKnown`; `ChokepointResult` `{score, incomplete, axes}`; `chokepointScores` / `chokepointBandFor` names are consistent across Tasks 8–9 and the `edgeStyleFor` wiring.
- **Known risk:** Task 9 Step 6 may surface pre-existing tests that pinned the old `nodeRisk` banding — they are updated (not weakened) to the composite. If many break, that is expected signal, not scope creep.
