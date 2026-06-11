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
  assert.match(html, /data-listing-status="public"/);
  assert.match(html, /6954\.T/);
  assert.match(html, /data-listing-status="private"/);
});
