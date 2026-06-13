import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { computeHolderTeasers } from "../src/lib/holderTeasers";
import { stripExposureLayer } from "../src/lib/exposureGate";
import { holdersForNode } from "../src/lib/supplyConcentration";
import { HolderTeaserProvider } from "../src/components/HolderTeaserProvider";
import { NodeDetailContent } from "../src/components/NodeDetailPanel";

const node = (id: string, kind: string, overrides: object = {}) =>
  ({ id, name: id, kind, domain: ["humanoid_actuator"], maturityLabel: "mature", ...overrides }) as never;

const edge = (id: string, source: string, target: string, relation: string) =>
  ({ id, source, target, relation }) as never;

const fullGraph = {
  nodes: [
    node("kh", "manufacturing_process"),
    node("org_a", "organization", { listingStatus: "public", ticker: "AAA" }),
    node("org_b", "organization", { listingStatus: "private" }),
  ],
  edges: [
    edge("e1", "kh", "org_a", "implemented_by"),
    edge("e2", "kh", "org_b", "implemented_by"),
  ],
  evidence: [],
} as never;

test("teasers match full-graph holder counts and carry counts only (no identities)", () => {
  const teasers = computeHolderTeasers(fullGraph);
  assert.deepEqual(teasers["kh"], { total: 2, listed: 1 });
  assert.deepEqual(Object.keys(teasers["kh"]).sort(), ["listed", "total"]);
  assert.equal(JSON.stringify(teasers).includes("org_a"), false);
});

test("locked-domain strip zeroes local computation but teaser keeps full-graph numbers", () => {
  const { graph: stripped } = stripExposureLayer(fullGraph, []);
  assert.equal(stripped.nodes.some((n: { kind: string }) => n.kind === "organization"), false);
  assert.equal(holdersForNode(stripped, "kh").total, 0);
  assert.deepEqual(computeHolderTeasers(fullGraph)["kh"], { total: 2, listed: 1 });
});

test("NodeDetailContent shows teaser counts for a stripped graph when provider is mounted", () => {
  const { graph: stripped } = stripExposureLayer(fullGraph, []);
  const khNode = (stripped as { nodes: { id: string }[] }).nodes.find((n) => n.id === "kh");
  const html = renderToStaticMarkup(
    React.createElement(
      HolderTeaserProvider,
      { teasers: computeHolderTeasers(fullGraph) },
      React.createElement(NodeDetailContent, { graph: stripped, node: khNode as never }),
    ),
  );
  assert.match(html, /data-holders-total="2"/);
  assert.match(html, /data-holders-listed="1"/);
});

test("NodeDetailContent falls back to local computation without a provider", () => {
  const khNode = (fullGraph as { nodes: { id: string }[] }).nodes.find((n) => n.id === "kh");
  const html = renderToStaticMarkup(
    React.createElement(NodeDetailContent, { graph: fullGraph, node: khNode as never }),
  );
  assert.match(html, /data-holders-total="2"/);
});
