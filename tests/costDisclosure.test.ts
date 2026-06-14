import test from "node:test";
import assert from "node:assert/strict";
import { costEvidenceNeedText } from "../src/lib/costDisclosure";
import type { Node } from "../src/lib/schema";

const copy: Record<string, string> = {
  readerCostMissingReviewedSource: "fallback",
  readerCostNeedCapacityCapex: "capacity-capex",
  readerCostNeedLaunchEconomics: "launch-economics",
  readerCostNeedPriceBom: "price-bom",
  readerCostNeedQualification: "qualification",
  readerCostNeedUnitEconomics: "unit-economics",
};

const t = (key: string) => copy[key] ?? key;

function node(overrides: Partial<Node>): Node {
  return {
    id: "n",
    name: "Node",
    kind: "module",
    domain: ["test"],
    ...overrides,
  } as Node;
}

test("costEvidenceNeedText classifies cost gaps by missing evidence type", () => {
  assert.equal(
    costEvidenceNeedText(
      node({
        metrics: [{
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "not priceable from reviewed data",
          description: "No source prices qualification cost, lifetime, and replacement reserve.",
        }],
      }),
      t,
    ),
    "qualification",
  );

  assert.equal(
    costEvidenceNeedText(
      node({
        tags: ["constraint_economic_validation"],
        metrics: [{
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "unknown",
          description: "Needs demand, utilization, and unit economics evidence.",
        }],
      }),
      t,
    ),
    "unit-economics",
  );

  assert.equal(
    costEvidenceNeedText(
      node({
        description: "Orbital launch mass-to-orbit cost depends on $/kg proxy.",
        metrics: [{
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "unknown",
        }],
      }),
      t,
    ),
    "launch-economics",
  );

  assert.equal(
    costEvidenceNeedText(
      node({
        description: "Factory line and tooling expansion are the unknown capex drivers.",
        metrics: [{
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "unknown",
        }],
      }),
      t,
    ),
    "capacity-capex",
  );

  assert.equal(
    costEvidenceNeedText(
      node({
        description: "Needs supplier quote and BOM proxy.",
        metrics: [{
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "unknown",
        }],
      }),
      t,
    ),
    "price-bom",
  );
});

test("costEvidenceNeedText keeps multiple missing evidence types when they both apply", () => {
  assert.equal(
    costEvidenceNeedText(
      node({
        metrics: [{
          name: "Cost disclosure",
          unit: "audit status",
          currentValue: "not priceable from reviewed data",
          description: "No source prices qualification, replacement rate, utilization reserve, and unit economics.",
        }],
      }),
      t,
    ),
    "unit-economics; qualification",
  );
});
