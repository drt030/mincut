#!/usr/bin/env python3
"""Incrementally assemble the reducers_screws round-1 batch.
Each block appends to the batch and rewrites the JSON so a hang never loses prior work.
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "reducers_screws.json")
batch = {"nodes": [], "edges": [], "evidence": [], "tasks": []}

def save():
    with open(OUT, "w") as f:
        json.dump(batch, f, ensure_ascii=False, indent=2)

# ---------------------------------------------------------------------------
# BLOCK 1 — Strain-wave reducers: capacity-gating evidence (Harmonic Drive,
# existing org) + Nidec FLEXWAVE (reuse org_nidec) wired to the strain-wave node.
# ---------------------------------------------------------------------------

# Harmonic Drive capacity-gating evidence -> supports existing strain-wave node
# + existing org_humanoid_harmonic_drive_systems. This is the concentration /
# precision-capacity corner: supply added only in fixed multi-year increments.
batch["evidence"].append({
    "id": "ev_humanoid_harmonic_capacity_gating",
    "type": "vendor_claim",
    "title": "Harmonic Drive capacity increase — Ariake Plant",
    "url": "https://www.harmonicdrive.net/about-us/capacity-update",
    "sourceStatus": "fetch_ok",
    "sourceName": "Harmonic Drive LLC (capacity disclosure)",
    "date": "2026-06-15",
    "summary": "Harmonic Drive discloses that strain-wave gearing capacity is raised only in large fixed increments gated by a multi-year capital project (150k to 220k units/month), illustrating that precision strain-wave supply cannot scale quickly as humanoid joint demand surges. Supports the near-single-source/capacity-gating corner on the strain-wave reducer.",
    "supportsNodeIds": ["humanoid_strain_wave_reducer", "org_humanoid_harmonic_drive_systems"],
    "supportsEdgeIds": ["e_humanoid_strain_wave__manufactured_by__hds"],
    "limitations": "Capacity figure is for all strain-wave applications (industrial robots, semiconductor equipment, automotive), not humanoid-specific; does not by itself prove market share. Used as qualitative capacity-gating evidence.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "The capital investment will enable the Ariake Plant (Nagano Prefecture) to increase production capacity of Harmonic Drive® strain wave gearing devices from 150,000 units/month to 220,000 units/month by August 2022.",
})

# Nidec FLEXWAVE — reuse org_nidec (cross-domain id). Add edge + evidence.
batch["edges"].append({
    "id": "e_humanoid_strain_wave__manufactured_by__nidec",
    "source": "humanoid_strain_wave_reducer",
    "target": "org_nidec",
    "relation": "manufactured_by",
    "claim": "Nidec (Nidec Drive Technology) markets its FLEXWAVE strain-wave gear reducers as suited to humanoid-robot joints; modeled as a strain-wave reducer supplier candidate, not a confirmed humanoid BOM claim.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_nidec_flexwave"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_nidec_flexwave",
    "type": "product_page",
    "title": "Highly Developed Humanoid Robots — Nidec Drive Technology",
    "url": "https://www.nidec-dtc.com/humanoid-robots/",
    "sourceStatus": "fetch_ok",
    "sourceName": "Nidec Drive Technology Corporation",
    "date": "2026-06-15",
    "summary": "Nidec Drive Technology markets its Next Generation FLEXWAVE strain-wave gear reducers as the ideal choice for humanoid-robot joint positioning, confirming Nidec as a merchant strain-wave reducer supplier candidate for the humanoid joint stack.",
    "supportsNodeIds": ["humanoid_strain_wave_reducer", "org_nidec"],
    "supportsEdgeIds": ["e_humanoid_strain_wave__manufactured_by__nidec"],
    "limitations": "Vendor application page; supports FLEXWAVE strain-wave reducers as marketed for humanoid joints (reducer exposure), not a confirmed humanoid customer, share, or qualification.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "The Next Generation Nidec FLEXWAVE high precision simple contained assembly and component sub-assembly gear reducers are the ideal choice for these types of applications.",
})

save()
print("block1 saved:", len(batch["nodes"]), "nodes", len(batch["edges"]), "edges", len(batch["evidence"]), "evidence")

# ---------------------------------------------------------------------------
# BLOCK 2 — Planetary roller screws: the Swiss >50% corner.
# GSA (Gewinde Ziegler / GSA AG) + Rollvis (private CH). Component:
# humanoid_planetary_roller_screw (parent humanoid_linear_joint_module).
# ---------------------------------------------------------------------------

# GSA AG / Gewinde Ziegler AG — new humanoid-namespaced org. Private (Swiss AG).
batch["nodes"].append({
    "id": "org_humanoid_gsa",
    "name": "GSA AG / Gewinde Ziegler AG",
    "kind": "organization",
    "domain": ["humanoid_robotics"],
    "description": "Swiss planetary/satellite roller-screw specialist (Gewinde Satelliten Antriebe AG / Gewinde Ziegler AG, est. 1982). Makes the RGTI inverted planetary roller screw widely reported as the type Tesla sources for Optimus linear actuators; modeled as a near-single-source roller-screw supplier candidate for the humanoid linear-joint stack. Privately held.",
    "maturityLabel": "unknown",
    "listingStatus": "private",
    "ticker": "private",
    "confidence": "medium",
    "tags": ["private_company", "supplier_candidate", "single_source_risk"],
    "evidenceIds": ["ev_humanoid_gsa_rgti", "ev_humanoid_gsa_inhouse"],
    "reviewStatus": "unreviewed",
})
batch["edges"].append({
    "id": "e_humanoid_roller_screw__manufactured_by__gsa",
    "source": "humanoid_planetary_roller_screw",
    "target": "org_humanoid_gsa",
    "relation": "manufactured_by",
    "claim": "GSA AG / Gewinde Ziegler AG makes the RGTI inverted planetary roller screw reported as the type Tesla sources for Optimus; modeled as a near-single-source roller-screw supplier candidate, not a confirmed/contracted humanoid BOM claim.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_gsa_rgti", "ev_humanoid_gsa_inhouse"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_gsa_rgti",
    "type": "product_page",
    "title": "RGTI: Inverted Planetary Roller Screw — GSA",
    "url": "https://gsascrews.com/en/portfolio/rollengewindetrieb-rgti/",
    "sourceStatus": "fetch_ok",
    "sourceName": "GSA AG / Gewinde Ziegler AG",
    "date": "2026-06-15",
    "summary": "GSA's RGTI inverted planetary roller screw is described as a high-load, high-positioning-accuracy electromechanical drive integrated in hollow-shaft motors — the configuration used in humanoid linear actuators. Supports GSA as a planetary-roller-screw supplier candidate for the humanoid linear-joint stack.",
    "supportsNodeIds": ["humanoid_planetary_roller_screw", "org_humanoid_gsa"],
    "supportsEdgeIds": ["e_humanoid_roller_screw__manufactured_by__gsa"],
    "limitations": "Vendor product page; supports the RGTI roller-screw design and hollow-shaft-motor integration. Does not itself confirm the Tesla Optimus contract, volumes, or market share.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "The RGTI is mainly integrated as an electromechanical drive in hollow shaft motors. It offers a compact electromechanical alternative to hydraulic and pneumatic lifting and linear drives.",
})
batch["evidence"].append({
    "id": "ev_humanoid_gsa_inhouse",
    "type": "vendor_claim",
    "title": "GSA — Planetary Roller Screws (company)",
    "url": "https://gsascrews.com/en/",
    "sourceStatus": "fetch_ok",
    "sourceName": "GSA AG / Gewinde Ziegler AG",
    "date": "2026-06-15",
    "summary": "GSA states all roller-screw components are manufactured and assembled in-house at GSA AG / Gewinde Ziegler AG (Switzerland), confirming a vertically integrated Swiss roller-screw specialist — one of the two firms behind the Swiss concentration of high-precision planetary roller screws.",
    "supportsNodeIds": ["org_humanoid_gsa", "humanoid_planetary_roller_screw"],
    "supportsEdgeIds": ["e_humanoid_roller_screw__manufactured_by__gsa"],
    "limitations": "Establishes Swiss in-house manufacturing and company identity; does not quantify share. The >50% combined Swiss share is carried qualitatively in the roller-screw corner note.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "All components are manufactured and assembled in-house at GSA AG / Gewinde Ziegler AG.",
})

# Rollvis SA — new humanoid-namespaced org. Private (Geneva, since 1970).
batch["nodes"].append({
    "id": "org_humanoid_rollvis",
    "name": "Rollvis SA",
    "kind": "organization",
    "domain": ["humanoid_robotics"],
    "description": "Swiss (Geneva, est. 1970) satellite/planetary roller-screw specialist trading as 'Rollvis Swiss'; self-described world leader in satellite roller screws. Together with GSA, frequently cited as holding the majority of the high-precision planetary roller-screw world market — the Swiss near-single-source corner feeding humanoid linear actuators. Privately held.",
    "maturityLabel": "unknown",
    "listingStatus": "private",
    "ticker": "private",
    "confidence": "medium",
    "tags": ["private_company", "supplier_candidate", "single_source_risk"],
    "evidenceIds": ["ev_humanoid_rollvis_identity"],
    "reviewStatus": "unreviewed",
})
batch["edges"].append({
    "id": "e_humanoid_roller_screw__manufactured_by__rollvis",
    "source": "humanoid_planetary_roller_screw",
    "target": "org_humanoid_rollvis",
    "relation": "manufactured_by",
    "claim": "Rollvis SA is a Swiss world-leading satellite/planetary roller-screw maker; modeled as a roller-screw supplier candidate for humanoid linear actuators, not a confirmed humanoid BOM claim.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_rollvis_identity"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_rollvis_identity",
    "type": "vendor_claim",
    "title": "Rollvis SA — About Us",
    "url": "https://rollvis.com/about-us/",
    "sourceStatus": "fetch_ok",
    "sourceName": "Rollvis SA",
    "date": "2026-06-15",
    "summary": "Rollvis SA (Geneva, founded 1970) self-describes as a world leader in the design and production of satellite roller screws for high-precision linear motion — one of the two Swiss firms behind the concentration of high-precision planetary roller-screw supply for humanoid linear actuators.",
    "supportsNodeIds": ["org_humanoid_rollvis", "humanoid_planetary_roller_screw"],
    "supportsEdgeIds": ["e_humanoid_roller_screw__manufactured_by__rollvis"],
    "limitations": "Vendor about-page; establishes Swiss world-leader identity and roller-screw specialism, not a specific humanoid customer or quantified share.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "ROLLVIS SA is a world leader in the design and production of Satellite Roller screws.",
})

# Roller-screw scarcity / specialized-expertise corner -> on the component node.
batch["evidence"].append({
    "id": "ev_humanoid_roller_screw_scarcity",
    "type": "news",
    "title": "China's grip on the humanoid robot future — roller-screw supply",
    "url": "https://interestingengineering.com/innovation/china-grip-on-humanoid-robot-future",
    "sourceStatus": "fetch_ok",
    "sourceName": "Interesting Engineering",
    "date": "2026-06-15",
    "summary": "Reports that planetary-roller-screw adoption is constrained by limited supply and high production cost rooted in the specialized manufacturing expertise required — the binding scarcity constraint on humanoid linear-actuator scale-up. Supports the single/near-single-source corner on the roller-screw component.",
    "supportsNodeIds": ["humanoid_planetary_roller_screw"],
    "supportsEdgeIds": [],
    "limitations": "Trade-press synthesis, not a primary capacity disclosure; qualitative scarcity/expertise claim, no single firm's share quantified.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "Currently, both ball and planetary roller screws are used for humanoids, but this is largely due to the limited supply and cost of planetary roller screws ... the widespread adoption of planetary roller screws has been constrained by their high production cost, which can be primarily attributed to the specialized manufacturing expertise required",
})

save()
print("block2 saved:", len(batch["nodes"]), "nodes", len(batch["edges"]), "edges", len(batch["evidence"]), "evidence")

# ---------------------------------------------------------------------------
# BLOCK 3 — Ewellix roller screws -> now owned by Schaeffler (reuse org_schaeffler).
# Plus the UPSTREAM thread-grinding / ultra-precision CNC grinding equipment node
# (new) under the roller-screw component, with Drake + PTG Holroyd as suppliers.
# ---------------------------------------------------------------------------

# Ewellix roller screws -> Schaeffler (existing cross-domain org, SHA.DE).
batch["edges"].append({
    "id": "e_humanoid_roller_screw__manufactured_by__schaeffler",
    "source": "humanoid_planetary_roller_screw",
    "target": "org_schaeffler",
    "relation": "manufactured_by",
    "claim": "Schaeffler AG makes roller screws via its Ewellix linear-motion business (acquired from Triton in 2023); modeled as a planetary-roller-screw supplier candidate for the humanoid linear-joint stack, not a confirmed humanoid BOM claim.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_ewellix_schaeffler", "ev_humanoid_ewellix_rollerscrew"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_ewellix_schaeffler",
    "type": "vendor_claim",
    "title": "Triton completes sale of Ewellix to Schaeffler AG",
    "url": "https://www.triton-partners.com/news/triton-completes-sale-of-ewellix",
    "sourceStatus": "fetch_ok",
    "sourceName": "Triton Partners",
    "date": "2026-06-15",
    "summary": "Confirms Ewellix — a global manufacturer of linear motion and actuation solutions (incl. roller screws) — is now owned by Schaeffler AG (sale completed 2023). This is why humanoid roller-screw exposure via Ewellix maps to org_schaeffler, the same group already flagged as a >50% preferred actuator supplier.",
    "supportsNodeIds": ["org_schaeffler", "humanoid_planetary_roller_screw"],
    "supportsEdgeIds": ["e_humanoid_roller_screw__manufactured_by__schaeffler"],
    "limitations": "Confirms ownership and that Ewellix makes linear motion/actuation solutions; does not by itself quantify roller-screw share or a humanoid customer.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "Triton Fund V advised by Triton Partners (\"Triton\"), has completed the sale of Ewellix (\"Ewellix\"), a global innovator and manufacturer of linear motion and actuation solutions, to Schaeffler AG",
})
batch["evidence"].append({
    "id": "ev_humanoid_ewellix_rollerscrew",
    "type": "vendor_claim",
    "title": "Ewellix — global manufacturer of actuation and linear motion solutions",
    "url": "https://www.triton-partners.com/news/triton-completes-sale-of-ewellix",
    "sourceStatus": "fetch_ok",
    "sourceName": "Triton Partners",
    "date": "2026-06-15",
    "summary": "Independent corporate description of Ewellix as a global innovator and manufacturer of actuation and linear motion solutions (its product line includes planetary/roller screws), supporting Ewellix/Schaeffler as a merchant roller-screw supplier candidate.",
    "supportsNodeIds": ["org_schaeffler", "humanoid_planetary_roller_screw"],
    "supportsEdgeIds": ["e_humanoid_roller_screw__manufactured_by__schaeffler"],
    "limitations": "Describes Ewellix at the corporate level (actuation/linear motion); the specific roller-screw product line is named in Ewellix's own catalogue (vendor pages 403-blocked this round).",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "Ewellix is a global innovator and manufacturer of actuation and linear motion solutions.",
})

# UPSTREAM: Thread-grinding / ultra-precision CNC grinding equipment (NEW node)
# under the roller-screw component. This is the equipment bottleneck behind the
# Swiss roller-screw corner (sub-3-micron internal-thread grinding).
batch["nodes"].append({
    "id": "humanoid_thread_grinding_equipment",
    "name": "Thread-grinding / ultra-precision CNC grinding equipment",
    "kind": "equipment",
    "domain": ["humanoid_robotics"],
    "description": "Ultra-precision CNC thread-grinding machines that cut the sub-3-micron-tolerance internal and external threads of planetary roller screws (and ball screws). This is the upstream capital-equipment bottleneck behind the Swiss roller-screw corner: the specialized internal-thread grinding expertise and the thin population of qualified grinder builders gate how fast roller-screw capacity can be added for humanoid linear actuators.",
    "maturityScore": 55,
    "maturityLabel": "commercially_available",
    "maturityAsOf": "2026-06",
    "confidence": "medium",
    "capacityLeadTimeMonths": 18,
    "tags": ["equipment", "bottleneck", "constraint_capacity_scale", "constraint_technical_maturity", "decomposition_frontier"],
    "bottleneckOf": ["humanoid_planetary_roller_screw"],
    "evidenceIds": ["ev_humanoid_drake_thread_grinder", "ev_humanoid_holroyd_thread_grinder"],
    "reviewStatus": "unreviewed",
})
batch["edges"].append({
    "id": "e_humanoid_roller_screw__requires__thread_grinding",
    "source": "humanoid_planetary_roller_screw",
    "target": "humanoid_thread_grinding_equipment",
    "relation": "requires",
    "claim": "Planetary roller-screw production depends on ultra-precision CNC thread-grinding equipment (sub-3-micron internal/external thread grinding); the grinder supply and grinding expertise are the upstream bottleneck.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_drake_thread_grinder"],
    "reviewStatus": "unreviewed",
})

# Drake Manufacturing — new org (US, private). Thread/ballscrew grinders.
batch["nodes"].append({
    "id": "org_humanoid_drake_manufacturing",
    "name": "Drake Manufacturing Services",
    "kind": "organization",
    "domain": ["humanoid_robotics"],
    "description": "US (Warren, Ohio) builder of precision CNC thread- and gear-grinding machines, including internal thread grinders and ball-nut/ballscrew grinders for the ball-screw and linear-motion industries — the upstream grinding-equipment tier behind roller/ball-screw production. Privately held.",
    "maturityLabel": "unknown",
    "listingStatus": "private",
    "ticker": "private",
    "confidence": "medium",
    "tags": ["private_company", "supplier_candidate", "upstream_equipment"],
    "evidenceIds": ["ev_humanoid_drake_thread_grinder"],
    "reviewStatus": "unreviewed",
})
batch["edges"].append({
    "id": "e_humanoid_thread_grinding__manufactured_by__drake",
    "source": "humanoid_thread_grinding_equipment",
    "target": "org_humanoid_drake_manufacturing",
    "relation": "manufactured_by",
    "claim": "Drake Manufacturing builds CNC internal thread grinders and ball-nut/ballscrew grinders for the ball-screw and linear-motion industries; modeled as an upstream thread-grinding equipment supplier candidate.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_drake_thread_grinder"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_drake_thread_grinder",
    "type": "vendor_claim",
    "title": "Drake Manufacturing Services — CNC thread/ballscrew grinders",
    "url": "https://gearsolutions.com/company-profile/company-profile-drake-manufacturing-services-co/",
    "sourceStatus": "fetch_ok",
    "sourceName": "Gear Solutions (company profile)",
    "date": "2026-06-15",
    "summary": "Drake (Warren, Ohio) builds CNC thread and gear grinders — including internal thread grinders and ball-nut/ballscrew grinders — for the ball-screw and linear-motion industries, the upstream grinding equipment behind roller/ball-screw thread production.",
    "supportsNodeIds": ["humanoid_thread_grinding_equipment", "org_humanoid_drake_manufacturing"],
    "supportsEdgeIds": ["e_humanoid_thread_grinding__manufactured_by__drake", "e_humanoid_roller_screw__requires__thread_grinding"],
    "limitations": "Confirms Drake makes thread/ballscrew grinders for ball-screw/linear-motion; the page names ball-nut/ballscrew grinders (not planetary-roller-screw grinders by name). Roller-screw applicability inferred from shared internal-thread-grinding requirement.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "Drake's thread and gear manufacturing solutions include rack mills, profile gear grinders, worm and thread grinders, internal thread grinders, and ball nut and ballscrew grinders.",
})

# PTG Holroyd — new org (UK, private). High-precision screw/thread grinding.
batch["nodes"].append({
    "id": "org_humanoid_ptg_holroyd",
    "name": "PTG Holroyd",
    "kind": "organization",
    "domain": ["humanoid_robotics"],
    "description": "UK builder of high-precision gear, rotor, screw and thread milling and grinding machines, marketed as producing the world's most accurate helical components — part of the thin population of ultra-precision thread/screw grinder builders upstream of roller-screw production. Part of the Precision Technologies Group; privately held.",
    "maturityLabel": "unknown",
    "listingStatus": "private",
    "ticker": "private",
    "confidence": "medium",
    "tags": ["private_company", "supplier_candidate", "upstream_equipment"],
    "evidenceIds": ["ev_humanoid_holroyd_thread_grinder"],
    "reviewStatus": "unreviewed",
})
batch["edges"].append({
    "id": "e_humanoid_thread_grinding__manufactured_by__holroyd",
    "source": "humanoid_thread_grinding_equipment",
    "target": "org_humanoid_ptg_holroyd",
    "relation": "manufactured_by",
    "claim": "PTG Holroyd builds high-precision screw and thread grinding machines (world's most accurate helical components); modeled as an upstream thread-grinding equipment supplier candidate.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_holroyd_thread_grinder"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_holroyd_thread_grinder",
    "type": "product_page",
    "title": "PTG Holroyd — gear, rotor, thread and screw grinding machines",
    "url": "https://www.holroyd.com/",
    "sourceStatus": "fetch_ok",
    "sourceName": "PTG Holroyd",
    "date": "2026-06-15",
    "summary": "PTG Holroyd states its gear, rotor, thread and pump-screw milling and grinding machines produce the world's most accurate helical components — evidence for the ultra-precision thread/screw grinding equipment tier upstream of roller-screw thread production.",
    "supportsNodeIds": ["humanoid_thread_grinding_equipment", "org_humanoid_ptg_holroyd"],
    "supportsEdgeIds": ["e_humanoid_thread_grinding__manufactured_by__holroyd"],
    "limitations": "Vendor claim ('world's most accurate helical components'); supports Holroyd as a high-precision screw/thread grinder builder, not a quantified share or a specific roller-screw customer.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "PTG Holroyd's gear, rotor, thread and pump-screw milling and grinding machines produce the world's most accurate helical components.",
})

save()
print("block3 saved:", len(batch["nodes"]), "nodes", len(batch["edges"]), "edges", len(batch["evidence"]), "evidence")

# ---------------------------------------------------------------------------
# BLOCK 4 — Strain-wave reducers: fifth supplier, Shenzhen Han's Motion
# (now PICEA Motion). Chinese harmonic-reducer maker, the domestic-substitution
# data point. Wired to humanoid_strain_wave_reducer.
# ---------------------------------------------------------------------------
batch["nodes"].append({
    "id": "org_humanoid_picea_motion",
    "name": "Shenzhen PICEA Motion (formerly Han's Motion)",
    "kind": "organization",
    "domain": ["humanoid_robotics"],
    "description": "Shenzhen-based precision harmonic-drive / strain-wave reducer maker, formerly Shenzhen Han's Motion Technology Co., Ltd., rebranded to PICEA Motion. Cited among the global key manufacturers of humanoid-robot harmonic reducers and a Chinese domestic-substitution alternative to Harmonic Drive/Nabtesco. Privately held (some trade sources describe it as a former Han's Laser subsidiary; the company's own site presents it independently).",
    "maturityLabel": "unknown",
    "listingStatus": "private",
    "ticker": "private",
    "confidence": "medium",
    "tags": ["private_company", "supplier_candidate"],
    "evidenceIds": ["ev_humanoid_picea_profile", "ev_humanoid_picea_humanoid"],
    "reviewStatus": "unreviewed",
})
batch["edges"].append({
    "id": "e_humanoid_strain_wave__manufactured_by__picea",
    "source": "humanoid_strain_wave_reducer",
    "target": "org_humanoid_picea_motion",
    "relation": "manufactured_by",
    "claim": "Shenzhen PICEA Motion (formerly Han's Motion) makes precision harmonic-drive / strain-wave reducers marketed for humanoid-robot joints; modeled as a strain-wave reducer supplier candidate, not a confirmed humanoid BOM claim.",
    "confidence": "medium",
    "evidenceIds": ["ev_humanoid_picea_profile", "ev_humanoid_picea_humanoid"],
    "reviewStatus": "unreviewed",
})
batch["evidence"].append({
    "id": "ev_humanoid_picea_profile",
    "type": "vendor_claim",
    "title": "Shenzhen PICEA Motion (formerly Han's Motion) — company profile",
    "url": "https://www.piceamotiondrive.com/hans-motion-company-profile/",
    "sourceStatus": "fetch_ok",
    "sourceName": "Shenzhen PICEA Motion Technology Co., Ltd",
    "date": "2026-06-15",
    "summary": "Company self-identifies as Shenzhen PICEA Motion (formerly Shenzhen Han's Motion Technology Co., Ltd.) specializing in R&D, design, manufacturing and sales of precision harmonic drives — confirming the entity behind the 'Han's Motion' name and its strain-wave reducer business.",
    "supportsNodeIds": ["org_humanoid_picea_motion"],
    "supportsEdgeIds": ["e_humanoid_strain_wave__manufactured_by__picea"],
    "limitations": "Establishes identity (incl. the Han's Motion -> PICEA rebrand) and harmonic-drive specialism; does not quantify share or confirm a specific humanoid customer.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "SHENZHEN PICEA MOTION TECHNOLOGY CO., LTD (PICEA MOTION, formerly known as Shenzhen Han's Motion Technology Co., Ltd.)",
})
batch["evidence"].append({
    "id": "ev_humanoid_picea_humanoid",
    "type": "product_page",
    "title": "Harmonic Reducer: Stable Gear for Humanoid Robots — PICEA Motion",
    "url": "https://www.piceamotiondrive.com/harmonic-reducer-stable-gear-for-humanoid-robots.html",
    "sourceStatus": "fetch_ok",
    "sourceName": "Shenzhen PICEA Motion Technology Co., Ltd",
    "date": "2026-06-15",
    "summary": "PICEA Motion markets harmonic reducers as the gear for humanoid-robot light-load joints, stating 14 harmonic drives are needed per humanoid robot — supporting PICEA/Han's Motion as a strain-wave reducer supplier candidate for the humanoid joint stack and giving a per-robot reducer-content figure.",
    "supportsNodeIds": ["org_humanoid_picea_motion", "humanoid_strain_wave_reducer"],
    "supportsEdgeIds": ["e_humanoid_strain_wave__manufactured_by__picea"],
    "limitations": "Vendor application page; the '14 harmonic drives per humanoid robot' figure is a vendor design estimate, not an audited BOM; does not confirm a specific named customer or share.",
    "confidence": "medium",
    "reviewStatus": "unreviewed",
    "excerpt": "Light load joints in humanoid robots mainly require harmonic drives, with 14 harmonic drives needed for each humanoid robot.",
})

# ---------------------------------------------------------------------------
# TASKS — corners, captive notes, and targets not cleanly sourced this round.
# ---------------------------------------------------------------------------
CREATED = "2026-06-15"
batch["tasks"].extend([
    {
        "id": "task_humanoid_roller_screw_swiss_corner",
        "title": "Quantify the Swiss planetary-roller-screw >50% corner with a primary/quality source",
        "priority": "high",
        "status": "pending",
        "createdAt": CREATED,
        "targetNodeId": "humanoid_planetary_roller_screw",
        "reason": "Multiple trade/vendor sources state GSA + Rollvis (both Swiss, private) together hold >50% of the high-precision planetary roller-screw world market, and that Tesla Optimus sources GSA's RGTI 12.8 inverted roller screw. This round captured GSA and Rollvis company/product identity from their own sites (fetch_ok) but the specific >50% share and the Tesla->GSA sourcing came only from SEO/vendor blogs (screw-tech, kggfa). NEAR-SINGLE-SOURCE CORNER (relates org_humanoid_gsa + org_humanoid_rollvis): needs one primary or two independent quality sources before any >50% / 'Tesla sources GSA' number is asserted. Until then the corner is carried qualitatively on the component node.",
    },
    {
        "id": "task_humanoid_thread_grinding_corner",
        "title": "Tie thread-grinding equipment bottleneck to roller-screw scale-up with quantified evidence",
        "priority": "medium",
        "status": "pending",
        "createdAt": CREATED,
        "targetNodeId": "humanoid_thread_grinding_equipment",
        "reason": "Roller-screw threads need sub-3-micron tolerance ultra-precision CNC grinding; reported five-axis grinders >$1.2M and ~18-month custom planetary-thread-grinder backlogs (interestingengineering/roboticstomorrow secondary). Drake (US, org_humanoid_drake_manufacturing) and PTG Holroyd (UK, org_humanoid_ptg_holroyd) confirmed as thread/ballscrew grinder builders from primary/quality pages, but neither page names planetary-roller-screw grinders specifically or quantifies lead time. Also check Kapp Niles (DE), Matrix/Holroyd, and Reishauer for internal-thread roller-screw grinding capability + lead-time disclosure.",
    },
    {
        "id": "task_humanoid_roller_screw_thk_nsk",
        "title": "Source THK and NSK roller/ball-screw humanoid exposure with clean verbatim",
        "priority": "medium",
        "status": "pending",
        "createdAt": CREATED,
        "targetNodeId": "humanoid_planetary_roller_screw",
        "reason": "TARGETS NOT SOURCED THIS ROUND: THK (6481.T, reuse org_thk) and NSK (6471.T, reuse org_nsk) were named in the dispatch but thk.com / nsk product pages returned HTTP 403 to WebFetch and no clean fetchable page confirmed a *planetary roller screw* product (both are primarily ball-screw / linear-guide makers; planetary roller screws are GSA/Rollvis/Ewellix territory). Honest miss rather than a guessed edge. Re-attempt with an authenticated/browser fetch; if confirmed, wire via reuse of existing org_thk / org_nsk. Roller-screw component is already covered by GSA + Rollvis + Ewellix(Schaeffler) (3 suppliers) plus the scarcity corner.",
    },
    {
        "id": "task_humanoid_reducer_concentration_quantify",
        "title": "Quantify Harmonic Drive + Nabtesco strain-wave concentration share",
        "priority": "medium",
        "status": "pending",
        "createdAt": CREATED,
        "targetNodeId": "humanoid_strain_wave_reducer",
        "reason": "Harmonic Drive capacity-gating captured from primary (150k->220k units/month, fixed multi-year increments). The Harmonic Drive (org_humanoid_harmonic_drive_systems) + Nabtesco (org_humanoid_nabtesco) duopoly concentration in high-end strain-wave reducers is widely reported but not yet attached with a sourced share %. Find an IFR / interact-analysis / TrendForce-class share figure for strain-wave reducer concentration. Chinese challengers now modeled: Leaderdrive (688017.SS), PICEA/Han's Motion (private). Note Nidec FLEXWAVE (org_nidec) as the third merchant Japanese alternative.",
    },
])

save()
print("FINAL saved:", len(batch["nodes"]), "nodes", len(batch["edges"]), "edges", len(batch["evidence"]), "evidence", len(batch["tasks"]), "tasks")
