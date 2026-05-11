import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphData } from "../../src/lib/schema";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load a hand-built fixture graph for tests. Fixtures live next to this
 * loader as `*.json` and are typed as `GraphData` at the boundary — no
 * Zod re-validation, because the tests intentionally exercise edge cases
 * (e.g. cost inversions) that would still pass the schema but trigger
 * specific runtime behaviours.
 */
export function loadFixture(name: string): GraphData {
  const filePath = path.join(here, name);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as GraphData;
}
