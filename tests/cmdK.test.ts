import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// RED Slice C2 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md
// § "Slice C2 — Cmd+K search";
// ADR-0006 § "Chrome (toolbar)" — "Cmd+K search: no visible button;
// fuzzy-searches node names and metric/evidence text; Enter flies-to").
//
// `CmdKSearch` is a presentational modal component that the parent
// (page or GraphExplorer) mounts and toggles open via Cmd+K /
// Ctrl+K. The modal owns:
//
//   - An input element for typing the query.
//   - A results list rendered from `fuzzyMatch(query, graph)`.
//   - Keyboard handling for Esc (close) and Enter on a highlighted
//     result (call `onSelect(nodeId)` then close).
//
// The parent supplies an `onSelect(nodeId)` callback which performs
// the flyTo + focus action — the modal itself does NOT know about
// the canvas, the layout, or React Flow. That separation is what
// makes the modal cheap to unit-test via `renderToStaticMarkup` and
// `fuzzyMatch` cheap to unit-test as a pure function.
//
// None of these symbols exist on master at HEAD 3ceb4d3 (C1 GREEN).
// The GREEN commit creates `src/components/CmdKSearch.tsx`
// exporting `CmdKSearch`, `fuzzyMatch`, and `handleCmdKKeydown`.
// This test file fails at import time with a "cannot find module"
// error, which is the cleanest RED signal we can give the GREEN
// sub-agent.
import {
  CmdKSearch,
  fuzzyMatch,
  handleCmdKKeydown,
} from "../src/components/CmdKSearch";
import { loadGraphData } from "../src/lib/graphLoader";
import type { GraphData } from "../src/lib/schema";

// ------------------------------------------------------------------
// Fixture: the real loaded dataset. fuzzyMatch is meant to be run
// against the live graph (it's tiny — ~130 nodes); pinning it here
// also catches regressions where a data edit accidentally removes a
// node whose name the search relied on (e.g. `vision_barcode_...`).
// ------------------------------------------------------------------
const graph: GraphData = loadGraphData();

// Permissive prop type so the test references props the GREEN
// commit declares. The actual exported `CmdKSearchProps` must be
// structurally compatible with at least these fields.
type CmdKSearchTestProps = {
  graph: GraphData;
  open: boolean;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
};

function render(props: CmdKSearchTestProps): string {
  return renderToStaticMarkup(
    React.createElement(
      CmdKSearch as unknown as React.FC<CmdKSearchTestProps>,
      props,
    ),
  );
}

const noop = () => {};
const noopSelect = (_id: string) => {};

// ==================================================================
// Test 1 — open=false renders nothing visible
// ==================================================================
test("open=false: modal not present in markup", () => {
  const html = render({
    graph,
    open: false,
    onClose: noop,
    onSelect: noopSelect,
  });

  // The modal hook must be absent when closed. The GREEN commit may
  // return `null`, render a hidden wrapper, or render nothing at all
  // — we pin only that the testid does not appear.
  assert.doesNotMatch(
    html,
    /data-testid=["']cmdk-modal["']/,
    `closed CmdKSearch must NOT expose data-testid="cmdk-modal"; got: ${html}`,
  );
});

// ==================================================================
// Test 2 — open=true renders modal shell (backdrop + input)
// ==================================================================
test("open=true: modal, backdrop, and input testids present", () => {
  const html = render({
    graph,
    open: true,
    onClose: noop,
    onSelect: noopSelect,
  });

  // The modal hook must be present.
  assert.match(
    html,
    /data-testid=["']cmdk-modal["']/,
    `open CmdKSearch must expose data-testid="cmdk-modal"; got: ${html}`,
  );

  // A backdrop element (the dimmed overlay behind the modal). The
  // GREEN commit's click-to-close behaviour wires this element.
  assert.match(
    html,
    /data-testid=["']cmdk-backdrop["']/,
    `open CmdKSearch must expose data-testid="cmdk-backdrop"; got: ${html}`,
  );

  // The input where the user types the query.
  assert.match(
    html,
    /<input[^>]*data-testid=["']cmdk-input["']/,
    `open CmdKSearch must contain <input data-testid="cmdk-input">; got: ${html}`,
  );
});

// ==================================================================
// Test 3 — fuzzyMatch finds name matches; vision_barcode_... near top
// ==================================================================
test("fuzzyMatch: 'vision' returns name matches with vision_barcode_label_recognition near the top", () => {
  const results = fuzzyMatch("vision", graph);

  // Oracle: the node we're pinning still exists in the dataset.
  const oracleNode = graph.nodes.find(
    (n) => n.id === "vision_barcode_label_recognition",
  );
  assert.ok(
    oracleNode,
    "oracle: vision_barcode_label_recognition must exist in the loaded dataset",
  );

  assert.ok(
    results.length > 0,
    `fuzzyMatch("vision") must return >0 results; got ${results.length}`,
  );

  // "Near the top" — within the first 5 entries. The GREEN commit's
  // exact ordering may surface other vision-named nodes first (e.g.
  // "vision_processing_compute" sorts alphabetically before
  // "vision_barcode..."), but vision_barcode_label_recognition has
  // "vision" as a name prefix and must appear in the top slice.
  const topIds = results.slice(0, 5).map((r) => r.nodeId);
  assert.ok(
    topIds.includes("vision_barcode_label_recognition"),
    `fuzzyMatch("vision") must include vision_barcode_label_recognition in the top 5; got top ids: ${JSON.stringify(topIds)}`,
  );
});

// ==================================================================
// Test 4 — empty query returns empty array
// ==================================================================
test("fuzzyMatch: empty query returns empty array", () => {
  const results = fuzzyMatch("", graph);
  assert.deepEqual(
    results,
    [],
    `fuzzyMatch("") must return [] (no implicit "show all"); got: ${JSON.stringify(results)}`,
  );
});

// ==================================================================
// Test 5 — no-match query returns empty array
// ==================================================================
test("fuzzyMatch: 'zzzzz' returns empty array (no matches)", () => {
  const results = fuzzyMatch("zzzzz", graph);
  assert.deepEqual(
    results,
    [],
    `fuzzyMatch("zzzzz") must return [] when no node name or descriptive text matches; got: ${JSON.stringify(results)}`,
  );
});

// ==================================================================
// Test 6 — results sorted by score descending
// ==================================================================
test("fuzzyMatch: results sorted by score descending", () => {
  const results = fuzzyMatch("camera", graph);

  assert.ok(
    results.length > 1,
    `oracle: fuzzyMatch("camera") must return >1 result to exercise sort; got ${results.length}`,
  );

  for (let i = 1; i < results.length; i += 1) {
    assert.ok(
      results[i].score <= results[i - 1].score,
      `results must be sorted by score desc; result[${i}].score=${results[i].score} > result[${i - 1}].score=${results[i - 1].score}`,
    );
  }
});

// ==================================================================
// Test 7 — fuzzyMatch respects the limit argument
// ==================================================================
test("fuzzyMatch: limit caps the number of results returned", () => {
  // "a" is a very common letter — without a limit, this would return
  // dozens of matches. We pin that the explicit limit overrides the
  // default (10).
  const results = fuzzyMatch("a", graph, 3);
  assert.ok(
    results.length <= 3,
    `fuzzyMatch("a", graph, 3) must return at most 3 results; got ${results.length}`,
  );

  // Also verify the default limit is 10 — fuzzyMatch("a") without a
  // limit must not return more than 10 (the spec's pinned default).
  const defaultResults = fuzzyMatch("a", graph);
  assert.ok(
    defaultResults.length <= 10,
    `fuzzyMatch("a") (default limit) must return at most 10 results; got ${defaultResults.length}`,
  );
});

// ==================================================================
// Test 8 — Modal open=true exposes the results list container
// ==================================================================
test("open=true: results list container <ul data-testid='cmdk-results'> is present", () => {
  const html = render({
    graph,
    open: true,
    onClose: noop,
    onSelect: noopSelect,
  });

  // The results <ul> must be in the static markup even when the
  // initial input value is empty (the GREEN commit can render an
  // empty list, a placeholder <li>, or just the bare <ul> — we pin
  // only the container's testid + tag).
  assert.match(
    html,
    /<ul[^>]*data-testid=["']cmdk-results["']/,
    `open CmdKSearch must render <ul data-testid="cmdk-results">; got: ${html}`,
  );
});

// ==================================================================
// Test 9 — handleCmdKKeydown: metaKey + K toggles open
// ==================================================================
test("handleCmdKKeydown: metaKey + K calls setOpen(true)", () => {
  const calls: boolean[] = [];
  const setOpen = (next: boolean) => {
    calls.push(next);
  };

  const event = {
    key: "k",
    metaKey: true,
    ctrlKey: false,
    preventDefault: () => {},
  };
  handleCmdKKeydown(event as unknown as KeyboardEvent, setOpen);

  assert.deepEqual(
    calls,
    [true],
    `Cmd+K must call setOpen(true) exactly once; got: ${JSON.stringify(calls)}`,
  );
});

// ==================================================================
// Test 10 — handleCmdKKeydown: ctrlKey + K (cross-platform) toggles open
// ==================================================================
test("handleCmdKKeydown: ctrlKey + K calls setOpen(true)", () => {
  const calls: boolean[] = [];
  const setOpen = (next: boolean) => {
    calls.push(next);
  };

  const event = {
    key: "k",
    metaKey: false,
    ctrlKey: true,
    preventDefault: () => {},
  };
  handleCmdKKeydown(event as unknown as KeyboardEvent, setOpen);

  assert.deepEqual(
    calls,
    [true],
    `Ctrl+K must call setOpen(true) exactly once (cross-platform); got: ${JSON.stringify(calls)}`,
  );
});

// ==================================================================
// Test 11 — handleCmdKKeydown: Escape closes
// ==================================================================
test("handleCmdKKeydown: Escape calls setOpen(false)", () => {
  const calls: boolean[] = [];
  const setOpen = (next: boolean) => {
    calls.push(next);
  };

  const event = {
    key: "Escape",
    metaKey: false,
    ctrlKey: false,
    preventDefault: () => {},
  };
  handleCmdKKeydown(event as unknown as KeyboardEvent, setOpen);

  assert.deepEqual(
    calls,
    [false],
    `Escape must call setOpen(false) exactly once; got: ${JSON.stringify(calls)}`,
  );
});

// ==================================================================
// Test 12 — handleCmdKKeydown ignores unrelated keys
// ==================================================================
test("handleCmdKKeydown: unrelated keys do not call setOpen", () => {
  const calls: boolean[] = [];
  const setOpen = (next: boolean) => {
    calls.push(next);
  };

  // A plain "k" with no modifiers must NOT toggle (otherwise typing
  // the letter k in any input would open the modal).
  handleCmdKKeydown(
    {
      key: "k",
      metaKey: false,
      ctrlKey: false,
      preventDefault: () => {},
    } as unknown as KeyboardEvent,
    setOpen,
  );

  // Other non-trigger keys.
  const otherKeys = ["Enter", " ", "ArrowDown", "a", "Tab", "j"];
  for (const key of otherKeys) {
    handleCmdKKeydown(
      {
        key,
        metaKey: false,
        ctrlKey: false,
        preventDefault: () => {},
      } as unknown as KeyboardEvent,
      setOpen,
    );
  }

  assert.deepEqual(
    calls,
    [],
    `unrelated keys must NOT call setOpen; got: ${JSON.stringify(calls)}`,
  );
});
