# Round-1 consolidation notes — spacex_reusable_launch (2026-06-15)

Orchestrator checklist for folding the 6 breadth batches → one import. Update as lanes return.

## Batches (dry-run status)
- thermal_protection — ✅ green (10n/13e/11ev) — 5 new org
- propellants_gases — ✅ green (6n/14e/8ev) — 3 new org (reused org_linde, org_air_liquide)
- composites_copv — ✅ green (11n/13e/18ev) — 9 new org (reused org_spacex)
- structural_metals — ✅ green (16n/19e/21ev) — 11 new org (+ zh sidecar already written)
- avionics_radhard — ✅ green (18n/22e/19ev/4 tasks) — 12 new org
- actuation_engine_merchant — ⏳ running

## SEMANTIC alias-folds (same company, different id — fold to ONE before import)
- **org_moog_space** (avionics) ⟷ actuation's Moog (TVC actuators) → both are Moog Inc (MOG.A). Fold to one `org_moog`.
- **org_amd**, **org_microchip_technology** (avionics) → CHECK ai_compute_chain.json: AMD/Microchip are very likely already modeled there under variant ids — fold rather than create duplicates.
- **org_ati** (structural) ⟷ actuation's ATI (AM metal powder, if created) → fold.

## Reused cross-domain orgs needing `spacex_reusable_launch` added to their domain[] (linked via edges only by agents)
org_honeywell_aerospace_space, org_te_connectivity, org_amphenol, org_linde, org_air_liquide, org_dupont.
RESOLVED: exposureGate.ts:52-53 filters orgs by `n.domain` tag → reused orgs DO need `spacex_reusable_launch` added (else the paid gate won't treat them as this domain's suppliers). Orgs also tagged a FREE domain (e.g. Amphenol in ai_compute_chain) are correctly NOT hidden (exposureGate.ts:54). supplyConcentration.holdersForNode counts ONLY `manufactured_by`/`implemented_by` edges — the agents' conservative `reported_capable_supplier`/`capacity_provider`/`strategic_supplier_to` edges do NOT count as holders (honest, but concentration signal will read sparse; that's acceptable — exposure mapping value is in the orgs+edges themselves).

## New org ids so far (~28) — check for cross-lane / cross-domain collisions before import
thermal: org_lenzing org_fiber_materials_inc org_sniace org_lockheed_martin org_momentive_performance_materials
propellants: org_air_products org_nippon_sanso_holdings org_messer
composites: org_toray org_hexcel org_teijin org_mitsubishi_chemical org_syensqo org_infinite_composites org_steelhead_composites org_hypercomp_engineering org_gd_ots
structural: org_constellium org_kaiser_aluminum org_arconic org_vsmpo_avisma org_ati org_timet org_osaka_titanium org_toho_titanium org_howmet_aerospace org_precision_castparts org_outokumpu

## Alias-fold rules / cautions (agent-flagged)
- **DO NOT fold** org_mitsubishi_chemical (4188.T) into org_mitsubishi_gas_chemical or org_mitsubishi_electric — distinct companies.
- **Keep distinct** org_arconic + org_howmet_aerospace from existing org_alcoa (both spun from Alcoa).
- **Likely cross-lane dup:** org_ati (structural) may also be created by actuation (AM powder seed named ATI). Fold to ONE; same for any casting/Carpenter overlap.
- **Check** org_lockheed_martin (thermal, LI-900 ref) vs avionics lane (star trackers / Ball-BAE). Fold if dup.
- Subsidiaries with no own listing: org_timet + org_precision_castparts → Berkshire (BRK.B); org_toho_titanium (5727.T) being taken private by org_jx_advanced_metals (Feb 2026) — note on node.

## Evidence scope corrections (apply during consolidation)
- `ev_space_smithsonian_grid_fin` is an **ALUMINUM** grid fin: (a) does NOT support titanium-casting claims (structural lane), (b) does NOT support `falcon9_boostback_entry_landing_burns` (round-0). Narrow its supportsNodeIds to `falcon9_grid_fin_reentry_control` only; apply the repaired verbatim excerpt.

## Round-0 evidence verdicts to apply (from .scratch/spacex-reusable-launch-round-0/verdicts.json)
- 5 verified → set machineCheck verified: ev_space_falcon_users_guide_2025, ev_space_nasa_crew2_reuse, ev_space_spacex_prospectus_2026, ev_space_faa_starship_cadence, ev_space_nasa_orbiter_tps_maintenance
- repaired: ev_space_smithsonian_grid_fin (excerpt + narrow supports), ev_space_rocket_lab_capabilities (re-source → SEC 8-K, sourceStatus fetch_ok)
- 2 SPA escalations → owner review queue + downgrade unverifiable ok_exact: ev_space_spacex_falcon9, ev_space_spacex_starship (spacex.com SPA, machine-unverifiable; re-anchor candidates: Falcon User's Guide / prospectus)

## decomposition_frontier left for round-2 upstream pass
- liquid_methane_lch4_supply (propellants) — no quality producer source found; needs upstream LNG-network pass.

## Captive components (honest, no merchant supplier — do NOT let round-2 invent one)
Falcon 9 fairing fab (Hawthorne autoclave); SpaceX COPV; Starship silica tiles ("bakery"); Falcon 9 Ti grid-fin single-piece casting; engine hot-section Raptor/Merlin (pending actuation lane).

## Gate B/C/D plan (2026-06-15, post-import)
Round-1 imported (ce712ce): 74 nodes incl. 47 orgs / 100 edges / 92 evidence. verify 502/0.
- **Gate B** (running): 6 Opus verify+ticker agents → .scratch/spacex-reusable-launch-verify/<lane>-verdicts.json. Apply ALL together: machineCheck verified, ticker corrections, repairs (velo3d/nikon empty excerpts), collect escalations for owner queue. (propellants done: 8 verified, 1 edge escalation [Linde LOX SpaceX-link secondary-only], 0 ticker errors.)
- **Gate C round-2 (LIGHT, data-driven)**: corners ALREADY flagged in round-1 (titanium_sponge, VSMPO/TIMET, Howmet/PCC duopoly, PICA precursor/preform, SNIACE/FMI, igniter). round-2 = decompose 5 decomposition_frontier nodes (aerospace_carbon_fiber_composite_material, launch_vehicle_copv_pressurant_vessel, helium_pressurant_supply, liquid_methane_lch4_supply, starship_pica_class_ablator) + fill ONLY the suppliers the holdout shows missing.
- **Gate D**: dev-set exposure_recall ~100% but CIRCULAR (breadth agents read the dev set). Real test = sealed holdout (agent a7aeea9, independent answer key at .scratch/spacex-reusable-launch-holdout/answer_key.json). Grade AFTER Gate B + data final: recall = (graph orgs ∩ key)/key. ≥0.65 target. If <0.65 → targeted round-2 on the misses; if ≥0.65 → round-2 is just the 5 frontier decompositions.
- Then zh sidecars (A7, once node set final) + Gate E top-15 owner review queue.
