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

test("know-how node detail keeps build/buy and holder context in the graph appendix", () => {
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph, node: (graph as { nodes: never[] }).nodes[1] }),
  );

  assert.doesNotMatch(html, /data-testid="detail-knowhow-priority"/);
  assert.match(html, /data-testid="knowhow-meta"[\s\S]*data-transactability="must_build"/);
  assert.match(html, /data-testid="holders-summary"[^>]*data-holders-total="2"[^>]*data-holders-listed="1"/);
  assert.match(html, /data-testid="knowhow-hosted-by"[\s\S]*mod/);
  assert.match(html, /Heat 83\/100/);
  assert.doesNotMatch(html, /Heat 0\/100/);
  assert.ok(
    html.indexOf('data-testid="detail-reader-priority"') < html.indexOf('data-testid="knowhow-meta"'),
    `know-how build/buy and holder context should stay below the reader priority area; got: ${html}`,
  );
  assert.ok(
    html.indexOf('data-testid="detail-inspect-next"') < html.indexOf('data-testid="knowhow-meta"'),
    `know-how build/buy and holder context should not compete with first-screen drill-down prompts; got: ${html}`,
  );
  assert.ok(
    html.indexOf('data-testid="detail-relationship-lists"') < html.indexOf('data-testid="knowhow-meta"'),
    `know-how build/buy and holder context should appear inside the graph appendix; got: ${html}`,
  );
});

test("organization links carry listing chips with ticker", () => {
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph, node: (graph as { nodes: never[] }).nodes[1] }),
  );
  assert.match(html, /data-listing-status="public"/);
  assert.match(html, /6954\.T/);
  assert.match(html, /data-listing-status="private"/);
});

test("know-how node with no modeled holders does not look like Heat zero or a concatenated count", () => {
  const gapGraph = {
    nodes: [
      node("host", "module"),
      node("kh_gap", "engineering_method", {
        transactability: "must_build",
        maturityScore: 40,
      }),
    ],
    edges: [
      { id: "e_gap", source: "host", target: "kh_gap", relation: "requires" },
    ],
    evidence: [],
  } as never;

  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph: gapGraph, node: (gapGraph as { nodes: never[] }).nodes[1] }),
  );

  assert.match(html, /data-testid="holders-summary"[^>]*data-holders-total="0"/);
  assert.match(html, /0 holders/);
  assert.doesNotMatch(html, /Heat 0\/100/);
  assert.doesNotMatch(html, /holders0\s*0 listed/i);
});
