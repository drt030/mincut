import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("landing page presents reference maps without overexplaining free access", async () => {
  const { LandingContent } = await import("../src/components/LandingContent");
  const html = renderToStaticMarkup(React.createElement(LandingContent));

  assert.match(html, /AI compute chain/);
  assert.match(html, /AI compute is the full free demo/i);
  assert.match(html, /candidate maps under audit/i);
  assert.match(html, /supplier\/ticker exposure stays locked until evidence and access gates pass/i);
  assert.match(html, /not investment advice/i);
  assert.match(html, /Parcel-sorting robot/);
  assert.match(html, /Depth reference/);
  assert.match(html, /href="\/d\/parcel-robot"/);
  assert.match(html, /Humanoid robotics component stack/);
  assert.match(html, /Controlled fusion route portfolio/);
  assert.match(html, /SpaceX reusable launch stack/);
  assert.match(html, /SpaceX orbital data center system/);
  assert.match(html, /Candidate under audit/i);
  assert.match(html, /Research preview/i);
  assert.match(html, /href="\/d\/humanoid-robotics"/);
  assert.match(html, /href="\/d\/controlled-fusion"/);
  assert.match(html, /href="\/d\/spacex-reusable-launch"/);
  assert.match(html, /href="\/d\/spacex-orbital-data-center"/);
  assert.doesNotMatch(html, /paid-candidate previews/i);
  assert.match(html, /SpaceX reusable launch and orbital data centers are research previews only/i);
  assert.match(html, /Free demos show the full method/i);
  assert.match(html, /reviewed evidence, gate reports, and access checks support promotion/i);
  assert.match(html, /No checkout is live in this preview/i);
  assert.match(html, /Private beta/i);
  assert.match(html, /id="private-beta"/);
  assert.match(html, /Request beta access/);
  assert.match(html, /metadata__source/);
  assert.match(html, /Cited evidence/i);
  assert.match(html, /Review states visible/i);
  assert.match(html, /Reviewed only when human-checked/i);
  assert.equal((html.match(/class="landing-domain-card"/g) ?? []).length, 6);

  assert.doesNotMatch(html, /\$9/);
  assert.doesNotMatch(html, /\$29 once/);
  assert.doesNotMatch(html, /Reviewed claims/);
  assert.doesNotMatch(html, /Verified exposure layer and future updates: \$9/);
  assert.doesNotMatch(html, /unlock from .*AI compute/i);
  assert.doesNotMatch(html, /free flagship/i);
  assert.doesNotMatch(html, /full-free/i);
  assert.doesNotMatch(html, /exposure layer[\s\S]{0,140}what you pay for/i);
  assert.doesNotMatch(html, /World model infrastructure/);
  assert.doesNotMatch(html, /portfolio previews, not live graph routes yet/);
  assert.doesNotMatch(html, /live paid-candidate maps/i);
  assert.doesNotMatch(html, /Paid candidate preview/i);
  assert.doesNotMatch(html, /Preview waitlist/);
  assert.doesNotMatch(html, /Research waitlist/);
  assert.doesNotMatch(html, /Join private beta waitlist[\s\S]{0,220}weekly map/i);
});
