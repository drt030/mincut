# Product / Know-how Layer Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the spec `docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md`: a default product layer (artifact kinds only) and a know-how layer (engineering_method / manufacturing_process colored by transactability) on the /graph radial canvas, plus schema fields (`transactability`, `listingStatus`, `ticker`, `capacityLeadTimeMonths`), a derived supply-concentration signal, the ADR-0005 stop-condition amendment, parcel-graph data backfill, and documentation updates.

**Architecture:** Layers are display-level lenses over one persistent radial map (ADR-0007 stable identity). `filterCanvasGraph` builds a union graph (artifact skeleton + know-how nodes attached via `requires` and `implemented_by`); positions are computed once over the union; a `GraphLayer` state in `GraphExplorer` filters node/edge visibility and swaps node styling. Supply concentration is derived from existing `manufactured_by` / `implemented_by` edges, never stored. Org listing info reads new schema fields first and falls back to the existing ai-chain convention (`public_company` tag + "Public listing" metric) so the hot `ai_compute_chain.json` file is not touched.

**Tech Stack:** Next.js 15 / React 19, @xyflow/react, zod, Node built-in test runner via `tsx --test`.

**Worktree:** Execute in a dedicated worktree (branch `product-knowhow-layers`) created via the superpowers:using-git-worktrees skill. **Do NOT merge** — the user reviews and merges. Base: current `master` HEAD.

**⚠️ Concurrent-work constraints (another active session is editing this repo):**
- Do NOT touch `data/nodes/ai_compute_chain.json`, `data/evidence/ai_compute_chain_evidence.json`, `src/components/AppHeader.tsx`, or the `V0_TARGET_NODE_ID` constant line in `src/lib/graphTraversal.ts` (its value is being changed in an uncommitted edit elsewhere; our edits to other lines of that file are fine).
- ai-chain know-how nodes (17 manufacturing_process) will trigger the new transactability warning — that is intended; their backfill is a recorded follow-up, not part of this plan.

**Verification commands:** `npm test` (full suite), `npx tsx --test tests/<file>.test.ts` (single file), `npm run lint`, `npm run validate:data`, `npm run verify` (final).

---

### Task 1: Schema fields + kind-guard refinements

**Files:**
- Modify: `src/lib/schema.ts` (nodeBaseSchema at lines 105–197, refinements at ~line 199)
- Test: `tests/schemaKnowHow.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/schemaKnowHow.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { nodeSchema } from "../src/lib/schema";

const base = {
  id: "n1",
  name: "Node",
  domain: ["test"],
  maturityLabel: "mature",
};

test("transactability accepted on engineering_method nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "engineering_method",
    transactability: "must_build",
  });
  assert.equal(parsed.success, true);
});

test("transactability accepted on manufacturing_process nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "manufacturing_process",
    transactability: "procurable",
  });
  assert.equal(parsed.success, true);
});

test("transactability rejected on module nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    transactability: "procurable",
  });
  assert.equal(parsed.success, false);
});

test("transactability rejects unknown values", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "engineering_method",
    transactability: "buyable",
  });
  assert.equal(parsed.success, false);
});

test("listingStatus + ticker accepted on organization nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "organization",
    listingStatus: "public",
    ticker: "6954.T",
  });
  assert.equal(parsed.success, true);
});

test("listingStatus rejected on non-organization nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    listingStatus: "public",
  });
  assert.equal(parsed.success, false);
});

test("ticker rejected on non-organization nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    ticker: "NVDA",
  });
  assert.equal(parsed.success, false);
});

test("capacityLeadTimeMonths accepted on any structural node", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    capacityLeadTimeMonths: 18,
  });
  assert.equal(parsed.success, true);
});

test("capacityLeadTimeMonths rejects non-positive values", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    capacityLeadTimeMonths: 0,
  });
  assert.equal(parsed.success, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/schemaKnowHow.test.ts`
Expected: FAIL — transactability/listingStatus/ticker keys are stripped by zod (unknown keys), so the "rejected on module" assertions fail (`parsed.success` is `true`).

- [ ] **Step 3: Add fields and refinements to schema.ts**

In `src/lib/schema.ts`, inside `nodeBaseSchema` after the `frontierFor` field (line 196, before the closing `});`):

```ts
  /**
   * Per ADR-0008 (product/know-how layer split): the transactional form
   * of a know-how node. `procurable` = a real market sells this as a
   * service / dataset / license (conceptually a service product);
   * `must_build` = no one sells it separately — it exists embodied in
   * firms' products or vertical integration (moat / bottleneck
   * candidate). Only meaningful on `engineering_method` /
   * `manufacturing_process` nodes (enforced by refinement below).
   */
  transactability: z.enum(["procurable", "must_build"]).optional(),
  /**
   * Per ADR-0008 + investor-operator scenario Q3: public-market
   * visibility of an organization. `subsidiary` = belongs to a listed
   * parent (the parent's ticker goes in `ticker`). Only meaningful on
   * `organization` nodes (enforced by refinement below).
   */
  listingStatus: z.enum(["public", "private", "subsidiary", "unknown"]).optional(),
  /** Exchange ticker (e.g. "6954.T", "NVDA"). Organization nodes only. */
  ticker: z.string().min(1).optional(),
  /**
   * Reserved per ADR-0008 (maturityHistory pattern: field first,
   * population deferred): months of lead time to expand supply
   * capacity for this node — the shiso-leaf criterion with no other
   * graph counterpart. Not populated in v0.
   */
  capacityLeadTimeMonths: z.number().positive().optional(),
```

Then extend the existing `nodeSchema` export at line ~199. It currently ends with one `.refine(maturityAsOfRequiredWhenSet, {...})` call — leave that call exactly as it is and chain two more `.refine` calls onto it:

```ts
const NODE_KNOW_HOW_KINDS = new Set(["engineering_method", "manufacturing_process"]);

// appended to the existing chain, after the maturityAsOfRequiredWhenSet refine:
  .refine(
    (node) => node.transactability === undefined || NODE_KNOW_HOW_KINDS.has(node.kind),
    { message: "transactability is only valid on engineering_method / manufacturing_process nodes" },
  )
  .refine(
    (node) =>
      (node.listingStatus === undefined && node.ticker === undefined) ||
      node.kind === "organization",
    { message: "listingStatus / ticker are only valid on organization nodes" },
  );
```

Also export the helper type near the other exported types:

```ts
export type Transactability = "procurable" | "must_build";
export type ListingStatus = "public" | "private" | "subsidiary" | "unknown";
```

- [ ] **Step 4: Run tests**

Run: `npx tsx --test tests/schemaKnowHow.test.ts` — Expected: PASS.
Run: `npx tsx --test tests/schemaBottleneckAttr.test.ts && npm run validate:data` — Expected: PASS (fields are optional; no data carries them yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts tests/schemaKnowHow.test.ts
git commit -m "feat: schema fields for transactability, org listing, capacity lead time (ADR-0008)"
```

---

### Task 2: Supply-concentration lib (derived holder count)

**Files:**
- Create: `src/lib/supplyConcentration.ts`
- Test: `tests/supplyConcentration.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/supplyConcentration.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import type { GraphData } from "../src/lib/schema";
import {
  holdersForNode,
  isSupplyConcentrated,
  CONCENTRATION_THRESHOLD,
} from "../src/lib/supplyConcentration";

function graphWith(extra: Partial<GraphData>): GraphData {
  return {
    nodes: [],
    edges: [],
    evidence: [],
    ...extra,
  } as GraphData;
}

const node = (id: string, kind: string, overrides: object = {}) =>
  ({ id, name: id, kind, domain: ["t"], maturityLabel: "mature", ...overrides }) as never;

const edge = (id: string, source: string, target: string, relation: string, overrides: object = {}) =>
  ({ id, source, target, relation, ...overrides }) as never;

test("holdersForNode counts distinct orgs across manufactured_by and implemented_by", () => {
  const graph = graphWith({
    nodes: [
      node("kh", "engineering_method"),
      node("org_a", "organization", { listingStatus: "public", ticker: "AAA" }),
      node("org_b", "organization"),
    ],
    edges: [
      edge("e1", "kh", "org_a", "implemented_by"),
      edge("e2", "kh", "org_b", "manufactured_by"),
      edge("e3", "kh", "org_a", "manufactured_by"), // duplicate org via second relation
    ],
  });
  const holders = holdersForNode(graph, "kh");
  assert.equal(holders.total, 2);
  assert.equal(holders.listed, 1);
  assert.deepEqual(holders.organizationIds.sort(), ["org_a", "org_b"]);
});

test("holdersForNode excludes deprecated orgs and deprecated edges", () => {
  const graph = graphWith({
    nodes: [
      node("kh", "engineering_method"),
      node("org_dead", "organization", { reviewStatus: "deprecated" }),
      node("org_live", "organization"),
    ],
    edges: [
      edge("e1", "kh", "org_dead", "implemented_by"),
      edge("e2", "kh", "org_live", "implemented_by", { reviewStatus: "deprecated" }),
    ],
  });
  assert.equal(holdersForNode(graph, "kh").total, 0);
});

test("holders count `listed` via public_company tag fallback when listingStatus absent", () => {
  const graph = graphWith({
    nodes: [
      node("kh", "manufacturing_process"),
      node("org_tagged", "organization", { tags: ["public_company"] }),
    ],
    edges: [edge("e1", "kh", "org_tagged", "implemented_by")],
  });
  assert.equal(holdersForNode(graph, "kh").listed, 1);
});

test("isSupplyConcentrated true at or below threshold, false above", () => {
  const orgs = Array.from({ length: CONCENTRATION_THRESHOLD + 1 }, (_, i) =>
    node(`org_${i}`, "organization"),
  );
  const edgesAt = (n: number) =>
    Array.from({ length: n }, (_, i) => edge(`e${i}`, "kh", `org_${i}`, "manufactured_by"));
  const khNode = node("kh", "manufacturing_process");

  const atThreshold = graphWith({ nodes: [khNode, ...orgs], edges: edgesAt(CONCENTRATION_THRESHOLD) });
  assert.equal(isSupplyConcentrated(atThreshold, "kh"), true);

  const aboveThreshold = graphWith({ nodes: [khNode, ...orgs], edges: edgesAt(CONCENTRATION_THRESHOLD + 1) });
  assert.equal(isSupplyConcentrated(aboveThreshold, "kh"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/supplyConcentration.test.ts`
Expected: FAIL — module `../src/lib/supplyConcentration` not found.

- [ ] **Step 3: Implement `src/lib/supplyConcentration.ts`**

```ts
import type { GraphData, Node } from "./schema";

/**
 * Per ADR-0008 and the ADR-0005 amendment: supply concentration is a
 * DERIVED signal — holder count is computed from `manufactured_by` /
 * `implemented_by` edges at read time and never stored on nodes.
 *
 * "Holder" = a non-deprecated organization the node points to via a
 * non-deprecated `manufactured_by` or `implemented_by` edge. `listed`
 * counts holders that are publicly visible: `listingStatus` of
 * `public` / `subsidiary` when the field is set, falling back to the
 * ai-chain data convention of a `public_company` tag.
 */

const HOLDER_RELATIONS = new Set(["manufactured_by", "implemented_by"]);

/**
 * Initial threshold per the ADR-0005 amendment: a mature node with
 * `total` holders ≤ this value stays decomposition-eligible (the
 * "mature but concentrated" shiso-leaf habitat). Tunable; revisit when
 * real screening data shows it's too tight or too loose.
 */
export const CONCENTRATION_THRESHOLD = 3;

export type HolderSummary = {
  total: number;
  listed: number;
  organizationIds: string[];
};

export function isOrgListed(org: Node): boolean {
  if (org.listingStatus === "public" || org.listingStatus === "subsidiary") return true;
  if (org.listingStatus === "private" || org.listingStatus === "unknown") return false;
  return org.tags?.includes("public_company") ?? false;
}

export function holdersForNode(graph: GraphData, nodeId: string): HolderSummary {
  const orgs = new Map<string, Node>();
  for (const edge of graph.edges) {
    if (!HOLDER_RELATIONS.has(edge.relation)) continue;
    if (edge.source !== nodeId) continue;
    if (edge.reviewStatus === "deprecated") continue;
    const target = graph.nodes.find((node) => node.id === edge.target);
    if (!target || target.kind !== "organization") continue;
    if (target.reviewStatus === "deprecated") continue;
    orgs.set(target.id, target);
  }
  const organizationIds = [...orgs.keys()].sort((a, b) => a.localeCompare(b));
  const listed = [...orgs.values()].filter(isOrgListed).length;
  return { total: orgs.size, listed, organizationIds };
}

/**
 * True when the node's holder count is at or below
 * `CONCENTRATION_THRESHOLD` — including zero holders, which is either
 * a data gap or true scarcity and is surfaced as the strongest flag.
 */
export function isSupplyConcentrated(graph: GraphData, nodeId: string): boolean {
  return holdersForNode(graph, nodeId).total <= CONCENTRATION_THRESHOLD;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/supplyConcentration.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supplyConcentration.ts tests/supplyConcentration.test.ts
git commit -m "feat: derived supply-concentration signal (holder count from org edges)"
```

---

### Task 3: ADR-0005 amendment — mature-but-concentrated stays a frontier

**Files:**
- Modify: `src/lib/graphTraversal.ts:99-114` (`isDecompositionFrontier`) — do NOT touch line 4 (`V0_TARGET_NODE_ID`)
- Modify: `docs/adr/0005-decomposition-stop-and-key-technology.md` (append amendment section)
- Test: `tests/graphTraversal.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/graphTraversal.test.ts` (match the file's existing fixture-building style; if it builds GraphData inline, reuse that helper):

```ts
test("isDecompositionFrontier: mature node with concentrated supply stays a frontier (ADR-0005 amendment)", () => {
  const graph = {
    nodes: [
      { id: "kh", name: "kh", kind: "manufacturing_process", domain: ["t"], maturityLabel: "mature" },
      { id: "org_a", name: "org_a", kind: "organization", domain: ["t"], maturityLabel: "mature" },
    ],
    edges: [
      { id: "e1", source: "kh", target: "org_a", relation: "implemented_by" },
    ],
    evidence: [],
  } as never;
  const node = (graph as { nodes: { id: string }[] }).nodes[0] as never;
  assert.equal(isDecompositionFrontier(graph, node), true);
});

test("isDecompositionFrontier: mature node with broad supply (> threshold holders) still stops", () => {
  const orgs = ["a", "b", "c", "d"].map((s) => ({
    id: `org_${s}`, name: s, kind: "organization", domain: ["t"], maturityLabel: "mature",
  }));
  const graph = {
    nodes: [
      { id: "kh", name: "kh", kind: "manufacturing_process", domain: ["t"], maturityLabel: "mature" },
      ...orgs,
    ],
    edges: orgs.map((o, i) => ({ id: `e${i}`, source: "kh", target: o.id, relation: "manufactured_by" })),
    evidence: [],
  } as never;
  const node = (graph as { nodes: { id: string }[] }).nodes[0] as never;
  assert.equal(isDecompositionFrontier(graph, node), false);
});
```

(Import `isDecompositionFrontier` if the test file doesn't already.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/graphTraversal.test.ts`
Expected: the first new test FAILS (`false` — mature short-circuits to "not frontier"); the second passes.

- [ ] **Step 3: Amend `isDecompositionFrontier`**

In `src/lib/graphTraversal.ts`, add the import at the top (below the existing schema import):

```ts
import { isSupplyConcentrated } from "./supplyConcentration";
```

Replace the body of `isDecompositionFrontier` (lines 108–114) and extend the doc comment:

```ts
/**
 * Per ADR-0005, a node is a decomposition frontier if EITHER it carries an
 * authored frontier marker (`decomposition_frontier` tag or `frontierFor`
 * ownership), OR its `maturityLabel` is not in {mature, widely_adopted} AND
 * it has no expanded children. The authored arms preserve explicit product
 * frontier intent even when a node already has some children; the structural
 * arm catches incomplete decomposition where the stop condition has not been
 * met.
 *
 * ADR-0005 amendment (2026-06-10, per ADR-0008): commodified maturity no
 * longer stops decomposition by itself. A `mature` / `widely_adopted` node
 * whose supply is concentrated (holder count ≤ CONCENTRATION_THRESHOLD via
 * `manufactured_by` / `implemented_by` edges) is exactly the
 * "mature but concentrated" habitat the investor learning-focus cares
 * about, so it remains a frontier when it has no expanded children.
 */
export function isDecompositionFrontier(graph: GraphData, node: Node): boolean {
  if (node.tags?.includes("decomposition_frontier")) return true;
  if ((node.frontierFor?.length ?? 0) > 0) return true;
  const stopLabels = new Set(["mature", "widely_adopted"]);
  const commodified = node.maturityLabel ? stopLabels.has(node.maturityLabel) : false;
  if (commodified && !isSupplyConcentrated(graph, node.id)) return false;
  return !hasExpandedChildren(graph, node.id);
}
```

- [ ] **Step 4: Run tests — expect collateral churn, inspect it**

Run: `npx tsx --test tests/graphTraversal.test.ts` — Expected: PASS.
Run: `npm test` — Expected: mostly PASS. **Inspect any failures in `realGraph.test.ts`, `gateRunner.test.ts`, `gatePage.test.ts`, `agentExpansionTask.test.ts`:** the amendment makes mature-but-concentrated real nodes frontiers, which can change pinned frontier counts / generated-task counts. For each failing pin, verify the new value is explained by the amendment (the node is mature with ≤3 holders), then update the pinned number and say so in the commit message. If a failure is NOT explained by that, stop and debug — do not blanket-update.

- [ ] **Step 5: Append the amendment to ADR-0005**

Append to `docs/adr/0005-decomposition-stop-and-key-technology.md` (end of file):

```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/graphTraversal.ts tests/graphTraversal.test.ts docs/adr/0005-decomposition-stop-and-key-technology.md
# plus any test files whose pins you updated in step 4, each justified in the message body
git commit -m "feat: ADR-0005 amendment — mature-but-concentrated nodes stay decomposition frontiers"
```

---

### Task 4: Canvas tree-edge predicate + know-how kind helpers + union attachment

**Files:**
- Modify: `src/lib/canvasGraph.ts` (CANVAS_KINDS block lines 5–12, `filterCanvasGraph` lines 77–136)
- Test: `tests/canvasGraph.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/canvasGraph.test.ts` (reuse its existing node/edge fixture helpers; the shapes below show required fields):

```ts
test("isKnowHowNode / isArtifactCanvasNode partition the canvas kinds", () => {
  const kh = { id: "k", name: "k", kind: "engineering_method", domain: ["t"], maturityLabel: "mature" } as never;
  const mod = { id: "m", name: "m", kind: "module", domain: ["t"], maturityLabel: "mature" } as never;
  assert.equal(isKnowHowNode(kh), true);
  assert.equal(isKnowHowNode(mod), false);
  assert.equal(isArtifactCanvasNode(mod), true);
  assert.equal(isArtifactCanvasNode(kh), false);
});

test("filterCanvasGraph attaches implemented_by-only know-how nodes to the union graph", () => {
  const graph = {
    nodes: [
      { id: "root", name: "root", kind: "product", domain: ["t"], maturityLabel: "lab_prototype" },
      { id: "mod", name: "mod", kind: "module", domain: ["t"], maturityLabel: "mature" },
      { id: "kh_impl", name: "kh", kind: "engineering_method", domain: ["t"], maturityLabel: "lab_prototype" },
    ],
    edges: [
      { id: "e1", source: "root", target: "mod", relation: "requires" },
      { id: "e2", source: "mod", target: "kh_impl", relation: "implemented_by" },
    ],
    evidence: [],
  } as never;
  const filtered = filterCanvasGraph(graph, "root");
  assert.ok(filtered.nodes.some((n) => n.id === "kh_impl"), "implemented_by know-how node attached");
  assert.ok(filtered.edges.some((e) => e.id === "e2"), "attachment edge included");
});

test("filterCanvasGraph does NOT attach implemented_by organizations", () => {
  const graph = {
    nodes: [
      { id: "root", name: "root", kind: "product", domain: ["t"], maturityLabel: "lab_prototype" },
      { id: "mod", name: "mod", kind: "module", domain: ["t"], maturityLabel: "mature" },
      { id: "org", name: "org", kind: "organization", domain: ["t"], maturityLabel: "mature" },
    ],
    edges: [
      { id: "e1", source: "root", target: "mod", relation: "requires" },
      { id: "e2", source: "mod", target: "org", relation: "implemented_by" },
    ],
    evidence: [],
  } as never;
  const filtered = filterCanvasGraph(graph, "root");
  assert.equal(filtered.nodes.some((n) => n.id === "org"), false);
});
```

(Add `isKnowHowNode, isArtifactCanvasNode` to the test file's import from `../src/lib/canvasGraph`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/canvasGraph.test.ts`
Expected: FAIL — `isKnowHowNode` not exported; implemented_by node not attached.

- [ ] **Step 3: Implement in `src/lib/canvasGraph.ts`**

Below the `CANVAS_KINDS` definition (after line 12), add:

```ts
/** Per ADR-0008: display-layer umbrella "Know-how" = these two kinds. */
export const KNOW_HOW_KINDS: ReadonlySet<NodeKind> = new Set([
  "engineering_method",
  "manufacturing_process",
]);

export function isKnowHowNode(node: Node): boolean {
  return KNOW_HOW_KINDS.has(node.kind);
}

/** Canvas node that is a purchasable/buildable artifact (product layer content). */
export function isArtifactCanvasNode(node: Node): boolean {
  return isCanvasNode(node) && !isKnowHowNode(node);
}

/**
 * Per ADR-0008: the canvas tree is built from `requires` edges PLUS
 * `implemented_by` edges whose target is a know-how node (5 know-how
 * nodes in the parcel graph attach only that way). `implemented_by`
 * edges to organizations stay panel-only.
 */
export function isCanvasTreeEdge(edge: Edge, nodeById: Map<string, Node>): boolean {
  if (edge.relation === "requires") return true;
  if (edge.relation !== "implemented_by") return false;
  const target = nodeById.get(edge.target);
  return target !== undefined && isKnowHowNode(target);
}
```

In `filterCanvasGraph` (lines 77–136), replace the `requiresEdges` computation (lines 92–96) with:

```ts
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const treeEdges = graph.edges.filter((edge) =>
    isCanvasTreeEdge(edge, nodeById) &&
    baseEligibleIds.has(edge.source) &&
    baseEligibleIds.has(edge.target),
  );
```

and rename every later use of `requiresEdges` in this function to `treeEdges` (the `childrenByParent` build and the final edge-dedup loop).

- [ ] **Step 4: Run tests**

Run: `npx tsx --test tests/canvasGraph.test.ts` — Expected: PASS.
Run: `npm test` — Expected: failures are possible in `realGraph.test.ts` / `languageCoverage.test.ts` / layout tests because 5 know-how nodes (`gripper_tcp_pattern_calibration`, `servo_drive_motion_control_loop`, `servo_drive_thermal_emc_design`, `servo_motor_feedback_alignment`, `jam_detection_and_recovery`) join the canvas. **Do not fix those here** — Task 5 adopts the predicate everywhere and settles counts/zh names. If unrelated tests fail, debug before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/canvasGraph.ts tests/canvasGraph.test.ts
git commit -m "feat: canvas tree-edge predicate attaches implemented_by know-how to union graph"
```

---

### Task 5: Adopt the tree-edge predicate in layout/traversal + zh names + settle pinned counts

**Files:**
- Modify: `src/lib/radialLayout.ts:135,389` (both `relation !== "requires"` guards)
- Modify: `src/lib/focusedSubset.ts:63`
- Modify: `src/components/GraphExplorer.tsx:600-618` (`buildFocalSubtree`), `:959-967` (`childrenByParent`), `:~1104` (flowEdges relation guard)
- Modify: `src/components/LanguageProvider.tsx` (nodeTextZh additions)
- Test: existing suites (`radialLayout`, `focusedSubset`, `realGraph`, `languageCoverage`)

- [ ] **Step 1: Swap the guards**

All five sites currently read `if (edge.relation !== "requires") continue;`. Each gets:

```ts
if (!isCanvasTreeEdge(edge, nodeById)) continue;
```

with `import { isCanvasTreeEdge } from "./canvasGraph";` (lib files) or `from "@/lib/canvasGraph"` (GraphExplorer). Per site, the `nodeById` map:

- `radialLayout.ts` — both functions already iterate `graph.nodes`/`graph.edges`; build `const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));` once at the top of each enclosing function (lines ~130 and ~385) if no equivalent map is in scope (reuse one if present).
- `focusedSubset.ts:63` — same pattern inside the BFS function.
- `GraphExplorer.tsx` `buildFocalSubtree` (line 600) — build the map from `graph.nodes` at function top.
- `GraphExplorer.tsx` `childrenByParent` memo (line 959) — build from `canvasGraph.nodes` inside the memo.
- `GraphExplorer.tsx` flowEdges loop (~line 1104) — a `nodeById` map already exists in that memo (line ~1082); reuse it.

**Leave `firstLayerSubsystems` (lines 943–953) requires-only**, and additionally skip know-how targets so a know-how node can never become a sector anchor. Change line 949 from:

```ts
      if (!target || target.kind === "material") continue;
```

to:

```ts
      if (!target || target.kind === "material" || isKnowHowNode(target)) continue;
```

(import `isKnowHowNode` alongside `isCanvasTreeEdge`).

- [ ] **Step 2: Add zh names for the 5 newly-visible nodes**

In `src/components/LanguageProvider.tsx`, in the `nodeTextZh` dictionary (keys sorted/grouped like neighbors), add:

```ts
  gripper_tcp_pattern_calibration: "夹爪TCP阵列标定",
  servo_drive_motion_control_loop: "伺服驱动运动控制环",
  servo_drive_thermal_emc_design: "伺服驱动热设计与EMC",
  servo_motor_feedback_alignment: "伺服电机反馈对准",
  jam_detection_and_recovery: "卡件检测与恢复",
```

(If any key already exists, keep the existing translation and skip the duplicate.)

- [ ] **Step 3: Run the full suite and settle pins**

Run: `npm test`
Expected: `languageCoverage.test.ts` now passes with the zh entries. For count pins (`realGraph.test.ts`, possibly `radialLayout.test.ts` totals): the canvas gains exactly the 5 implemented_by-only know-how nodes — update pinned totals by +5 (or the observed delta) ONLY where the test's intent is "count all canvas nodes". Any failure not explained by the 5-node attachment must be debugged, not pinned over.

- [ ] **Step 4: Visual smoke check**

Run: `npm run dev`, open `http://localhost:3000/graph`.
Expected: radial map renders; the 5 new know-how nodes appear inside their host sectors; no console errors. (Layers don't exist yet — the canvas shows the union, same as before plus 5 nodes.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/radialLayout.ts src/lib/focusedSubset.ts src/components/GraphExplorer.tsx src/components/LanguageProvider.tsx tests/
git commit -m "feat: canvas traversals use tree-edge predicate; zh names for newly attached know-how"
```

---

### Task 6: Know-how layer lib (visibility, fill, badges, listing info)

**Files:**
- Create: `src/lib/knowHowLayer.ts`
- Test: `tests/knowHowLayer.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/knowHowLayer.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  KNOW_HOW_FILLS,
  ARTIFACT_DIM_FILL,
  knowHowFill,
  layerHidesNode,
  layerHidesEdge,
  knowHowBottleneckCounts,
  listingInfoForOrg,
} from "../src/lib/knowHowLayer";

const node = (id: string, kind: string, overrides: object = {}) =>
  ({ id, name: id, kind, domain: ["t"], maturityLabel: "mature", ...overrides }) as never;

const edge = (id: string, source: string, target: string, relation: string) =>
  ({ id, source, target, relation }) as never;

const graph = {
  nodes: [
    node("root", "product"),
    node("mod", "module"),
    node("kh_b", "engineering_method", { transactability: "must_build", bottleneckOf: ["root"] }),
    node("kh_p", "manufacturing_process", { transactability: "procurable" }),
    node("kh_u", "engineering_method"),
  ],
  edges: [
    edge("e1", "root", "mod", "requires"),
    edge("e2", "mod", "kh_b", "requires"),
    edge("e3", "mod", "kh_p", "implemented_by"),
    edge("e4", "mod", "kh_u", "requires"),
  ],
  evidence: [],
} as never;

test("product layer hides know-how nodes and their edges; know-how layer hides nothing", () => {
  const kh = (graph as { nodes: never[] }).nodes[2];
  const mod = (graph as { nodes: never[] }).nodes[1];
  assert.equal(layerHidesNode(kh, "product"), true);
  assert.equal(layerHidesNode(mod, "product"), false);
  assert.equal(layerHidesNode(kh, "knowhow"), false);

  const nodeById = new Map((graph as { nodes: { id: string }[] }).nodes.map((n) => [n.id, n]));
  const khEdge = (graph as { edges: never[] }).edges[1];
  const artifactEdge = (graph as { edges: never[] }).edges[0];
  assert.equal(layerHidesEdge(khEdge, "product", nodeById as never), true);
  assert.equal(layerHidesEdge(artifactEdge, "product", nodeById as never), false);
  assert.equal(layerHidesEdge(khEdge, "knowhow", nodeById as never), false);
});

test("knowHowFill maps transactability to the three fills", () => {
  const [, , khB, khP, khU] = (graph as { nodes: never[] }).nodes;
  assert.equal(knowHowFill(khB), KNOW_HOW_FILLS.must_build);
  assert.equal(knowHowFill(khP), KNOW_HOW_FILLS.procurable);
  assert.equal(knowHowFill(khU), KNOW_HOW_FILLS.unset);
  assert.notEqual(KNOW_HOW_FILLS.must_build, KNOW_HOW_FILLS.procurable);
  assert.equal(typeof ARTIFACT_DIM_FILL, "string");
});

test("knowHowBottleneckCounts counts hidden bottleneck know-how per host", () => {
  const counts = knowHowBottleneckCounts(graph);
  assert.equal(counts.get("mod"), 1); // kh_b carries bottleneckOf, kh_p / kh_u do not
  assert.equal(counts.has("root"), false);
});

test("listingInfoForOrg prefers schema fields, falls back to Public listing metric + tag", () => {
  const fieldOrg = node("o1", "organization", { listingStatus: "public", ticker: "NVDA" });
  assert.deepEqual(listingInfoForOrg(fieldOrg), { status: "public", ticker: "NVDA" });

  const metricOrg = node("o2", "organization", {
    tags: ["public_company"],
    metrics: [{ name: "Public listing", currentValue: "6361.T" }],
  });
  assert.deepEqual(listingInfoForOrg(metricOrg), { status: "public", ticker: "6361.T" });

  const bareOrg = node("o3", "organization");
  assert.deepEqual(listingInfoForOrg(bareOrg), { status: "unknown", ticker: undefined });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/knowHowLayer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/knowHowLayer.ts`**

```ts
import type { Edge, GraphData, Node } from "./schema";
import { isCanvasTreeEdge, isKnowHowNode } from "./canvasGraph";

/**
 * Per ADR-0008: the /graph canvas is one persistent radial map viewed
 * through two layers. Layout runs once over the union graph; layers
 * only flip visibility and styling, never positions (ADR-0007 stable
 * identity).
 *
 *  - "product": artifact kinds only — answers "what do you buy/build".
 *  - "knowhow": know-how nodes light up colored by transactability;
 *    artifact nodes stay as dimmed grey context.
 */
export type GraphLayer = "product" | "knowhow";

export const DEFAULT_GRAPH_LAYER: GraphLayer = "product";

/** Transactability fill ramp: green = procurable, amber = must_build. */
export const KNOW_HOW_FILLS = Object.freeze({
  procurable: "hsl(145, 55%, 42%)",
  must_build: "hsl(32, 85%, 48%)",
  unset: "hsl(215, 12%, 64%)",
});

/** Grey context fill for artifact nodes inside the know-how layer. */
export const ARTIFACT_DIM_FILL = "hsl(215, 14%, 84%)";

export function knowHowFill(node: Node): string {
  if (node.transactability === "procurable") return KNOW_HOW_FILLS.procurable;
  if (node.transactability === "must_build") return KNOW_HOW_FILLS.must_build;
  return KNOW_HOW_FILLS.unset;
}

export function layerHidesNode(node: Node, layer: GraphLayer): boolean {
  return layer === "product" && isKnowHowNode(node);
}

export function layerHidesEdge(
  edge: Edge,
  layer: GraphLayer,
  nodeById: Map<string, Node>,
): boolean {
  if (layer !== "product") return false;
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  return (source !== undefined && isKnowHowNode(source)) ||
    (target !== undefined && isKnowHowNode(target));
}

/**
 * Per the spec's bottleneck-surfacing rule: a product-layer host shows
 * a red-ring badge counting its know-how tree children (via `requires`
 * / `implemented_by` attachment edges) that carry non-empty
 * `bottleneckOf`. Returns hosts with count ≥ 1 only.
 */
export function knowHowBottleneckCounts(graph: GraphData): Map<string, number> {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const counts = new Map<string, number>();
  for (const edge of graph.edges) {
    if (!isCanvasTreeEdge(edge, nodeById)) continue;
    if (edge.reviewStatus === "deprecated") continue;
    const target = nodeById.get(edge.target);
    if (!target || !isKnowHowNode(target)) continue;
    if (target.reviewStatus === "deprecated") continue;
    if ((target.bottleneckOf?.length ?? 0) === 0) continue;
    counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
  }
  return counts;
}

export type ListingInfo = {
  status: "public" | "private" | "subsidiary" | "unknown";
  ticker: string | undefined;
};

/**
 * Listing info for an organization node. Schema fields are canonical;
 * the fallback reads the ai-chain data convention (`public_company`
 * tag + a "Public listing" metric whose currentValue is the ticker)
 * so that graph gets chips without editing its hot data file.
 */
export function listingInfoForOrg(org: Node): ListingInfo {
  if (org.listingStatus) {
    return { status: org.listingStatus, ticker: org.ticker };
  }
  const listingMetric = (org.metrics ?? []).find((m) => m.name === "Public listing");
  const metricTicker = typeof listingMetric?.currentValue === "string"
    ? listingMetric.currentValue
    : undefined;
  if (org.tags?.includes("public_company") || metricTicker) {
    return { status: "public", ticker: org.ticker ?? metricTicker };
  }
  return { status: "unknown", ticker: org.ticker };
}
```

(If `metrics[].currentValue` is typed as a structured value rather than `string | number`, adapt the `metricTicker` extraction to the actual `metricValueSchema` shape — check `src/lib/schema.ts` lines 60–100 — while keeping the test's contract.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/knowHowLayer.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/knowHowLayer.ts tests/knowHowLayer.test.ts
git commit -m "feat: know-how layer lib — visibility, transactability fills, bottleneck counts, listing info"
```

---

### Task 7: Layer state, floating toggle, canvas wiring, diamond markers, badges

**Files:**
- Create: `src/components/LayerToggleFloatingButton.tsx`
- Modify: `src/components/GraphExplorer.tsx` (state near line 799; flowNodes memo lines 1014–1063; flowEdges memo lines 1066–1221; JSX mount)
- Modify: `src/components/RadialNode.tsx` (props + band 1/2 shape + badge)
- Modify: `src/components/LanguageProvider.tsx` (uiText en+zh)
- Test: `tests/layerToggle.test.ts` (create), `tests/lod.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Create `tests/layerToggle.test.ts` (mirror the renderToStaticMarkup style of `tests/colorModeFloatingButton.test.ts`):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LayerToggleFloatingButton } from "../src/components/LayerToggleFloatingButton";

const LABELS = { toggle: "Layer", product: "Products", knowHow: "Know-how" };

test("renders both layer options with the active one marked", () => {
  const html = renderToStaticMarkup(
    React.createElement(LayerToggleFloatingButton, {
      layer: "product",
      onSelect: () => {},
      labels: LABELS,
    }),
  );
  assert.match(html, /data-testid="layer-toggle"/);
  assert.match(html, /data-layer-option="product"[^>]*aria-pressed="true"/);
  assert.match(html, /data-layer-option="knowhow"[^>]*aria-pressed="false"/);
  assert.match(html, /Know-how/);
});

test("know-how active state flips aria-pressed", () => {
  const html = renderToStaticMarkup(
    React.createElement(LayerToggleFloatingButton, {
      layer: "knowhow",
      onSelect: () => {},
      labels: LABELS,
    }),
  );
  assert.match(html, /data-layer-option="knowhow"[^>]*aria-pressed="true"/);
});
```

Append to `tests/lod.test.ts`:

```ts
test("RadialNode renders diamond marker and know-how badge when requested", () => {
  const html = renderToStaticMarkup(
    React.createElement(RadialNode, {
      id: "kh",
      name: "Know-how node",
      fill: "hsl(32, 85%, 48%)",
      maturityLabel: "lab_prototype",
      zoom: 1.0, // band 2
      shape: "diamond",
      knowHowBottleneckCount: 0,
    }),
  );
  assert.match(html, /data-node-shape="diamond"/);
});

test("RadialNode renders red-ring bottleneck badge with count at band 2", () => {
  const html = renderToStaticMarkup(
    React.createElement(RadialNode, {
      id: "host",
      name: "Host module",
      fill: "hsl(200, 60%, 50%)",
      maturityLabel: "mature",
      zoom: 1.0,
      knowHowBottleneckCount: 2,
    }),
  );
  assert.match(html, /data-knowhow-bottlenecks="2"/);
});
```

(Match the existing import style at the top of `tests/lod.test.ts` — it already imports `RadialNode`, `React`, and `renderToStaticMarkup`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test tests/layerToggle.test.ts tests/lod.test.ts`
Expected: FAIL — component module missing; unknown props ignored, `data-node-shape` / `data-knowhow-bottlenecks` absent.

- [ ] **Step 3: Implement `LayerToggleFloatingButton`**

Create `src/components/LayerToggleFloatingButton.tsx` (style constants copied from `ColorModeFloatingButton.tsx` lines 62–113 so the two florets match):

```tsx
"use client";

import React from "react";
import type { GraphLayer } from "@/lib/knowHowLayer";

/**
 * Per ADR-0008: floating layer switch for the /graph canvas. Sits in
 * the bottom-left control column above the color-mode floret. The
 * toggle is a lens, not a navigation: positions stay fixed, only node
 * visibility/styling changes (ADR-0007 stable identity).
 *
 * Labels arrive via props (caller translates with `t()`), so the
 * component renders standalone in unit tests without a
 * LanguageProvider in scope — same reason RadialNode takes `zoom` as
 * a prop instead of subscribing to the store.
 */
export type LayerToggleFloatingButtonProps = {
  layer: GraphLayer;
  onSelect: (next: GraphLayer) => void;
  labels: { toggle: string; product: string; knowHow: string };
};

const WRAPPER_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "96px",
  left: "16px",
  zIndex: 50,
};

const CONTROL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 8,
  borderRadius: 8,
  background: "#0f172a",
};

const OPTION_BASE_STYLE: React.CSSProperties = {
  minHeight: 28,
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid transparent",
  background: "transparent",
  color: "#cbd5e1",
  fontSize: 12,
  textAlign: "left",
  cursor: "pointer",
};

const OPTION_ACTIVE_STYLE: React.CSSProperties = {
  ...OPTION_BASE_STYLE,
  background: "#1e293b",
  border: "1px solid #475569",
  color: "#f8fafc",
};

export function LayerToggleFloatingButton({ layer, onSelect, labels }: LayerToggleFloatingButtonProps) {
  const options: { value: GraphLayer; label: string }[] = [
    { value: "product", label: labels.product },
    { value: "knowhow", label: labels.knowHow },
  ];
  return (
    <div style={WRAPPER_STYLE} data-testid="layer-toggle" aria-label={labels.toggle}>
      <div style={CONTROL_STYLE}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-layer-option={option.value}
            aria-pressed={layer === option.value}
            style={layer === option.value ? OPTION_ACTIVE_STYLE : OPTION_BASE_STYLE}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default LayerToggleFloatingButton;
```

- [ ] **Step 4: Add uiText strings**

In `src/components/LanguageProvider.tsx` `uiText`, add to **both** dictionaries:

```ts
    // en:
    layerToggleLabel: "Layer",
    layerProduct: "Products",
    layerKnowHow: "Know-how",
    knowHowSectionTitle: "Know-how",
    knowHowHostedBy: "Hosted by",
    knowHowHoldersLabel: "holders",
    knowHowListedLabel: "listed",
    transactabilityProcurable: "Procurable",
    transactabilityMustBuild: "Must build",
    transactabilityUnset: "Unassessed",
    // zh:
    layerToggleLabel: "图层",
    layerProduct: "产品",
    layerKnowHow: "技术诀窍",
    knowHowSectionTitle: "技术诀窍",
    knowHowHostedBy: "承载于",
    knowHowHoldersLabel: "掌握者",
    knowHowListedLabel: "已上市",
    transactabilityProcurable: "可外购",
    transactabilityMustBuild: "必须自建",
    transactabilityUnset: "未评估",
```

- [ ] **Step 5: Extend RadialNode**

In `src/components/RadialNode.tsx`:

Add to `RadialNodeProps` (after `showLabel`):

```ts
  /** Per ADR-0008: "diamond" renders know-how nodes in the know-how layer. */
  shape?: "circle" | "diamond";
  /**
   * Count of hidden know-how dependencies carrying `bottleneckOf`.
   * > 0 renders a red-ring count badge (bands 2 and 3) so the product
   * layer keeps answering "where is the biggest bottleneck".
   */
  knowHowBottleneckCount?: number;
```

Destructure with defaults: `shape = "circle"`, `knowHowBottleneckCount = 0`.

Add a badge helper above the component:

```tsx
function KnowHowBottleneckBadge({ count, cx, cy }: { count: number; cx: number; cy: number }) {
  if (count <= 0) return null;
  return (
    <g data-knowhow-bottlenecks={count}>
      <circle cx={cx} cy={cy} r={9} fill="#fff" stroke="#dc2626" strokeWidth={2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#dc2626">
        {count}
      </text>
    </g>
  );
}
```

Band 2: render the marker as a diamond when `shape === "diamond"` — replace the single `<circle …>` (lines 204–212) with:

```tsx
          {shape === "diamond" ? (
            <rect
              data-node-shape="diamond"
              x={BAND2_CENTER_X - r}
              y={BAND2_CIRCLE_Y - r}
              width={r * 2}
              height={r * 2}
              transform={`rotate(45 ${BAND2_CENTER_X} ${BAND2_CIRCLE_Y})`}
              fill={fill}
              opacity={opacity}
              stroke={outline}
              strokeWidth={hasOutline ? 1.5 : 0}
            />
          ) : (
            <circle
              cx={BAND2_CENTER_X}
              cy={BAND2_CIRCLE_Y}
              r={r}
              fill={fill}
              opacity={opacity}
              stroke={outline}
              strokeWidth={hasOutline ? 1.5 : 0}
            />
          )}
          <KnowHowBottleneckBadge
            count={knowHowBottleneckCount}
            cx={BAND2_CENTER_X + r}
            cy={BAND2_CIRCLE_Y - r}
          />
```

Band 1: same conditional for the overview dot (lines 166–168) — diamond via rotated rect at `BAND3_CENTER_X/Y` with the role radius; no badge at band 1.

Band 3: the HTML card keeps its rectangle; add the badge as an absolutely-positioned chip inside the card `div` (after the maturity `<span>`):

```tsx
            {knowHowBottleneckCount > 0 ? (
              <span
                data-knowhow-bottlenecks={knowHowBottleneckCount}
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#dc2626",
                  background: "#fff",
                  border: "2px solid #dc2626",
                  borderRadius: 9,
                  padding: "0 5px",
                }}
              >
                {knowHowBottleneckCount}
              </span>
            ) : null}
```

and add `position: "relative"` to the card's outer `div` style.

- [ ] **Step 6: Wire layer state through GraphExplorer**

In `src/components/GraphExplorer.tsx`:

1. Imports:

```ts
import { LayerToggleFloatingButton } from "./LayerToggleFloatingButton";
import {
  ARTIFACT_DIM_FILL,
  DEFAULT_GRAPH_LAYER,
  knowHowBottleneckCounts,
  knowHowFill,
  layerHidesEdge,
  layerHidesNode,
  type GraphLayer,
} from "@/lib/knowHowLayer";
import { isKnowHowNode } from "@/lib/canvasGraph";
```

2. State, next to `colorMode` (line 799):

```ts
  const [graphLayer, setGraphLayer] = useState<GraphLayer>(DEFAULT_GRAPH_LAYER);
```

3. Badge counts memo, after the `subset` memo (line 994):

```ts
  const khBottleneckCounts = useMemo(
    () => (graphLayer === "product" ? knowHowBottleneckCounts(canvasGraph) : new Map<string, number>()),
    [graphLayer, canvasGraph],
  );
```

4. flowNodes memo (loop starting line 1016): immediately after the existing `if (!focalSubtree.has(node.id)) continue;` add:

```ts
      if (layerHidesNode(node, graphLayer)) continue;
```

Where the node's `data` object is built (the `RadialNodeData` literal later in the loop), override fill/add fields. The loop currently computes a `fill` from `subsystemHue`; wrap it:

```ts
      const isKh = isKnowHowNode(node);
      const layerFill = graphLayer === "knowhow"
        ? (isKh ? knowHowFill(node) : ARTIFACT_DIM_FILL)
        : baseFill; // baseFill = the existing subsystemHue-derived fill variable
```

and in the data literal set `fill: layerFill`, plus:

```ts
        shape: graphLayer === "knowhow" && isKh ? "diamond" as const : "circle" as const,
        knowHowBottleneckCount: khBottleneckCounts.get(node.id) ?? 0,
```

Add `shape` and `knowHowBottleneckCount` to the `RadialNodeData` type (lines 79–100) and pass them through the `RadialDotNode` wrapper (lines 102–146) into `<RadialNode>`.

Add `graphLayer` and `khBottleneckCounts` to the flowNodes memo dependency array.

5. flowEdges memo: the relation guard was changed in Task 5 to `isCanvasTreeEdge`. Directly after it add:

```ts
      if (layerHidesEdge(edge, graphLayer, nodeById)) continue;
```

(`nodeById` already exists in this memo.) Add `graphLayer` to the dependency array.

6. Mount the toggle: in the component's returned JSX, adjacent to wherever the canvas chrome lives (the same fragment that renders the detail rail — locate the top-level wrapper around `<ReactFlow`), add:

```tsx
      <LayerToggleFloatingButton
        layer={graphLayer}
        onSelect={setGraphLayer}
        labels={{ toggle: t("layerToggleLabel"), product: t("layerProduct"), knowHow: t("layerKnowHow") }}
      />
```

(`t` comes from the `useLanguage()` call already made at the top of `GraphExplorer` — line 762 destructures `kindName, nodeName`; add `t` to that destructuring.)

7. Cross-layer jump (spec: panel know-how entries "jump into the know-how layer"): extend the existing `onSelect` callback (line 907) so selecting a know-how node while in the product layer flips the layer:

```ts
  const onSelect = useCallback((nodeId: string) => {
    const target = canvasGraph.nodes.find((node) => node.id === nodeId);
    if (target && isKnowHowNode(target)) {
      setGraphLayer("knowhow");
    }
    setSelectedId(nodeId);
    setRailPanel("detail");
  }, [canvasGraph.nodes]);
```

8. Zero-holder red flag in the know-how layer (spec: "Zero holders renders as an explicit red flag"): compute a memo of holder totals for visible know-how nodes and override the node outline:

```ts
  const khZeroHolderIds = useMemo(() => {
    if (graphLayer !== "knowhow") return new Set<string>();
    const ids = new Set<string>();
    for (const node of canvasGraph.nodes) {
      if (!isKnowHowNode(node)) continue;
      if (holdersForNode(canvasGraph, node.id).total === 0) ids.add(node.id);
    }
    return ids;
  }, [graphLayer, canvasGraph]);
```

(import `holdersForNode` from `@/lib/supplyConcentration`). In the flowNodes data literal, when `graphLayer === "knowhow"` and `khZeroHolderIds.has(node.id)`, pass `outlineColor: "#dc2626"` instead of the `outlineColorFor(...)` result. Selection affordance still wins when the node is selected (keep the selected check first).

9. Selected know-how node + product layer: if `selectedId` points at a node hidden by the layer switch, keep the selection (the rail can still show it — data-level node exists). Verify no crash when switching to the product layer with a know-how node selected.

- [ ] **Step 7: Run tests**

Run: `npx tsx --test tests/layerToggle.test.ts tests/lod.test.ts` — Expected: PASS.
Run: `npm test` — Expected: PASS (layer default is "product"; tests that pin canvas-node counts now see the product layer only if they render through GraphExplorer — most pin lib-level counts, which are unchanged. Any GraphExplorer-rendering test that now misses know-how nodes: confirm the assertion's intent and update to either set layer state or assert the product-layer view).

- [ ] **Step 8: Visual smoke check**

`npm run dev` → `http://localhost:3000/graph`:
- Default: no engineering_method / manufacturing_process nodes on canvas; hosts with hidden bottleneck know-how show red-ring count badges.
- Toggle → 技术诀窍: same positions; artifact nodes grey; know-how diamonds in green/amber/grey (all grey until Task 10 backfills transactability).
- Toggle back: identical positions. No console errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/LayerToggleFloatingButton.tsx src/components/GraphExplorer.tsx src/components/RadialNode.tsx src/components/LanguageProvider.tsx tests/layerToggle.test.ts tests/lod.test.ts
git commit -m "feat: product/know-how layer toggle with transactability fills, diamonds, bottleneck badges"
```

---

### Task 8: Detail panel — know-how section, hosted-by, holders, listing chips

**Files:**
- Modify: `src/components/NodeDetailPanel.tsx` (`NodeDetailContent`, derivations at lines 115–182, render sections below)
- Test: `tests/knowHowPanel.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/knowHowPanel.test.ts`. Mirror the rendering harness used by `tests/detailRail.test.ts` (it renders `NodeDetailRail`/`NodeDetailContent` with a fixture graph through `renderToStaticMarkup`, wrapped in the language provider if that's what the existing test does — copy its setup verbatim, including any provider wrapper):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NodeDetailContent } from "../src/components/NodeDetailPanel";

const node = (id: string, kind: string, overrides: object = {}) =>
  ({ id, name: id, kind, domain: ["t"], maturityLabel: "mature", ...overrides }) as never;

const graph = {
  nodes: [
    node("mod", "module"),
    node("kh", "engineering_method", {
      transactability: "must_build",
      bottleneckOf: ["mod"],
    }),
    node("org_pub", "organization", { listingStatus: "public", ticker: "6954.T" }),
    node("org_priv", "organization", { listingStatus: "private" }),
  ],
  edges: [
    { id: "e1", source: "mod", target: "kh", relation: "requires" },
    { id: "e2", source: "kh", target: "org_pub", relation: "implemented_by" },
    { id: "e3", source: "kh", target: "org_priv", relation: "implemented_by" },
    { id: "e4", source: "mod", target: "org_pub", relation: "manufactured_by" },
  ],
  evidence: [],
} as never;

test("artifact node detail lists its know-how dependencies with transactability chips", () => {
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph, node: (graph as { nodes: never[] }).nodes[0] }),
  );
  assert.match(html, /data-testid="knowhow-section"/);
  assert.match(html, /kh/);
  assert.match(html, /data-transactability="must_build"/);
});

test("know-how node detail shows hosted-by and holder summary", () => {
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph, node: (graph as { nodes: never[] }).nodes[1] }),
  );
  assert.match(html, /data-testid="knowhow-hosted-by"/);
  assert.match(html, /data-testid="holders-summary"/);
  assert.match(html, /data-holders-total="2"/);
  assert.match(html, /data-holders-listed="1"/);
});

test("organization links carry listing chips with ticker", () => {
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph, node: (graph as { nodes: never[] }).nodes[1] }),
  );
  assert.match(html, /data-listing-status="public"[^>]*>[^<]*6954\.T/);
  assert.match(html, /data-listing-status="private"/);
});
```

(If `NodeDetailContent` requires the language provider in scope, wrap exactly as `tests/detailRail.test.ts` does.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/knowHowPanel.test.ts`
Expected: FAIL — testids absent.

- [ ] **Step 3: Implement panel additions**

In `src/components/NodeDetailPanel.tsx`:

1. Imports:

```ts
import { isKnowHowNode } from "@/lib/canvasGraph";
import { holdersForNode } from "@/lib/supplyConcentration";
import { listingInfoForOrg } from "@/lib/knowHowLayer";
```

2. Derivations inside `NodeDetailContent` (with the other derivations, lines 126–182) — derive directly from `graph.edges` (don't reuse the org-specialized `outgoingEdges` helper from lines 126–141):

```ts
  const knowHowDeps = graph.edges
    .filter((edge) =>
      edge.source === node.id &&
      (edge.relation === "requires" || edge.relation === "implemented_by") &&
      edge.reviewStatus !== "deprecated")
    .map((edge) => graph.nodes.find((n) => n.id === edge.target))
    .filter((child): child is NonNullable<typeof child> => Boolean(child))
    .filter((child) => isKnowHowNode(child) && child.reviewStatus !== "deprecated");

  const knowHowHosts = isKnowHowNode(node)
    ? graph.edges
        .filter((edge) =>
          edge.target === node.id &&
          (edge.relation === "requires" || edge.relation === "implemented_by") &&
          edge.reviewStatus !== "deprecated")
        .map((edge) => graph.nodes.find((n) => n.id === edge.source))
        .filter((host): host is NonNullable<typeof host> => Boolean(host))
        .filter((host) => !isKnowHowNode(host) && host.kind !== "organization")
    : [];

  const holderSummary = isKnowHowNode(node) ? holdersForNode(graph, node.id) : null;
```

3. Small chip components (file scope, near `InlineMetricList`):

```tsx
function TransactabilityChip({ value, t }: { value?: "procurable" | "must_build"; t: (k: string) => string }) {
  const label = value === "procurable"
    ? t("transactabilityProcurable")
    : value === "must_build"
    ? t("transactabilityMustBuild")
    : t("transactabilityUnset");
  const color = value === "procurable" ? "#15803d" : value === "must_build" ? "#b45309" : "#64748b";
  return (
    <span
      data-transactability={value ?? "unset"}
      style={{ fontSize: 11, border: `1px solid ${color}`, color, borderRadius: 4, padding: "0 4px", marginLeft: 6 }}
    >
      {label}
    </span>
  );
}

function ListingChip({ org }: { org: Node }) {
  const info = listingInfoForOrg(org);
  if (info.status === "unknown" && !info.ticker) return null;
  const label = info.ticker ?? info.status;
  return (
    <span
      data-listing-status={info.status}
      style={{ fontSize: 11, background: "#f1f5f9", borderRadius: 4, padding: "0 4px", marginLeft: 6 }}
    >
      {label}
    </span>
  );
}
```

4. Render sections. After the existing upstream/downstream (or metrics) sections — pick the spot matching the file's section order so know-how reads alongside structural relations:

```tsx
      {knowHowDeps.length > 0 ? (
        <section data-testid="knowhow-section">
          <h3>{t("knowHowSectionTitle")}</h3>
          <ul>
            {knowHowDeps.map((dep) => (
              <li key={dep.id}>
                <button type="button" onClick={() => onSelectNode?.(dep.id)}>
                  {nodeName(dep)}
                </button>
                <TransactabilityChip value={dep.transactability} t={t} />
                {(dep.bottleneckOf?.length ?? 0) > 0 ? (
                  <span style={{ color: "#dc2626", marginLeft: 6 }} title="bottleneck">●</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isKnowHowNode(node) ? (
        <section data-testid="knowhow-meta">
          <TransactabilityChip value={node.transactability} t={t} />
          {holderSummary ? (
            <p
              data-testid="holders-summary"
              data-holders-total={holderSummary.total}
              data-holders-listed={holderSummary.listed}
              style={holderSummary.total === 0 ? { color: "#dc2626", fontWeight: 600 } : undefined}
            >
              {holderSummary.total} {t("knowHowHoldersLabel")} · {holderSummary.listed} {t("knowHowListedLabel")}
            </p>
          ) : null}
          {knowHowHosts.length > 0 ? (
            <div data-testid="knowhow-hosted-by">
              <h4>{t("knowHowHostedBy")}</h4>
              <ul>
                {knowHowHosts.map((host) => (
                  <li key={host.id}>
                    <button type="button" onClick={() => onSelectNode?.(host.id)}>
                      {nodeName(host)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
```

Match surrounding section markup (the file's existing `<section>`/heading classes) rather than the bare tags above if they differ — keep the `data-testid` / `data-*` attributes exactly as tested.

5. Listing chips on org links: in the existing render of `manufacturerLinks` and `implementerLinks` rows (search for where `manufacturerLinks` is mapped to JSX), append `<ListingChip org={link.organization} />` after each organization name link. Also, when the panel's node itself is an organization, render `<ListingChip org={node} />` next to the title block.

- [ ] **Step 4: Run tests**

Run: `npx tsx --test tests/knowHowPanel.test.ts tests/detailRail.test.ts tests/manufacturerLinks.test.ts` — Expected: PASS.
Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/NodeDetailPanel.tsx tests/knowHowPanel.test.ts
git commit -m "feat: detail panel know-how section, holder summary, org listing chips"
```

---

### Task 9: validate-data warning for missing transactability

**Files:**
- Modify: `scripts/validate-data.ts`

- [ ] **Step 1: Add the warning rule**

In `scripts/validate-data.ts`, follow the existing rule-function pattern (string-array collectors around lines 129–157; warn-not-error per the cost-currency precedent at ~line 227). Add:

```ts
function warnKnowHowTransactability(graph: GraphData): string[] {
  const warnings: string[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== "engineering_method" && node.kind !== "manufacturing_process") continue;
    if (node.reviewStatus === "deprecated") continue;
    if (node.transactability !== undefined) continue;
    warnings.push(
      `warn: know-how node ${node.id} has no transactability (procurable | must_build) — ADR-0008 backfill pending`,
    );
  }
  return warnings;
}
```

Call it where other rules run and print via `console.warn` WITHOUT pushing into the fatal `errors` array:

```ts
  const transactabilityWarnings = warnKnowHowTransactability(graph);
  for (const warning of transactabilityWarnings) console.warn(warning);
  if (transactabilityWarnings.length > 0) {
    console.warn(`warn: ${transactabilityWarnings.length} know-how nodes missing transactability`);
  }
```

- [ ] **Step 2: Run and verify warning fires, exit code stays 0**

Run: `npm run validate:data; echo "exit: $?"`
Expected: warnings for the 36 parcel + 17 ai-chain know-how nodes (53 total), `exit: 0`.

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-data.ts
git commit -m "feat: validate-data warns on know-how nodes missing transactability"
```

---

### Task 10: Parcel-graph data backfill (transactability + org listing)

**Files:**
- Create: `scripts/backfill-knowhow-transactability.mjs`
- Create: `scripts/backfill-org-listing.mjs`
- Modify (via scripts): `data/nodes/parcel_sorting_robot.json`

**Scope guard:** parcel graph only. Do NOT touch `data/nodes/ai_compute_chain.json` (hot file, concurrent session). Do NOT invent tickers beyond the seed table — when not in the table, set `listingStatus` only if certain, else `"unknown"`, and never set `ticker`.

- [ ] **Step 1: Write the transactability backfill script**

Create `scripts/backfill-knowhow-transactability.mjs`:

```js
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../data/nodes/parcel_sorting_robot.json", import.meta.url);

// Judgments per ADR-0008. procurable = a real market sells this as a
// service/dataset/license; must_build = embodied know-how, not separately
// transactable. Each value lands with a review note — these are agent
// judgments pending human review.
const TRANSACTABILITY = {
  // engineering_method
  low_cost_realtime_vision_compute_integration: ["procurable", "system integrators sell vision-compute integration"],
  vision_model_deployment_optimization: ["procurable", "deployment/optimization consulting and tooling market exists"],
  vision_inference_runtime_stack: ["procurable", "commercial/licensable runtimes (TensorRT, ONNX Runtime)"],
  camera_sdk_frame_acquisition_pipeline: ["procurable", "vendor SDKs plus integration services"],
  vision_latency_budget_and_timestamping: ["must_build", "integrator-internal engineering discipline, not sold separately"],
  barcode_ocr_reading_software: ["procurable", "commercial packages (Cognex, Zebra, Datalogic)"],
  parcel_label_localization: ["procurable", "shipped inside commercial barcode/OCR offerings"],
  industrial_barcode_decoding_runtime: ["procurable", "commercial decoder runtimes"],
  parcel_ocr_model_runtime: ["procurable", "commercial OCR runtimes/licensable models"],
  barcode_ocr_no_read_recovery: ["must_build", "line-specific exception workflow, integrator-built"],
  parcel_label_training_dataset: ["procurable", "data products and annotation services market"],
  barcode_ocr_benchmark_metrics: ["must_build", "internal benchmarking method"],
  parcel_suction_cup_contact_qualification: ["procurable", "vacuum vendors offer application qualification engineering"],
  vacuum_blowoff_timing_and_contamination_control: ["must_build", "cell-specific tuning know-how"],
  gripper_tcp_pattern_calibration: ["must_build", "in-house calibration procedure"],
  servo_drive_motion_control_loop: ["must_build", "drive vendor embedded firmware know-how, not sold separately"],
  servo_drive_thermal_emc_design: ["must_build", "vendor-internal design capability"],
  servo_motor_feedback_alignment: ["must_build", "motor-manufacturing internal process know-how"],
  robot_realtime_control_runtime: ["procurable", "licensable RT runtimes and control platforms"],
  robot_controller_diagnostics_interface: ["procurable", "ships as controller product feature"],
  parcel_induction_spacing_control: ["must_build", "sortation integrator core control logic"],
  parcel_singulation_and_metering: ["procurable", "purchasable singulator subsystems from sortation vendors"],
  dynamic_gap_control_logic: ["must_build", "integrator-specific control logic"],
  induction_exception_recovery: ["must_build", "integrator-built exception workflow"],
  plc_wcs_sorting_handshake_and_fault_recovery: ["procurable", "system-integrator service offering"],
  jam_detection_and_recovery: ["must_build", "integrator-built detection/recovery logic"],
  delta_robot_parcel_variability_jam_control: ["must_build", "no separate market; sibling-product embedded know-how"],
  // manufacturing_process
  reducer_lubrication_and_life_test: ["must_build", "reducer-vendor internal process; life-test know-how is the moat"],
  servo_motor_assembly_and_test_process: ["procurable", "contract manufacturing services exist"],
  robot_base_installation_alignment_process: ["procurable", "installation/commissioning service market"],
  robot_arm_assembly_process: ["procurable", "contract manufacturing/EMS services"],
  modular_cell_manufacturing: ["must_build", "the maker's own production system design"],
  copper_ore_mining_and_refining_chain: ["procurable", "commodity industry chain; output traded openly"],
  iron_ore_steelmaking_chain: ["procurable", "commodity industry chain"],
  bauxite_alumina_aluminum_chain: ["procurable", "commodity industry chain"],
  quartz_silica_silicon_chain: ["procurable", "commodity chain at the parcel-robot consumption tier"],
};

const raw = readFileSync(FILE, "utf8");
const nodes = JSON.parse(raw);
let applied = 0;
for (const node of nodes) {
  const entry = TRANSACTABILITY[node.id];
  if (!entry) continue;
  const [value, rationale] = entry;
  if (node.transactability !== undefined) continue;
  node.transactability = value;
  const note = `transactability=${value} (agent backfill 2026-06-10, needs review): ${rationale}`;
  node.notes = node.notes ? `${node.notes} ${note}` : note;
  applied += 1;
}
writeFileSync(FILE, `${JSON.stringify(nodes, null, 2)}\n`);
console.log(`applied transactability to ${applied} nodes`);
```

**Before running:** confirm the JSON file's top level is an array (`head -c 50 data/nodes/parcel_sorting_robot.json`) and the indentation is 2 spaces; if the file is `{ "nodes": [...] }`-shaped or differently indented, adapt the read/write lines so `git diff` shows only the intended field additions.

- [ ] **Step 2: Run it**

```bash
node scripts/backfill-knowhow-transactability.mjs
git diff --stat data/
```

Expected: `applied transactability to 36 nodes`; diff touches only `parcel_sorting_robot.json`. Spot-check `git diff` — only `transactability` + `notes` lines added.

- [ ] **Step 3: Write the org-listing backfill script**

Create `scripts/backfill-org-listing.mjs` — same read/modify/write skeleton, with this seed table and rule:

```js
// High-confidence seed (status, ticker). subsidiary => ticker is the listed parent's.
const LISTING = {
  org_fanuc: ["public", "6954.T"],
  org_abb_robotics: ["public", "ABBN.SW"],
  org_yaskawa: ["public", "6506.T"],
  org_siemens: ["public", "SIE.DE"],
  org_mitsubishi_electric: ["public", "6503.T"],
  org_rockwell_automation: ["public", "ROK"],
  org_schneider_electric: ["public", "SU.PA"],
  org_estun: ["public", "002747.SZ"],
  org_inovance: ["public", "300124.SZ"],
  org_nabtesco: ["public", "6268.T"],
  org_harmonic_drive_systems: ["public", "6324.T"],
  org_leaderdrive: ["public", "688017.SS"],
  org_shuanghuan_transmission: ["public", "002472.SZ"],
  org_nvidia: ["public", "NVDA"],
  org_intel: ["public", "INTC"],
  org_advantech: ["public", "2395.TW"],
  org_adlink_technology: ["public", "6166.TW"],
  org_hikrobot: ["subsidiary", "002415.SZ"],
  org_keyence: ["public", "6861.T"],
  org_cognex: ["public", "CGNX"],
  org_datalogic: ["public", "DAL.MI"],
  org_zebra_technologies: ["public", "ZBRA"],
  org_basler: ["public", "BSL.DE"],
  org_smc: ["public", "6273.T"],
  org_schmalz: ["private", null],
  org_festo: ["private", null],
  org_wayzim: ["public", "688211.SS"],
  org_dematic_kion: ["subsidiary", "KGX.DE"],
  org_vanderlande_toyota: ["subsidiary", "6201.T"],
  org_interroll: ["public", "IRN.SW"],
  org_daifuku: ["public", "6383.T"],
  org_honeywell_intelligrated: ["subsidiary", "HON"],
  org_manhattan_associates: ["public", "MANH"],
  org_sick: ["private", null],
  org_dupont: ["public", "DD"],
  org_shin_etsu: ["public", "4063.T"],
  org_dow: ["public", "DOW"],
  org_wacker_chemie: ["public", "WCH.DE"],
  org_omron: ["public", "6645.T"],
  org_ckd: ["public", "6407.T"],
  org_airtac: ["public", "1590.TW"],
  org_jlmag: ["public", "300748.SZ"],
  org_zhongke_sanhuan: ["public", "000970.SZ"],
  org_ningbo_yunsheng: ["public", "600366.SS"],
  org_china_northern_rare_earth: ["public", "600111.SS"],
  org_mp_materials: ["public", "MP"],
  org_lynas_rare_earths: ["public", "LYC.AX"],
  org_xiamen_tungsten: ["public", "600549.SS"],
  org_infineon_technologies: ["public", "IFX.DE"],
  org_stmicroelectronics: ["public", "STM"],
  org_onsemi: ["public", "ON"],
  org_texas_instruments: ["public", "TXN"],
  org_allegro_microsystems: ["public", "ALGM"],
  org_thk: ["public", "6481.T"],
  org_nsk: ["public", "6471.T"],
  org_schaeffler: ["public", "SHA.DE"],
  org_citic_special_steel: ["public", "000708.SZ"],
  org_baosteel: ["public", "600019.SS"],
  org_nippon_steel: ["public", "5401.T"],
  org_chalco: ["public", "601600.SS"],
  org_alcoa: ["public", "AA"],
  org_norsk_hydro: ["public", "NHY.OL"],
  org_posco: ["public", "005490.KS"],
  org_renishaw: ["public", "RSW.L"],
  org_skf: ["public", "SKF-B.ST"],
  org_ntn: ["public", "6472.T"],
  org_amphenol: ["public", "APH"],
  org_te_connectivity: ["public", "TEL"],
  org_tsmc: ["public", "2330.TW"],
  org_smic: ["public", "0981.HK"],
  org_gcl_technology: ["public", "3800.HK"],
  org_jiangxi_copper: ["public", "600362.SS"],
  org_zijin_mining: ["public", "601899.SS"],
  org_freeport_mcmoran: ["public", "FCX"],
  org_arcelormittal: ["public", "MT"],
  org_tokyo_ohka_kogyo: ["public", "4186.T"],
  org_ase_technology: ["public", "3711.TW"],
  org_amkor_technology: ["public", "AMKR"],
  org_ibiden: ["public", "4062.T"],
  org_heidenhain: ["private", null],
  org_tamagawa_seiki: ["private", null],
  org_piab: ["subsidiary", null],
  org_onrobot: ["private", null],
  org_opt_machine_vision: ["public", "688686.SS"],
  org_leuze: ["private", null],
  org_banner_engineering: ["private", null],
  org_ifm: ["private", null],
  org_lem: ["public", "LEHN.SW"],
  org_kendrion: ["public", "KENDR.AS"],
  org_mayr_power_transmission: ["private", null],
  org_molex: ["subsidiary", null],
  org_jsr: ["private", null],
};
```

Rule in the script: for each `kind === "organization"` node in the parcel file — if in the table, set `listingStatus` (+ `ticker` when non-null); otherwise set `listingStatus: "unknown"`. Always append a note `listing backfill 2026-06-10 (agent, needs review)` the same way as the transactability script. Skip nodes that already have `listingStatus`. Print the applied/unknown counts.

- [ ] **Step 4: Run it and validate**

```bash
node scripts/backfill-org-listing.mjs
npm run validate:data; echo "exit: $?"
npm test
```

Expected: validate passes (exit 0; transactability warnings drop to the 17 ai-chain nodes), full suite passes. `git diff data/` shows only field/notes additions on parcel orgs.

- [ ] **Step 5: Visual check then commit**

`npm run dev` → know-how layer now shows green/amber diamonds; a know-how node's rail shows "N 掌握者 · M 已上市"; org rows show ticker chips.

```bash
git add scripts/backfill-knowhow-transactability.mjs scripts/backfill-org-listing.mjs data/nodes/parcel_sorting_robot.json
git commit -m "data: parcel-graph transactability + org listing backfill (agent, needs review)"
```

---

### Task 11: Documentation — ADR-0008, CONTEXT.md, scenarios

**Files:**
- Create: `docs/adr/0008-product-knowhow-layer-split.md`
- Modify: `docs/CONTEXT.md` → **correction: the file is repo-root `CONTEXT.md`** (Language section + graph visualization section)
- Modify: `docs/investor-operator-scenarios.md`
- Modify: `docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md` (status line)

- [ ] **Step 1: Write ADR-0008**

Create `docs/adr/0008-product-knowhow-layer-split.md`:

```markdown
---
status: accepted
---

# Product / know-how layer split; transactability as the moat signal

## Context

The canvas mixed artifacts (product, module, equipment, material) with
embodied activities (engineering_method, manufacturing_process). The
"make every node a product" instinct resolved into: every dependency
either has a transactional form or it doesn't, and that distinction is
the signal worth modelling (procurable know-how is a service product;
non-procurable know-how is where make-vs-buy bites).

Audience framing: the north star stays "a learner studying
manufacturing"; personas are learning focuses. The currently
prioritized focus is the retail secondary-market investor hunting
supply-chain chokepoints ("shiso leaf" strategy): irreplaceable,
high-barrier, supply-concentrated, market-ignored upstream segments.

## Decision

1. Kinds stay. "Know-how" (技术诀窍) is the display-layer umbrella for
   `engineering_method` + `manufacturing_process`. "Capability" remains
   reserved for the ADR-0004 demand container.
2. New optional node fields: `transactability: procurable | must_build`
   (know-how kinds only), `listingStatus` / `ticker` (organizations
   only), `capacityLeadTimeMonths` (reserved, unpopulated).
3. /graph is one persistent radial map with two layers (ADR-0007
   stable identity): the default product layer renders artifact kinds
   only; the know-how layer dims artifacts to grey and lights know-how
   nodes as diamonds colored by transactability.
4. The canvas tree includes `implemented_by` edges whose target is a
   know-how node, so implemented_by-only know-how attaches to its host.
5. Bottlenecks must survive the split: product-layer hosts carry a
   red-ring count badge for hidden know-how dependencies with
   `bottleneckOf`; the detail panel folds the know-how list (metric
   pattern) with cross-layer jumps.
6. Supply concentration is derived, never stored: holder count =
   distinct non-deprecated orgs via `manufactured_by` /
   `implemented_by`. Zero holders is an explicit red flag.
7. ADR-0005 amendment: mature + holder count ≤ 3 ⇒ still a
   decomposition frontier (the override becomes the rule).
8. Listing info reads schema fields first, then falls back to the
   ai-chain convention (`public_company` tag + "Public listing"
   metric), so existing data needs no migration to get chips.

## Considered alternatives

- Service-ify all know-how nodes: invents markets that don't exist and
  erases the must_build signal. Rejected.
- Merge know-how into host products as text: demotes 12 flagged
  bottleneck/frontier/key-tech nodes to prose; loses maturity/cost/
  evidence anchoring. Rejected.
- Separate know-how map: breaks spatial memory; a layer over one
  skeleton preserves ADR-0007 stable identity. Rejected.

## Consequences

- Default /graph answers "what do you buy"; one click answers "what
  must be mastered, who holds it, is it listed".
- Mature-but-concentrated nodes re-enter the frontier/task loop
  (gate counts shift; recorded in the 2026-06-10 implementation).
- ai-chain know-how transactability backfill is a follow-up
  (validate-data warns until then).
- Market attention / expectation gap is deliberately not modelled.
```

- [ ] **Step 2: Update root `CONTEXT.md`**

(a) In the **Language** section, after the "Key technology" entry, add:

```markdown
**Know-how (技术诀窍)**:
Display-layer umbrella term for `kind: "engineering_method"` and
`kind: "manufacturing_process"` nodes — embodied activities and
knowledge, as opposed to purchasable artifacts. Each know-how node
carries `transactability`: `procurable` (a real market sells it as a
service/dataset/license — conceptually a service product) or
`must_build` (embodied in firms; not separately transactable — the
moat/bottleneck habitat). Supply concentration (holder count) is
derived from `implemented_by` / `manufactured_by` edges at read time.
_Avoid_: capability (reserved for the demand container), skill, craft.
```

(b) In the **Graph visualization conventions** section, update the first bullet's node accounting: canvas kinds split into the product layer (default: product, module, equipment, material) and the know-how layer (engineering_method, manufacturing_process as transactability-colored diamonds over a greyed artifact skeleton); the canvas union gains the 5 implemented_by-attached know-how nodes (update the "77 structural nodes" figure to the observed union count from Task 5, and note the layer toggle bottom-left above the color-mode floret).

- [ ] **Step 3: Update `docs/investor-operator-scenarios.md`**

Replace the `## Target Audiences` section with:

```markdown
## Learning Focuses (audiences)

"Learner" is the umbrella — every persona is a learner with a
different focus. Feature priority follows the order below
(re-ranked 2026-06-10 per ADR-0008):

1. Retail secondary-market investor (散户) hunting supply-chain
   chokepoints: irreplaceable, high-barrier, supply-concentrated,
   market-ignored upstream segments with listed suppliers.
2. Startup founder evaluating where to build a wedge product.
3. Manufacturing analyst explaining cost, throughput, and adoption risk.
4. Curious operator comparing whether the product boundary is credible.
```

Append to `## Scenario Questions`:

```markdown
8. Which know-how dependencies of the focal product are must-build
   (no market sells them), and who are the few organizations that
   hold them?
9. For a given bottleneck know-how, how many holders exist and how
   many are listed (with tickers visible)?
10. Which mature-looking nodes stay decomposition-eligible because
    their supply is concentrated (≤ 3 holders)?
11. Where is substitution pressure visible — i.e. which sibling
    product candidates are maturing under the same capability?
```

- [ ] **Step 4: Mark the spec implemented**

In `docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md`, change the `**Status**:` line to:

```markdown
**Status**: implemented on branch `product-knowhow-layers` (2026-06-10); pending user review/merge
```

- [ ] **Step 5: Commit**

```bash
git add docs/adr/0008-product-knowhow-layer-split.md docs/adr/0005-decomposition-stop-and-key-technology.md CONTEXT.md docs/investor-operator-scenarios.md docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md
git commit -m "docs: ADR-0008 layer split, CONTEXT know-how term, investor learning-focus scenarios"
```

---

### Task 12: Final verification sweep

- [ ] **Step 1: Full gates**

```bash
npm run verify          # lint + check:graph-ux + full test suite
npm run validate:data   # exit 0; only the 17 ai-chain transactability warnings remain
npm run gate            # gate still runs; note any frontier-count shifts in the summary
npm run build           # production build compiles
```

Expected: all pass. If `check:graph-ux` pins chrome/node expectations that the layer toggle changes, read the failing rule and update it only if the spec's acceptance sketch justifies it (the toggle is sanctioned chrome).

- [ ] **Step 2: Acceptance sketch walkthrough (from the spec)**

With `npm run dev`:
1. Default /graph shows only artifact kinds; know-how toggle reveals diamonds with transactability colors.
2. A host module with hidden bottleneck know-how shows the red-ring badge; count matches its flagged dependencies; panel lists them with jump links.
3. An organization row shows listing status/ticker.
4. validate-data warns only on ai-chain know-how nodes.
5. Switching layers does not move any node (spot-check by eye on two sectors).

- [ ] **Step 3: Summarize for review**

Do NOT merge. Produce a summary for the user: branch name, commit list (`git log --oneline master..HEAD`), test/verify output, the pinned-count updates made in Tasks 3/5 with justifications, screenshots-worthy states (product layer with badges; know-how layer colors), and the recorded follow-ups (ai-chain transactability backfill; opportunity color mode; evidence feed; chain cards; humanoid expansion).
```
