import { readFileSync } from "node:fs";
import { join } from "node:path";
import { domainBySlug, DOMAIN_ROUTES } from "../src/lib/domains";
import { loadActiveGraphData, loadGraphData, validateGraphReferences } from "../src/lib/graphLoader";
import { nodeById, V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";

const targetNodeId = V0_TARGET_NODE_ID;
const homePagePath = join(process.cwd(), "src/app/page.tsx");
const homeLaunchSectionsPath = join(process.cwd(), "src/components/HomeLaunchSections.tsx");
const explorePagePath = join(process.cwd(), "src/app/explore/page.tsx");
const graphPagePath = join(process.cwd(), "src/app/graph/page.tsx");
const domainPagePath = join(process.cwd(), "src/app/d/[slug]/page.tsx");
const productPagePath = join(process.cwd(), "src/app/product/[id]/page.tsx");
const aiComputeRootId = "ai_accelerator_module_hbm_cowos";
const deferredProductIds = [
  "iphone_4",
  "glp1_weight_loss_drugs",
  "reusable_space_transport_1000_usd_per_kg",
  "commercial_controlled_nuclear_fusion",
  "ultra_small_nuclear_reactor",
  "ak47_rifle_historical_industrial_case",
];

const fullGraph = loadGraphData();
const activeGraph = loadActiveGraphData();

if (!nodeById(activeGraph, targetNodeId)) {
  throw new Error(`Active graph is missing v0 target: ${targetNodeId}`);
}

if (nodeById(activeGraph, aiComputeRootId)) {
  throw new Error(`Default active graph must remain scoped to ${targetNodeId}; AI compute belongs to /d/ai-compute`);
}

for (const id of deferredProductIds) {
  if (!nodeById(fullGraph, id)) {
    throw new Error(`Full graph should keep deferred fixture product: ${id}`);
  }
  if (nodeById(activeGraph, id)) {
    throw new Error(`Active graph should not expose deferred fixture product: ${id}`);
  }
}

const referenceErrors = validateGraphReferences(activeGraph);
if (referenceErrors.length) {
  throw new Error(`Active graph has reference errors:\n${referenceErrors.join("\n")}`);
}

const aiComputeRoute = domainBySlug("ai-compute");
if (!aiComputeRoute) {
  throw new Error("DOMAIN_ROUTES must register /d/ai-compute");
}

if (aiComputeRoute.rootId !== aiComputeRootId) {
  throw new Error(`/d/ai-compute must be rooted at ${aiComputeRootId}; found ${aiComputeRoute.rootId}`);
}

const parcelRoute = domainBySlug("parcel-robot");
if (parcelRoute) {
  throw new Error("/d/parcel-robot is not part of the public free-launch portfolio; parcel stays an internal target");
}

for (const domain of DOMAIN_ROUTES) {
  const domainGraph = loadActiveGraphData(domain.rootId);
  if (!nodeById(domainGraph, domain.rootId)) {
    throw new Error(`/d/${domain.slug} graph is missing its registry root: ${domain.rootId}`);
  }
}

function assertHomePageUsesAiComputeRoute(pagePath: string, launchSectionsPath: string): void {
  const pageSource = readFileSync(pagePath, "utf8");
  if (!/\bdomainBySlug\s*\(\s*["']ai-compute["']\s*\)/.test(pageSource)) {
    throw new Error(`${pagePath} must resolve root / through the ai-compute domain route`);
  }

  if (!/\bloadActiveGraphData\s*\(\s*domain\.rootId\s*\)/.test(pageSource)) {
    throw new Error(`${pagePath} must load the ai-compute route graph through domain.rootId`);
  }

  if (/\bV0_TARGET_NODE_ID\b/.test(pageSource)) {
    throw new Error(`${pagePath} must not switch the free homepage by reading V0_TARGET_NODE_ID`);
  }

  if (!/import\s*{[^}]*\bHomeLaunchSections\b[^}]*}\s*from\s*["']@\/components\/HomeLaunchSections["']/.test(pageSource)) {
    throw new Error(`${pagePath} must import HomeLaunchSections`);
  }

  if (!/<HomeLaunchSections\b[\s\S]*\bfoundingCheckoutLink=/.test(pageSource)) {
    throw new Error(`${pagePath} must render the founding-access launch section`);
  }

  const launchSectionsSource = readFileSync(launchSectionsPath, "utf8");
  if (
    !/\bid="private-beta"/.test(launchSectionsSource) ||
    !/buttondown\.com\/api\/emails\/embed-subscribe\/drt030/.test(launchSectionsSource)
  ) {
    throw new Error(`${launchSectionsPath} must expose the founding-access waitlist fallback`);
  }

  if (!/href={foundingCheckoutLink}/.test(launchSectionsSource)) {
    throw new Error(`${launchSectionsPath} must expose the active founding checkout link`);
  }
}

function assertActiveGraphPageUsesActiveScopedData(pagePath: string): string {
  const pageSource = readFileSync(pagePath, "utf8");
  const activeGraphLoaderImportPattern = /import\s*{[\s\S]*?\bloadActiveGraphData\b[\s\S]*?}\s*from\s*["']@\/lib\/graphLoader["'];?/;
  if (!activeGraphLoaderImportPattern.test(pageSource)) {
    throw new Error(`${pagePath} must import loadActiveGraphData from @/lib/graphLoader`);
  }

  if (!/\bloadActiveGraphData\s*\(/.test(pageSource)) {
    throw new Error(`${pagePath} must use loadActiveGraphData() so active graph pages read the active graph`);
  }

  if (/\bloadGraphData\b/.test(pageSource)) {
    throw new Error(`${pagePath} must not use loadGraphData; active graph pages read the active graph`);
  }

  return pageSource;
}

assertHomePageUsesAiComputeRoute(homePagePath, homeLaunchSectionsPath);

const explorePageSource = assertActiveGraphPageUsesActiveScopedData(explorePagePath);
if (!/import\s*{[\s\S]*?\bHomeContent\b[\s\S]*?}\s*from\s*["']@\/components\/HomeContent["'];?/.test(explorePageSource)) {
  throw new Error(`${explorePagePath} must import HomeContent as the active graph research home`);
}

if (!/<HomeContent\b[\s\S]*\bgraph=/.test(explorePageSource)) {
  throw new Error(`${explorePagePath} must render HomeContent with active graph data`);
}

assertActiveGraphPageUsesActiveScopedData(graphPagePath);

const domainPageSource = assertActiveGraphPageUsesActiveScopedData(domainPagePath);
if (!/from\s*["']@\/lib\/domains["'];?/.test(domainPageSource) || !/\bdomainBySlug\s*\(\s*slug\s*\)/.test(domainPageSource)) {
  throw new Error(`${domainPagePath} must resolve /d/[slug] through the domain registry`);
}

if (!/\bloadActiveGraphData\s*\(\s*domain\.rootId\s*\)/.test(domainPageSource)) {
  throw new Error(`${domainPagePath} must switch domains by passing domain.rootId to loadActiveGraphData()`);
}

if (/\bV0_TARGET_NODE_ID\b/.test(domainPageSource)) {
  throw new Error(`${domainPagePath} must not switch domains by changing or reading V0_TARGET_NODE_ID`);
}

const productPageSource = readFileSync(productPagePath, "utf8");
const graphLoaderImportPattern = /import\s*{[\s\S]*?\bloadGraphData\b[\s\S]*?}\s*from\s*["']@\/lib\/graphLoader["'];?/;
if (!graphLoaderImportPattern.test(productPageSource)) {
  throw new Error(`${productPagePath} must import loadGraphData from @/lib/graphLoader`);
}

if (!/\bloadGraphData\s*\(/.test(productPageSource)) {
  throw new Error(`${productPagePath} must use loadGraphData() so product detail pages read the full graph`);
}

if (/\bloadActiveGraphData\b/.test(productPageSource)) {
  throw new Error(`${productPagePath} must not use loadActiveGraphData; product detail pages read the full graph`);
}
