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
        allAccessRole: "core",
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
  assert.match(html, /Paid exposure preview/);
  assert.match(html, /All-access is for research only; not investment advice/);
  assert.doesNotMatch(html, /no paid unlock/i);
  assert.match(html, /Join the \$9 access list/);
  assert.match(html, /href="\/#private-beta"/);
  assert.doesNotMatch(html, /Free: thesis, decomposition graph, bottlenecks, and evidence/);
  assert.doesNotMatch(html, /19 records, none reviewed yet/);
  assert.doesNotMatch(html, /Start with graph/);
  assert.doesNotMatch(html, /href="#domain-graph"/);
  assert.doesNotMatch(html, /href="\/#weekly-map"/);
});

test("domain thesis explains audit-preview access boundaries in the first screen", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "spacex-reusable-launch",
        rootId: "spacex_reusable_launch_stack",
        title: "SpaceX reusable launch stack",
        description: "SpaceX-centered reusable launch map.",
        portfolioState: "audit-preview",
        allAccessRole: "core",
      },
      evidence: { reviewed: 5, total: 9 },
      foundingCheckoutLink: "https://buy.example/founding",
    }),
  );

  assert.match(html, /SpaceX reusable launch stack/);
  assert.match(html, /SpaceX-centered reusable launch map/);
  assert.match(html, /domain-thesis-actions/);
  assert.match(html, /Paid exposure preview/);
  assert.match(html, /structure, bottleneck thesis, and evidence trail/i);
  assert.match(html, /current company\/ticker layer is part of \$9 all-access/i);
  assert.match(html, /Evidence trail: 9 records, 5 owner-reviewed/);
  assert.match(html, /Unlock all current maps — \$9/);
  assert.match(html, /href="https:\/\/buy\.example\/founding"/);
  assert.match(html, /href="\/policies"/);
  assert.match(html, /Refund, privacy, and access recovery/);
  assert.doesNotMatch(html, /Paid-candidate preview/);
  assert.doesNotMatch(html, /Future paid domain/);
  assert.match(html, /\$9/);
});

test("domain thesis tracks the direct founding checkout surface", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/components/DomainThesisBanner.tsx", import.meta.url), "utf8");

  assert.match(source, /track\("checkout_click"/);
  assert.match(source, /surface: "domain_thesis"/);
  assert.match(source, /domain: domain\.slug/);
});

test("domain thesis localizes the paid boundary in Simplified Chinese", async () => {
  const { LanguageProvider } = await import("../src/components/LanguageProvider");
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLanguage: "zh" },
      React.createElement(DomainThesisBanner, {
        domain: {
          slug: "spacex-reusable-launch",
          rootId: "spacex_reusable_launch_stack",
          title: "SpaceX reusable launch stack",
          description: "SpaceX-centered reusable launch map.",
          portfolioState: "audit-preview",
          allAccessRole: "core",
        },
        evidence: { reviewed: 5, total: 9 },
        foundingCheckoutLink: "https://buy.example/founding",
      }),
    ),
  );

  assert.match(html, /SpaceX 可回收发射栈/);
  assert.match(html, /付费公司 \/ 股票关联预览/);
  assert.match(html, /\$9 解锁全部当前地图/);
  assert.doesNotMatch(html, /SpaceX-centered reusable launch map/);
});

test("domain thesis shows unlocked state and suppresses repeat checkout", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "humanoid-robotics",
        rootId: "humanoid_robot_key_component_stack",
        title: "Humanoid robotics component stack",
        description: "Humanoid robot component chain.",
        portfolioState: "audit-preview",
        allAccessRole: "core",
      },
      evidence: { reviewed: 6, total: 19 },
      foundingCheckoutLink: null,
      isUnlocked: true,
    }),
  );

  assert.match(html, /All-access unlocked/);
  assert.match(html, /Paid exposure preview/);
  assert.match(html, /Company, ticker, relationship, and organization-level evidence are available/);
  assert.doesNotMatch(html, /Join the \$9 access list/);
  assert.doesNotMatch(html, /checkout_click/);
});

test("domain thesis preserves add-on maturity before and after unlock", () => {
  const common = {
    slug: "controlled-fusion",
    rootId: "controlled_fusion_route_portfolio",
    title: "Controlled fusion route portfolio",
    description: "Fusion route portfolio.",
    portfolioState: "audit-preview" as const,
    allAccessRole: "early-research-addon" as const,
  };

  const lockedHtml = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: common,
      evidence: { reviewed: 3, total: 25 },
      foundingCheckoutLink: "https://buy.example/founding",
    }),
  );
  const unlockedHtml = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: common,
      evidence: { reviewed: 3, total: 25 },
      isUnlocked: true,
    }),
  );

  assert.match(lockedHtml, /Early-research add-on/);
  assert.match(unlockedHtml, /Early-research add-on · All-access unlocked/);
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

test("domain thesis reports source-checked count when reviewed is 0 but sources are checked", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "humanoid-robotics",
        rootId: "humanoid_robot_key_component_stack",
        title: "Humanoid robotics component stack",
        description: "Humanoid robot component chain.",
        portfolioState: "preview",
      },
      evidence: { reviewed: 0, sourceChecked: 12, total: 27 },
    }),
  );
  assert.match(html, /12/);
  assert.match(html, /source-checked/i);
});
