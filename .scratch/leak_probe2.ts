import { loadGraphData } from "../src/lib/graphLoader";
import { stripExposureLayer } from "../src/lib/exposureGate";
const { graph } = stripExposureLayer(loadGraphData(), []);
// 1) org nodes still present that have a gated-only tag
const gated = new Set(["humanoid_robotics","controlled_fusion","spacex_reusable_launch","spacex_orbital_data_center","humanoid_actuator","ai_dc_power_chain"]);
const free = new Set(["ai_compute_chain","parcel_sorting_robot"]);
const leakedOrgs = graph.nodes.filter((n)=>n.kind==="organization" && (n.domain??[]).some((t)=>gated.has(t)) && !(n.domain??[]).some((t)=>free.has(t)) && !(n.tags??[]).includes("free_teaser"));
console.log("leaked gated-only org NODES still present:", leakedOrgs.length);
leakedOrgs.slice(0,8).forEach((n)=>console.log("   ", n.id, "|", n.name, "|", n.domain));
// 2) where does "Nabtesco" appear?
const s = JSON.stringify(graph);
const idx = s.indexOf("Nabtesco");
console.log("\n'Nabtesco' first context:", idx>=0 ? s.slice(Math.max(0,idx-90), idx+30) : "NOT FOUND");
