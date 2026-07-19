import fs from "node:fs";
import path from "node:path";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { stripExposureLayer } from "../src/lib/exposureGate";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const chunksRoot = path.resolve(".next/static/chunks");
if (!fs.existsSync(chunksRoot)) {
  throw new Error("Missing .next/static/chunks; run this check after next build");
}

const clientBundle = filesUnder(chunksRoot)
  .filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

let leakCount = 0;

for (const route of DOMAIN_ROUTES.filter((entry) => entry.entitlement)) {
  const full = loadActiveGraphData(route.rootId);
  const visible = stripExposureLayer(full, []).graph;
  const visibleIds = new Set(visible.nodes.map((node) => node.id));
  const hiddenOrganizationIds = full.nodes
    .filter((node) => node.kind === "organization" && !visibleIds.has(node.id))
    .map((node) => node.id);
  const leakedOrganizationIds = hiddenOrganizationIds.filter((id) => clientBundle.includes(id));

  leakCount += leakedOrganizationIds.length;
  console.log(
    `${leakedOrganizationIds.length === 0 ? "ok" : "leak"} ${route.href}: ` +
      `${leakedOrganizationIds.length}/${hiddenOrganizationIds.length} locked organization id(s) in client bundles`,
  );
}

const env = readLocalEnv();
for (const key of ["STRIPE_SECRET_KEY", "STRIPE_PRICE_FOUNDING", "ENTITLEMENT_SECRET"] as const) {
  const value = process.env[key] ?? env.get(key);
  const leaked = Boolean(value) && clientBundle.includes(value as string);
  if (leaked) leakCount += 1;
  console.log(`${leaked ? "leak" : "ok"} ${key}: ${leaked ? "value found" : "value absent"} in client bundles`);
}

if (leakCount > 0) {
  throw new Error(`Client paid-layer leak check failed: ${leakCount} leak(s) found`);
}

console.log("Client paid-layer leak check passed.");

function filesUnder(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(resolved) : [resolved];
  });
}

function readLocalEnv(): Map<string, string> {
  const result = new Map<string, string>();
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) return result;

  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    result.set(key, rawValue.replace(/^(['"])(.*)\1$/, "$2"));
  }
  return result;
}
