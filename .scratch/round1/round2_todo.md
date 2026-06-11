# Round-2 content-fix backlog (orchestrator notes, 2026-06-10)

Mechanical observations from round-1 assembly — these need CONTENT work (fresh
decomposer/verifier agents), not hand edits.

## Ticker / listing verification (paid-layer accuracy — top priority)
- [ ] Verify EVERY `Public listing` metric across ai_compute_chain orgs against
      IR/exchange sources. Known suspects from spot checks:
      - org_murata listed as `8897.T` — Murata Manufacturing should be `6981.T`.
      - org_samsung_electro_mechanics marked unlisted — SEMCO trades as `009150.KS`.
      - org_eaton marked "US private division" — Eaton Corp plc trades as `ETN` (NYSE).
- [ ] Verify exchange suffixes are consistent (`.T`, `.TW`, `.KS`, bare US symbols).

## Share-claim verification
- [ ] org_philips_lumileds "20% VCSEL share" (optics batch) — Lumileds is an LED
      maker; datacom VCSEL leaders are usually Broadcom/Coherent/Lumentum-class.
      Verify or replace the org + share claim.
- [ ] Power batch: Samsung foundry as power-stage-IC manufacturer — verify the
      foundry-vs-IDM framing for VRM power stages (Renesas/Infineon/MPS landscape).

## Structural overlaps to reconcile
- [ ] `chiplet_interconnect_substrate` + `backplane_substrate_and_routing`
      (optics batch) vs the `substrate_and_interposer` module subtree — same
      suppliers (Ibiden/Nan Ya/Unimicron) may end up modeled twice. Decide:
      cross-link with `requires` or merge nodes; orgs are deduped already.
- [ ] thermal: dropped duplicate `org_shin_etsu` node carried a
      "Global advanced TIM market share" metric + FY2025 sales. Re-attach that
      content to the EXISTING parcel `org_shin_etsu` node (append
      ai_compute_chain to its domain, add the TIM metrics + evidence) — hand
      edit by owner or a scoped agent, since import can't update existing nodes.
- [ ] org zh localization: org nodes currently fall back to latin names in zh
      sidecars (backfilled mechanically at assembly). Proper zh names (e.g.
      康宁/村田) in a later pass.

## Dropped at assembly (deliberate)
- power batch carried 2 research tasks — dropped (tasks queue stays owner-managed).
- Lytron edge: org_lytron kept; verify it still exists as independent company
  (acquired by Boyd 2019?) — possible stale supplier.
- [ ] org_ase listed as `2311.TW` (packaging batch) — post-merger holdco is ASE
      Technology Holding `3711.TW`; verify which the data should carry.
- [ ] packaging batch gave Nan Ya PCB ticker "AUO" (wrong company); alias-merge
      keeps the richer substrate-batch node — confirm the surviving record's
      ticker is `8046.TW`.
- [ ] **logic_die batch evidence is ~15/16 Wikipedia** (grey-list). Replace with
      whitelist sources (company IR, TrendForce/SemiAnalysis-class, trade press)
      before Friday ship. Claims themselves look right; sourcing is below bar.
- [x] (handled at patch-apply time) optics patch wants to SET Lumileds share=8%
      with "inferred" basis — strip the unsourced number, keep confidence:low
      + monitoring note.
- [x] (handled at apply time) logic round-2 batch duplicates existing orgs under
      new ids: org_agc_inc->org_agc, org_hoya_corporation->org_hoya,
      org_samsung_electronics->org_samsung. Fold metrics/evidence into the
      existing ids, retarget edges, drop dup nodes, dedupe (source,rel,target).

## Round-3 normalize checklist (orchestrator)
- [ ] cross-batch org dedupe (org_intelliepi in both optics_upstream & compound_upstream)
- [ ] patch id remap: org_coherent_corp -> org_ii_vi_coherent; org_broadcom_corp -> org_broadcom
- [ ] strip tasks arrays from all round-3 batches (optics_upstream carries 4)
- [ ] ticker spot-checks: JX Advanced Metals "5541.T" suspicious (2025 IPO code likely
      different); org_vpec "2455.TW"? (VPEC is 2455.TW? verify); landmark 3081.TW verify
- [ ] semantic overlap review: inp_gaas_substrate_wafer (optics) vs compound wafer feedstock
      node (compound batch) — keep both if referents distinct, cross-link notes
