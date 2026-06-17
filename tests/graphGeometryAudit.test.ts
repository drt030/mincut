import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { auditGraphGeometry } from "../src/lib/graphGeometryAudit";
import { loadActiveGraphData } from "../src/lib/graphLoader";

test("commercial route high-fanout nodes split source ports for readable edge bundles", () => {
  for (const route of DOMAIN_ROUTES) {
    const audit = auditGraphGeometry(loadActiveGraphData(route.rootId), route.rootId);

    assert.deepEqual(
      audit.fanoutPortFailures,
      [],
      `${route.slug} has high-fanout edge bundle failures`,
    );
  }
});

test("AI compute interconnect and optics keeps seven outgoing edges on distinct ports", () => {
  const audit = auditGraphGeometry(
    loadActiveGraphData("ai_accelerator_module_hbm_cowos"),
    "ai_accelerator_module_hbm_cowos",
  );
  const interconnect = audit.highFanoutNodes.find((node) =>
    node.nodeId === "interconnect_and_optics"
  );

  assert.ok(interconnect, "interconnect_and_optics should be audited as a high-fanout node");
  assert.equal(interconnect.outgoingEdgeCount, 7);
  assert.equal(interconnect.uniqueSourceAnchorCount, 7);
  assert.ok(
    interconnect.minimumSourceAnchorDistance >= 18,
    `interconnect_and_optics ports should be visibly separated; got ${interconnect.minimumSourceAnchorDistance.toFixed(1)}px`,
  );
});
