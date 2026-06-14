import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const aiComputeDomain = {
  slug: "ai-compute",
  rootId: "ai_accelerator_module_hbm_cowos",
  title: "AI compute chain",
  description: "test",
  domainTag: "ai_compute_chain",
  portfolioState: "full-free-flagship",
};

const futureGatedDomain = {
  slug: "humanoid-actuator",
  rootId: "humanoid_actuator_stack",
  title: "Humanoid actuator chain",
  description: "test",
  domainTag: "humanoid_actuator",
  entitlement: "humanoid",
  portfolioState: "paid-candidate",
};

const parcelDomain = {
  slug: "parcel-robot",
  rootId: "low_cost_parcel_sorting_robot_300k_rmb",
  title: "Parcel-sorting robot",
  description: "test",
  domainTag: "parcel_sorting_robot",
  portfolioState: "full-free-depth-demo",
};

const previewDomain = {
  slug: "humanoid-robotics",
  title: "Humanoid robotics",
  description: "test",
  domainTag: "humanoid_robotics",
  portfolioState: "preview",
};

const waitlistDomain = {
  slug: "controlled-fusion",
  title: "Controlled fusion",
  description: "test",
  domainTag: "controlled_fusion",
  portfolioState: "waitlist",
};

const auditPreviewDomain = {
  slug: "spacex-reusable-launch",
  rootId: "spacex_reusable_launch_stack",
  title: "SpaceX reusable launch stack",
  description: "test",
  domainTag: "spacex_reusable_launch",
  entitlement: "space",
  portfolioState: "audit-preview",
};

function withoutCheckoutLinks() {
  delete process.env.NEXT_PUBLIC_ENABLE_PAID_CHECKOUT;
  delete process.env.NEXT_PUBLIC_STRIPE_LINK_HUMANOID;
  delete process.env.NEXT_PUBLIC_STRIPE_LINK_POWER;
  delete process.env.NEXT_PUBLIC_STRIPE_LINK_FOUNDING;
}

test("AI compute does not render a free access banner", async () => {
  withoutCheckoutLinks();
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: aiComputeDomain,
      locked: [{ domainTag: "ai_compute_chain", entitlement: "ai_compute", hiddenOrgCount: 77 }],
    }),
  );

  assert.equal(html, "");
  assert.doesNotMatch(html, /77 suppliers hidden/);
  assert.doesNotMatch(html, /Gated exposure/);
});

test("locked future-domain banner explains free vs paid layers and hidden supplier count", async () => {
  withoutCheckoutLinks();
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: futureGatedDomain,
      locked: [{ domainTag: "humanoid_actuator", entitlement: "humanoid", hiddenOrgCount: 77 }],
    }),
  );

  assert.match(html, /data-testid="exposure-access-banner"/);
  assert.match(html, /Supplier exposure policy: 77 records gated/);
  assert.match(html, /Visible now/);
  assert.match(html, /Gated exposure/);
  assert.match(html, /decomposition graph/);
  assert.match(html, /hidden supplier identities/);
  assert.match(html, /Checkout is not live\./);
  assert.match(html, /stay in private beta/);
  assert.match(html, /href="\/#private-beta"/);
  assert.match(html, /Request private beta access/);
});

test("locked banner hides paid links unless paid checkout is explicitly enabled", async () => {
  process.env.NEXT_PUBLIC_STRIPE_LINK_HUMANOID = "https://buy.example/humanoid";
  process.env.NEXT_PUBLIC_STRIPE_LINK_FOUNDING = "https://buy.example/founding";
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: futureGatedDomain,
      locked: [{ domainTag: "humanoid_actuator", entitlement: "humanoid", hiddenOrgCount: 77 }],
    }),
  );

  assert.doesNotMatch(html, /href="https:\/\/buy\.example\/humanoid"/);
  assert.doesNotMatch(html, /href="https:\/\/buy\.example\/founding"/);
  assert.match(html, /href="\/#private-beta"/);
  assert.match(html, /Checkout is not live/);
  assert.doesNotMatch(html, /href="\/#weekly-map"/);
});

test("locked banner only renders founding checkout when paid checkout flag is enabled", async () => {
  process.env.NEXT_PUBLIC_ENABLE_PAID_CHECKOUT = "1";
  process.env.NEXT_PUBLIC_STRIPE_LINK_HUMANOID = "https://buy.example/humanoid";
  process.env.NEXT_PUBLIC_STRIPE_LINK_FOUNDING = "https://buy.example/founding";
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: futureGatedDomain,
      locked: [{ domainTag: "humanoid_actuator", entitlement: "humanoid", hiddenOrgCount: 77 }],
    }),
  );

  assert.doesNotMatch(html, /href="https:\/\/buy\.example\/humanoid"/);
  assert.match(html, /href="https:\/\/buy\.example\/founding"/);
  assert.doesNotMatch(html, /Checkout is not live/);
  assert.doesNotMatch(html, /href="\/#private-beta"/);
  withoutCheckoutLinks();
});

test("parcel robot does not render a free access banner", async () => {
  withoutCheckoutLinks();
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: parcelDomain,
      locked: [],
    }),
  );

  assert.equal(html, "");
  assert.doesNotMatch(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /suppliers hidden/);
});

test("preview portfolio banner does not present a future domain as full-free or unlocked", async () => {
  withoutCheckoutLinks();
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: previewDomain,
      locked: [],
    }),
  );

  assert.match(html, /Preview only/);
  assert.match(html, /graph route is not live yet/i);
  assert.match(html, /graph, evidence, and access model are still being reviewed/i);
  assert.doesNotMatch(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /Full-free depth demo/);
  assert.doesNotMatch(html, /Exposure layer unlocked/);
});

test("audit-preview does not render an access banner before the user asks for supplier exposure", async () => {
  withoutCheckoutLinks();
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: auditPreviewDomain,
      locked: [{ domainTag: "spacex_reusable_launch", entitlement: "space", hiddenOrgCount: 3 }],
    }),
  );

  assert.equal(html, "");
  assert.doesNotMatch(html, /Research preview/);
  assert.doesNotMatch(html, /paid access/i);
  assert.doesNotMatch(html, /Gated exposure/);
  assert.doesNotMatch(html, /3/);
  assert.doesNotMatch(html, /Request private beta access/);
});

test("waitlist portfolio banner does not imply paid or live graph access exists", async () => {
  withoutCheckoutLinks();
  const { ExposureAccessBanner } = await import("../src/components/ExposureAccessBanner");
  const html = renderToStaticMarkup(
    React.createElement(ExposureAccessBanner, {
      domain: waitlistDomain,
      locked: [],
    }),
  );

  assert.match(html, /Waitlist domain/);
  assert.match(html, /not a live graph route yet/i);
  assert.match(html, /No checkout or paid access exists for this domain yet/i);
  assert.doesNotMatch(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /Gated exposure/);
  assert.doesNotMatch(html, /Exposure layer unlocked/);
});
