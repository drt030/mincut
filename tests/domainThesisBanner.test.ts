import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DomainThesisBanner } from "../src/components/DomainThesisBanner";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("domain thesis leads with the product thesis before the access banner", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "humanoid-robotics",
        rootId: "humanoid_robot_key_component_stack",
        title: "Humanoid robotics component stack",
        description: "Humanoid robot component chain across actuators, hands, battery, thermal, sensing, compute, control software, manufacturing, and service.",
        portfolioState: "paid-candidate",
      },
      evidence: { reviewed: 0, total: 19 },
    }),
  );

  assert.match(html, /data-testid="domain-thesis-banner"/);
  assert.match(html, /<h1>Humanoid robotics component stack<\/h1>/);
  assert.match(html, /Humanoid robot component chain across actuators/);
  assert.doesNotMatch(html, /Paid-candidate route for humanoid robot actuators/);
  assert.match(html, /Paid-candidate preview/);
  assert.match(html, /Supplier exposure is gated/);
  assert.match(html, /Review status is shown per claim/);
  assert.doesNotMatch(html, /Free: thesis, decomposition graph, bottlenecks, and evidence/);
  assert.doesNotMatch(html, /19 records, none reviewed yet/);
  assert.doesNotMatch(html, /Start with graph/);
  assert.doesNotMatch(html, /href="#domain-graph"/);
});

test("domain thesis does not spend first-screen attention explaining free access", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "ai-compute",
        rootId: "ai_accelerator_module_hbm_cowos",
        title: "AI compute chain",
        description: "Reference map from wafer to rack.",
        portfolioState: "full-free-flagship",
      },
      evidence: { reviewed: 5, total: 21 },
    }),
  );

  assert.match(html, /<h1>AI compute chain<\/h1>/);
  assert.match(html, /Reference map from wafer to rack/);
  assert.doesNotMatch(html, /Start with graph/);
  assert.doesNotMatch(html, /href="#domain-graph"/);
  assert.doesNotMatch(html, /domain-thesis-actions/);
  assert.doesNotMatch(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /Complete graph, supplier exposure, tickers/);
  assert.doesNotMatch(html, /Visible evidence: 5 reviewed \/ 21 total records/);
  assert.doesNotMatch(html, /none reviewed yet/);
});
