import { loadGraphData } from "../src/lib/graphLoader";
import { stripExposureLayer } from "../src/lib/exposureGate";
const full = loadGraphData();
const { graph, locked } = stripExposureLayer(full, []);
console.log("locked summary:", JSON.stringify(locked));
const r = graph.nodes.find((n) => n.id === "humanoid_reducer_transmission_stack");
console.log("reducer node present in stripped graph:", !!r);
console.log("reducer node.domain:", r?.domain);
// emulate useLockedDomainForNode
const tags = r?.domain ?? [];
const match = locked.find((e) => e.hiddenOrgCount > 0 && tags.includes(e.domainTag));
console.log("useLockedDomainForNode would return:", match ? JSON.stringify(match) : "null");
