import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PoliciesPage, { metadata } from "../src/app/policies/page";

test("purchase policy states the complete bilingual $9 experiment boundary", () => {
  const html = renderToStaticMarkup(React.createElement(PoliciesPage));

  assert.match(html, /USD \$9 is a one-time payment/);
  assert.match(html, /does not renew automatically/);
  assert.match(html, /Humanoid robotics — core map/);
  assert.match(html, /SpaceX reusable launch — core map/);
  assert.match(html, /Controlled fusion — early-research add-on/);
  assert.match(html, /companies are capability candidates, not confirmed suppliers/);
  assert.match(html, /AI compute remains fully free/);
  assert.match(html, /within seven calendar days/);
  assert.match(html, /Access is stored in a signed cookie/);
  assert.match(html, /does not store raw card numbers/);
  assert.match(html, /not investment advice/);
  assert.match(html, /9 美元为一次性付款/);
  assert.match(html, /不会自动续费/);
  assert.match(html, /人形机器人——核心地图/);
  assert.match(html, /可控核聚变——早期研究附加地图/);
  assert.match(html, /公司是能力候选，不是已确认供应商/);
  assert.match(html, /AI 算力地图继续完整免费/);
  assert.match(html, /七个自然日内可以申请退款/);
  assert.match(html, /不构成任何投资建议/);
  assert.doesNotMatch(html, /support@drt030\.com/);
});

test("purchase policy publishes canonical metadata and is reachable from the offer", () => {
  assert.equal(metadata.alternates?.canonical, "/policies");
  const homeOfferSource = readFileSync("src/components/HomeLaunchSections.tsx", "utf8");
  assert.match(homeOfferSource, /<Link href="\/policies">/);
  const thesisSource = readFileSync("src/components/DomainThesisBanner.tsx", "utf8");
  const exposureSource = readFileSync("src/components/ExposureLockCta.tsx", "utf8");
  assert.match(thesisSource, /href="\/policies"/);
  assert.match(exposureSource, /href="\/policies"/);
});
