import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadActiveGraphData, loadGraphData, validateGraphReferences } from "../src/lib/graphLoader";
import { nodeById, V0_TARGET_NODE_ID } from "../src/lib/graphTraversal";

const targetNodeId = V0_TARGET_NODE_ID;
const homePagePath = join(process.cwd(), "src/app/page.tsx");
const graphPagePath = join(process.cwd(), "src/app/graph/page.tsx");
const productPagePath = join(process.cwd(), "src/app/product/[id]/page.tsx");
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

function assertActiveGraphPageUsesActiveScopedData(pagePath: string): void {
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
}

assertActiveGraphPageUsesActiveScopedData(homePagePath);
assertActiveGraphPageUsesActiveScopedData(graphPagePath);

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
