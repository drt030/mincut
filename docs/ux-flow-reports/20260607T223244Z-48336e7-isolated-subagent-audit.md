# Isolated website audit after supplier exposure pass

Run context:

- Baseline commit: `48336e7 data: expose suppliers for visible hardware frontiers`
- Tested URL: `http://localhost:3003`
- Constraint: subagents were told to inspect the website only. They did not read repository files, local data files, or external websites.
- Purpose: stress-test whether the graph answers investor, startup, and manufacturing-research questions from the product surface alone.

## Subagent A: investor / startup readout

Persona prompts:

- Identify the current top bottleneck for the `low_cost_parcel_sorting_robot_300k_rmb` product.
- Determine whether the site exposes investable manufacturer / supplier exposure.
- Judge whether a startup can find a plausible wedge from the graph.

Findings:

- The site surfaces `parcel_manipulation_or_diverter` as the highest risk bottleneck in the route rail, with roughly `48%` risk.
- Supplier exposure is now visible for priority areas. Examples observed: `ABB Robotics`, `Wayzim`, `Dematic / KION`, and `Honeywell Intelligrated`, with public ticker context where available.
- The user can see system cost p50 around `411,657 RMB`, range `204,000-829,494 RMB`, compared with the `300,000 RMB` target.
- Startup wedge is legible around low-cost real-time vision compute integration, latency budget, no-read recovery, and induction / spacing integration.
- Main weakness: evidence quality is still visibly weak. The site exposes many `unreviewed` claims and does not yet separate reviewed field evidence from candidate exposure strongly enough.

Score: 3 / 5.

## Subagent B: broad click-through usability audit

Persona prompts:

- Click through the graph and detail rail as a first-time technical user.
- Look for contradictions between graph signals, detail panels, and gate views.
- Report the top issues that would mislead a researcher.

Findings:

- Bottleneck semantics were confusing. A node that is itself an upstream bottleneck could show `Bottlenecks 0` in the priority strip, while another view calls it a critical blocker.
- Manufacturer wording was too strong in Chinese. `主要制造商` read as confirmed market-leader coverage, while many edges are still `unreviewed` candidate exposure.
- Cost target treatment is still confusing: the product target is `300,000 RMB`, while the bottom-up p50 is above target and cost-inversion warnings need clearer source-data treatment.
- Root switching works, but long labels can still truncate in some states.
- Some important detail pages are thin: `vision_barcode_label_recognition`, `safety_system`, `mechanical_structure`, and `cost_optimized_hardware_stack`.

Score: 2.5 / 5.

## Controller browser walk

Additional local browser sampling at `http://localhost:3003/graph`:

- Walked 73 visible node focus URLs.
- No browser console warnings or errors were observed during the walk.
- Every visible sampled node had some cost / RMB / p50 signal.
- Nodes still lacking manufacturer or service-candidate exposure in the detail panel included:
  - `low_cost_parcel_sorting_robot_300k_rmb`
  - `vision_model_deployment_optimization`
  - `camera_sdk_frame_acquisition_pipeline`
  - `fanless_compute_thermal_management`
  - `parcel_label_localization`
  - `industrial_barcode_decoding_runtime`
  - `parcel_ocr_model_runtime`
  - `parcel_label_training_dataset`
  - `barcode_ocr_benchmark_metrics`
  - `robot_realtime_control_runtime`
  - `robot_base_installation_alignment_process`
  - `cost_optimized_hardware_stack`

## Fixes selected for this follow-up

- Rename the detail-panel manufacturer section from a potentially confirmed-sounding label to candidate / investable exposure language.
- Split bottleneck role from downstream bottleneck count so a node can show that it is an active blocker without pretending it has zero bottleneck relevance.

## Remaining backlog

- Improve target-vs-rollup cost semantics for the root product and high-cost subsystems.
- Add an evidence-quality graph lens or badge so weak / unreviewed evidence is visible before opening the gate page.
- Continue supplier / implementer exposure for software and runtime nodes.
- Review suspect arm cost data, especially the industrial robot arm body estimate that currently reads too low for the user's domain expectation.
- Tighten long-label behavior around root-switch states.
