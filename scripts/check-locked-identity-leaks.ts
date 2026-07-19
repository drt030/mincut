import { DOMAIN_ROUTES } from "../src/lib/domains";
import { stripExposureLayer } from "../src/lib/exposureGate";
import { loadActiveGraphData } from "../src/lib/graphLoader";

const REQUIRED_LOCKED_IDENTITY_TERMS = [
  "locked supplier",
  "Holroyd",
  "ADI",
  "Air Products",
  "Aerojet Rocketdyne",
  "Honeywell",
  "Northrop Grumman",
  "Safran",
  "Moog",
  "Woodward",
  "L3Harris",
  "Quasonix",
];

type Leak = {
  term: string;
  path: string;
  value: string;
};

let leakCount = 0;

for (const route of DOMAIN_ROUTES) {
  const sourceGraph = loadActiveGraphData(route.rootId);
  const { graph } = stripExposureLayer(sourceGraph, []);
  const terms = route.entitlement ? REQUIRED_LOCKED_IDENTITY_TERMS : [];
  const leaks = terms.flatMap((term) => findIdentityLeaks(graph, term));
  leakCount += leaks.length;

  const status = leaks.length === 0 ? "ok" : "leak";
  console.log(`${status} ${route.href}: scanned ${terms.length} locked identity term(s), found ${leaks.length} leak(s)`);
  for (const leak of leaks) {
    console.log(`  - ${leak.term} at ${leak.path}: ${leak.value}`);
  }
}

if (leakCount > 0) {
  console.error(`Locked identity leak check failed: ${leakCount} leak(s) found.`);
  process.exit(1);
}

console.log("Locked identity leak check passed.");

function findIdentityLeaks(value: unknown, term: string, path = "graph"): Leak[] {
  if (typeof value === "string") {
    return stringContainsIdentity(value, term) ? [{ term, path, value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findIdentityLeaks(entry, term, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => findIdentityLeaks(entry, term, `${path}.${key}`));
}

function stringContainsIdentity(value: string, term: string): boolean {
  return (
    identityTextPattern(term).test(value) ||
    identityIdentifierPattern(term).test(value) ||
    (looksUrlLike(value) &&
      compactIdentityString(term).length >= 5 &&
      compactIdentityString(value).includes(compactIdentityString(term)))
  );
}

function identityTextPattern(term: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}_])`, "iu");
}

function identityIdentifierPattern(term: string): RegExp {
  const parts = term.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(escapeRegExp);
  if (parts.length === 0) return /$a/;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]+")}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function looksUrlLike(value: string): boolean {
  return /https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}/i.test(value);
}

function compactIdentityString(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
