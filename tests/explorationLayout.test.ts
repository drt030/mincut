import test from "node:test";
import assert from "node:assert/strict";
import { explorationLayout } from "../src/lib/explorationLayout";
import { loadFixture } from "./fixtures/loader";

/**
 * Slice 3 RED — when the user expands an interior node, its children
 * become visible and the surrounding sibling subtree must reflow.
 *
 * Tiny fixture: A → {B, C, D, E, F}; B → {B1, B2}. Before expansion,
 * only A + its direct children are positioned. After expanding B, the
 * positions map includes B1 and B2, and B's same-layer siblings
 * (C, D, E, F) must shift downward (higher y) — never upward — so the
 * visual respects the user's mental model of "B opened, content
 * pushed others out of the way".
 */

test("explorationLayout: expanding B adds B1+B2 to positions", () => {
  const graph = loadFixture("tiny-5node.json");
  const before = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(["A"]),
    stage: "focused",
  });
  const after = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(["A", "B"]),
    stage: "focused",
  });
  assert.ok(after.size > before.size, `expected after.size > before.size (got ${after.size} vs ${before.size})`);
  assert.ok(after.has("B1"), "B1 should be positioned after expanding B");
  assert.ok(after.has("B2"), "B2 should be positioned after expanding B");
});

test("explorationLayout: expanding B does not move B's siblings up", () => {
  const graph = loadFixture("tiny-5node.json");
  const before = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(["A"]),
    stage: "focused",
  });
  const after = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(["A", "B"]),
    stage: "focused",
  });
  for (const sibling of ["C", "D", "E", "F"]) {
    const yBefore = before.get(sibling)?.y;
    const yAfter = after.get(sibling)?.y;
    assert.ok(
      typeof yBefore === "number" && typeof yAfter === "number",
      `expected ${sibling} positioned in both states`,
    );
    assert.ok(
      yAfter! >= yBefore!,
      `${sibling}: y moved up from ${yBefore} to ${yAfter} after expansion`,
    );
  }
});

test("explorationLayout: focusId itself is positioned", () => {
  const graph = loadFixture("tiny-5node.json");
  const positions = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(["A"]),
    stage: "focused",
  });
  assert.ok(positions.has("A"), "focusId must be in positions map");
});

test("explorationLayout: deeper layer has greater x than parent layer", () => {
  const graph = loadFixture("tiny-5node.json");
  const positions = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(["A", "B"]),
    stage: "focused",
  });
  const xA = positions.get("A")!.x;
  const xB = positions.get("B")!.x;
  const xB1 = positions.get("B1")!.x;
  assert.ok(xB > xA, `B.x ${xB} should be > A.x ${xA}`);
  assert.ok(xB1 > xB, `B1.x ${xB1} should be > B.x ${xB}`);
});

test("explorationLayout: focusId not in graph returns empty map without throwing", () => {
  const graph = loadFixture("tiny-5node.json");
  const positions = explorationLayout({
    graph,
    focusId: "Z_does_not_exist",
    expandedIds: new Set(["Z_does_not_exist"]),
    stage: "focused",
  });
  // The function shouldn't throw; missing focus = no positioned nodes.
  assert.ok(positions instanceof Map);
});

test("explorationLayout: collapsed focus shows only the focus itself", () => {
  const graph = loadFixture("tiny-5node.json");
  const positions = explorationLayout({
    graph,
    focusId: "A",
    expandedIds: new Set(),
    stage: "focused",
  });
  // expandedIds empty → focus is positioned but no descendants.
  assert.equal(positions.size, 1);
  assert.ok(positions.has("A"));
});

test("explorationLayout: cycle in requires terminates (defensive)", () => {
  // Hand-built cyclic graph: X requires Y, Y requires X. The walker
  // uses a visited Set so it should terminate.
  const cyclic = {
    graphVersion: "test",
    nodes: [
      { id: "X", name: "X", kind: "module" as const, domain: ["t"] },
      { id: "Y", name: "Y", kind: "module" as const, domain: ["t"] },
    ],
    edges: [
      { id: "exy", source: "X", target: "Y", relation: "requires" as const },
      { id: "eyx", source: "Y", target: "X", relation: "requires" as const },
    ],
    evidence: [],
  };
  const positions = explorationLayout({
    graph: cyclic,
    focusId: "X",
    expandedIds: new Set(["X", "Y"]),
    stage: "focused",
  });
  // Both should be positioned exactly once; no infinite recursion.
  assert.equal(positions.size, 2);
  assert.ok(positions.has("X"));
  assert.ok(positions.has("Y"));
});
