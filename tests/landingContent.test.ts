import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("root page renders the graph-first ai compute workspace", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /domainBySlug\("ai-compute"\)/);
  assert.match(source, /GraphExplorer/);
  assert.match(source, /HomeMapDock/);
  assert.doesNotMatch(source, /LandingContent/);
});

test("root page exposes Buttondown and server-gated founding access", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const component = await fs.readFile(new URL("../src/components/HomeLaunchSections.tsx", import.meta.url), "utf8");

  assert.match(source, /HomeLaunchSections/);
  assert.match(source, /activeFoundingCheckoutLink/);
  assert.match(component, /https:\/\/buttondown\.com\/api\/emails\/embed-subscribe\/drt030/);
  assert.match(component, /id="private-beta"/);
  assert.match(component, /name="metadata__source"/);
  assert.match(component, /exposureLockBuy/);
  assert.match(component, /track\("checkout_click"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_STRIPE_LINK_FOUNDING/);
  assert.doesNotMatch(`${source}${component}`, /buy\.stripe\.com|landing-founding-cta/);
});

test("home founding access keeps a usable single-column mobile layout", async () => {
  const fs = await import("node:fs/promises");
  const css = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /@media \(max-width:\s*900px\)[\s\S]*?\.graph-first-waitlist\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    "the founding access band should collapse to one column before its desktop columns overflow",
  );
  assert.match(
    css,
    /@media \(max-width:\s*900px\)[\s\S]*?\.graph-first-waitlist-form\s*\{[\s\S]*?min-width:\s*0[\s\S]*?width:\s*100%/,
    "the mobile founding form should shrink to the available viewport width",
  );
  assert.match(
    css,
    /@media \(max-width:\s*560px\)[\s\S]*?\.graph-first-waitlist-form input\[type="email"\]\s*\{[\s\S]*?flex:\s*0 0 auto[\s\S]*?width:\s*100%/,
    "the stacked email input should use its normal control height instead of the desktop flex basis",
  );
  assert.match(
    css,
    /\.graph-first-waitlist \.link-button\s*\{[\s\S]*?min-height:\s*42px/,
    "the live checkout CTA should keep a usable control height",
  );
  assert.match(
    css,
    /@media \(max-width:\s*560px\)[\s\S]*?\.graph-first-waitlist \.link-button\s*\{[\s\S]*?width:\s*100%/,
    "the live checkout CTA should fill the narrow purchase band without overflowing it",
  );
});

test("home founding access is readable in Simplified Chinese", async () => {
  const { HomeLaunchSections } = await import("../src/components/HomeLaunchSections");
  const { LanguageProvider } = await import("../src/components/LanguageProvider");
  const { domainBySlug } = await import("../src/lib/domains");
  const domain = domainBySlug("ai-compute");
  assert.ok(domain);

  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLanguage: "zh" },
      React.createElement(HomeLaunchSections, {
        domain,
        foundingCheckoutLink: "https://buy.example/founding",
      }),
    ),
  );

  assert.match(html, /产业链研究工作台/);
  assert.match(html, /一次支付 \$9，解锁全部当前付费地图/);
  assert.match(html, /\$9 解锁全部当前地图/);
  assert.match(html, /无订阅，不承诺固定更新/);
  assert.match(html, /早期研究附加/);
  assert.match(html, /假设地图附加/);
  assert.match(html, /href="\/policies"/);
  assert.ok(
    html.indexOf("SpaceX 可回收发射栈") < html.indexOf("可控核聚变路线组合"),
    "core maps should be listed before experimental add-ons",
  );
  assert.doesNotMatch(html, /工作邮箱/);
  assert.doesNotMatch(html, /Buy supplier|Work email|Join waitlist/);
});

test("home all-access success state confirms delivery and removes repeat purchase", async () => {
  const { HomeLaunchSections } = await import("../src/components/HomeLaunchSections");
  const { LanguageProvider } = await import("../src/components/LanguageProvider");
  const { domainBySlug } = await import("../src/lib/domains");
  const domain = domainBySlug("ai-compute");
  assert.ok(domain);

  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(HomeLaunchSections, {
        domain,
        foundingCheckoutLink: null,
        hasAllAccess: true,
        purchaseState: "success",
      }),
    ),
  );

  assert.match(html, /All current paid maps are unlocked/);
  assert.match(html, /Payment received/);
  assert.match(html, /href="\/d\/humanoid-robotics"/);
  assert.match(html, /href="\/d\/spacex-reusable-launch"/);
  assert.match(html, /early research add-on/);
  assert.match(html, /hypothesis map add-on/);
  assert.doesNotMatch(html, /Unlock all current maps — \$9/);
  assert.doesNotMatch(html, /<form/);
});

test("legacy landing component keeps paid access as copy, not a hard-coded Stripe branch", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/components/LandingContent.tsx", import.meta.url), "utf8");

  assert.match(source, /https:\/\/buttondown\.com\/api\/emails\/embed-subscribe\/drt030/);
  assert.match(source, /id="private-beta"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_STRIPE|STRIPE|Stripe|foundingLink/);
  assert.doesNotMatch(source, /landing-founding-cta|hero-founding-cta/);
  assert.match(source, /Founding access opens the paid exposure layer/);
});

test("domain pages keep the same map dock as the graph-first home", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/app/d/[slug]/page.tsx", import.meta.url), "utf8");

  assert.match(source, /HomeMapDock/);
  assert.match(source, /<HomeMapDock activeSlug=\{domain\.slug\}/);
  assert.match(source, /graph-first-home/);
});

test("home map dock keeps collapsed shortcuts quiet", async () => {
  const { HomeMapDock } = await import("../src/components/HomeMapDock");
  const { LanguageProvider } = await import("../src/components/LanguageProvider");
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(HomeMapDock, { activeSlug: "ai-compute" }),
    ),
  );

  assert.match(html, /Maps/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /href="\/"/);
  assert.match(html, />AI</);
  assert.match(html, />SX</);
  assert.match(html, />HR</);
  assert.match(html, />CF</);
  assert.match(html, />OD</);
  assert.match(html, /home-map-shortcut-name/);
  assert.match(html, /AI compute chain/);
  assert.match(html, /Humanoid robotics component stack/);
  assert.doesNotMatch(html, /href="\/d\/parcel-robot"/);
  assert.doesNotMatch(html, />PR</);
  assert.doesNotMatch(html, />Compute</);
  assert.doesNotMatch(html, /home-map-shortcut-tooltip/);
  assert.doesNotMatch(html, /<h2>Domains<\/h2>/);
  assert.doesNotMatch(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /Paid exposure preview/);
  assert.doesNotMatch(html, /green dot/i);
  assert.doesNotMatch(html, /red dot/i);
  assert.doesNotMatch(html, /琥珀点/);
});

test("home map dock opens the full menu only from the Maps trigger", async () => {
  const fs = await import("node:fs/promises");
  const component = await fs.readFile(new URL("../src/components/HomeMapDock.tsx", import.meta.url), "utf8");
  const css = await fs.readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /setOpen/);
  assert.match(component, /Escape/);
  assert.match(component, /home-map-shortcut-name/);
  assert.match(css, /\.home-map-dock:hover\s+\.home-map-shortcut/);
  assert.match(css, /\.home-map-dock:focus-within\s+\.home-map-shortcut-name/);
  assert.doesNotMatch(css, /\.home-map-dock:hover\s+\.home-map-popover/);
});

test("home map dock localizes the commercial navigation in Chinese", async () => {
  const { HomeMapDock } = await import("../src/components/HomeMapDock");
  const { LanguageProvider } = await import("../src/components/LanguageProvider");
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      { initialLanguage: "zh" },
      React.createElement(HomeMapDock, { activeSlug: "ai-compute" }),
    ),
  );

  assert.match(html, />图谱</);
  assert.match(html, /aria-label="打开图谱组合"/);
  assert.doesNotMatch(html, />Maps</);
});
