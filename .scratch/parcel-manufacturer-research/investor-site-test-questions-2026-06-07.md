# Investor / Entrepreneur Site Test Questions

Date: 2026-06-07
Target product: `low_cost_parcel_sorting_robot_300k_rmb`
Boundary: single industrial robot-arm parcel-sorting cell, vacuum suction end-effector, one vision system, conveyor-based induction, around 300,000 RMB p50 target cost.

## Strict-Isolation Rule For Website Test Agents

Agents may use only the running website URL and browser interaction. They must not inspect repository files, local graph JSON, source code, terminal output, prior conversation context, or this repo's docs. They should answer from what they can discover by clicking, searching, expanding, scrolling, and using visible website pages.

## Scenario A: Stock Investor

Goal: identify investable exposure if low-cost robotic parcel sorting adoption accelerates over the next five years.

Questions:

1. Which product subsystem looks like the biggest current bottleneck or highest-risk dependency?
2. For that bottleneck, which manufacturer candidates or supplier organizations are linked on the website?
3. Which linked suppliers have visible market-share, capacity, performance, or public-listing metrics?
4. Which claims are unreviewed or weakly sourced, and therefore should not be treated as investment-grade evidence yet?
5. Which suppliers appear most directly exposed to the target product versus only indirectly exposed through upstream materials or adjacent large sortation systems?

Pass criteria:

- The answer names concrete nodes, not generic industries.
- The answer distinguishes bottleneck nodes from ordinary high-cost nodes.
- The answer cites visible website evidence status or uncertainty.
- The answer can find at least one manufacturer section for a component node and one supplier-exposure section for an organization node.

## Scenario B: Founder / Product Strategist

Goal: decide where a startup could attack the system's cost, reliability, or scale constraints.

Questions:

1. What is the current p50 rolled-up system cost, and how far is it from the 300,000 RMB p50 target?
2. Which subsystems have high p50 cost or high cost-coverage gaps?
3. Why might production volume or deployment scale fail to ramp quickly: raw materials, supplier concentration, integration complexity, field reliability, software/data, or safety compliance?
4. Where are plausible startup opportunities: suction end-effector reliability, low-cost vision/lighting, reducer qualification, servo/control integration, conveyor/WCS integration, maintenance tooling, or another layer visible in the graph?
5. Which parts of the graph still look incomplete enough that a founder should commission more research before choosing a wedge?

Pass criteria:

- The answer uses p50 language for costs.
- The answer surfaces coverage gaps and unreviewed claims as risk.
- The answer ties opportunities to specific graph nodes and not only to broad market needs.

## Scenario C: Manufacturing-Curious Learner

Goal: understand how the product decomposes from product to subsystem to component to supplier or process.

Questions:

1. Starting at the product node, can the website show the major first-level subsystems?
2. Can the tester drill into at least one lower layer under robot arm, vision, conveyor integration, end effector, and safety?
3. Can the tester find bottleneck/frontier hints explaining where decomposition should continue?
4. Can the tester find evidence attached to at least one manufacturer or component?
5. Does any visible label make the product boundary confusing, for example by mixing vacuum suction with gripper architectures or by treating adjacent products as internal routes?

Pass criteria:

- The answer demonstrates click paths, not just page-level text.
- The answer reports any confusing labels, missing evidence, or dead ends.
- The answer checks both English and Simplified Chinese UI labels if practical.

## Scenario D: Extensive Node Interaction Tour

Goal: catch UI breakage by interacting with many nodes, not just the golden path.

Questions / actions:

1. Use the graph page and click through as many visible nodes as practical, including product, modules, components, metrics, bottlenecks/frontiers, organizations, and standards.
2. Expand details where available and inspect the detail rail sections.
3. Try cost, bottleneck-risk, maturity, and relation color modes.
4. Use search if the site exposes it; search for `Nabtesco`, `Inovance`, `Hikrobot`, `Wayzim`, `SICK`, `rare earth`, `precision reducer`, and `total system cost`.
5. Report any node that cannot be selected, any detail panel overflow, any repeated/duplicated section, any misleading upstream/downstream relationship, and any blank or inaccessible state.

Pass criteria:

- The tour records specific node ids or visible node names.
- The tour reports at least ten successful node interactions and any failures.
- The tester's answer is based on browser-visible state only.
