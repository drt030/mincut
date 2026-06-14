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
  assert.match(html, /Map and evidence visible; supplier\/ticker exposure locked/);
  assert.match(html, /Private beta waitlist; exposure access opens only after audit and entitlement checks pass/);
  assert.doesNotMatch(html, /no paid unlock/i);
  assert.match(html, /Join private beta waitlist/);
  assert.match(html, /href="\/#private-beta"/);
  assert.doesNotMatch(html, /Free: thesis, decomposition graph, bottlenecks, and evidence/);
  assert.doesNotMatch(html, /19 records, none reviewed yet/);
  assert.doesNotMatch(html, /Start with graph/);
  assert.doesNotMatch(html, /href="#domain-graph"/);
  assert.doesNotMatch(html, /href="\/#weekly-map"/);
});

test("domain thesis labels audit-preview maps as research, not paid access", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "spacex-reusable-launch",
        rootId: "spacex_reusable_launch_stack",
        title: "SpaceX reusable launch stack",
        description: "SpaceX-centered reusable launch map.",
        portfolioState: "audit-preview",
      },
      evidence: { reviewed: 0, total: 9 },
    }),
  );

  assert.match(html, /Research preview/);
  assert.match(html, /Research map open; exposure is not sold until review passes/);
  assert.match(html, /Evidence visible; none reviewed yet. Research preview only/);
  assert.match(html, /Review access state/);
  assert.doesNotMatch(html, /Paid-candidate preview/);
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
