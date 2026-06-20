import fs from "node:fs";

const NODES_PATH = "data/nodes/humanoid_robotics.json";
const EDGES_PATH = "data/edges/humanoid_robotics_edges.json";

const AS_OF = "2026-06";

// Helper to build a node with the repo's conventional field ordering.
function node({ id, name, kind, description, maturityScore, maturityLabel, confidence, tags, bottleneckOf, notes }) {
  const n = {
    id,
    name,
    kind,
    domain: ["humanoid_robotics"],
    description,
    maturityScore,
    maturityLabel,
    maturityAsOf: AS_OF,
    confidence,
  };
  if (tags) n.tags = tags;
  if (bottleneckOf) n.bottleneckOf = bottleneckOf;
  if (notes) n.notes = notes;
  n.reviewStatus = "unreviewed";
  return n;
}

function edge({ id, source, target, relation = "requires", claim, confidence }) {
  const e = { id, source, target, relation };
  if (claim) e.claim = claim;
  e.confidence = confidence ?? "medium";
  e.reviewStatus = "unreviewed";
  return e;
}

const newNodes = [
  // ---------- H1: harmonic / strain-wave reducer internals ----------
  node({
    id: "humanoid_reducer_flexspline",
    name: "Flexspline (thin-wall flexible gear cup)",
    kind: "product",
    description:
      "Deformable thin-wall cylindrical steel cup with external teeth that flexes under the wave generator; the highest-fatigue, hardest-to-make member of a strain-wave (harmonic) reducer. Made from precision-forged and heat-treated maraging or alloy steel, then gear-cut and ground. Industry basis: Harmonic Drive AG defines the strain-wave gear as exactly three parts (wave generator, flexspline, circular spline); flexspline fatigue life is the gear's life-limiter and the manufacturing bottleneck targeted by multiple flexspline-fabrication patents (e.g. metal AM, bulk-metallic-glass routes).",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["reducer", "actuation", "hard_to_develop"],
    notes:
      "Hard to develop: the flexspline endures billions of flex cycles, so its fatigue strength sets the whole reducer's service life. Precision forging/heat-treat plus matched gear grinding of a thin-wall cup is the gating manufacturing step and the subject of active patent activity. Likely citable source: harmonicdrive.de strain-wave-gear technology page; USPTO US11839927 'Methods for fabricating strain wave gear flexsplines'. Qualitative only this pass (no quantified fatigue-life claim).",
  }),
  node({
    id: "humanoid_reducer_circular_spline",
    name: "Circular spline (rigid internal ring gear)",
    kind: "product",
    description:
      "Rigid outer ring with internal teeth (two more teeth than the flexspline) that meshes with the deformed flexspline; a precision gear-hobbed and ground hardened-steel ring. Industry basis: second of the three canonical strain-wave members (Harmonic Drive AG glossary); the tooth-count differential of two versus the flexspline sets the reduction ratio and requires matched precision gear grinding with the flexspline.",
    maturityScore: 62,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["reducer", "actuation"],
  }),
  node({
    id: "humanoid_reducer_wave_generator",
    name: "Wave generator (elliptical cam + flex bearing)",
    kind: "product",
    description:
      "Elliptical steel cam fitted with a thin, elliptically deformable ball bearing that imposes the travelling deflection wave on the flexspline; combines a centric cam plug and a specialty deformable bearing. Industry basis: third canonical strain-wave member (Harmonic Drive AG describes it as 'a centric hub and a special thin, elliptically deformable ball bearing'); the flex (deformable) bearing is itself a specialty item that few makers produce.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["reducer", "actuation", "hard_to_develop"],
    notes:
      "Hard to develop: the elliptically deformable thin-section ball bearing on the wave generator is a specialty bearing few suppliers can make, and it is a wear/life driver for the reducer. Likely citable source: harmonicdrive.de strain-wave-gear technology page; Sumitomo Drive strain-wave gearboxes. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_cross_roller_bearing",
    name: "Output cross-roller bearing (thin-section)",
    kind: "product",
    description:
      "Single-row crossed-roller bearing that carries the joint's combined moment, radial, and axial load in a slim envelope, integrated into the harmonic-drive output or the joint housing. RA-series thin-section sizes are the documented humanoid hip/shoulder parts. Industry basis: industrial robot joints primarily use cross-roller bearings for high stiffness under multi-axis loads; the qualified maker set is concentrated (THK, IKO, Schaeffler/INA, plus the harmonic drive's integrated bearing), which under ADR-0005 makes it a concentration-override decomposition-eligible component.",
    maturityScore: 64,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["bearing", "actuation", "hard_to_develop"],
    notes:
      "Hard to develop: a thin-section crossed-roller bearing must hold high moment stiffness and low cross-axis play in a slim ring; qualification is concentrated among a few specialty bearing makers. Likely citable source: 2026 robotic-joint bearing guides citing RA5008/RA10008 for humanoid shoulder/hip joints; THK/IKO crossed-roller catalogs. Verify the specific RA-size humanoid claim and maker concentration in the later evidence pass. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_bearing_steel_feedstock",
    name: "High-cleanliness bearing steel (100Cr6 / GCr15)",
    kind: "material",
    description:
      "Through-hardening chromium bearing steel (DIN 100Cr6 / GB GCr15 / AISI 52100) with controlled oxygen and inclusion cleanliness; feedstock for cross-roller bearings, the wave-generator flex bearing, and roller-screw rollers. Industry basis: 100Cr6/GCr15/52100 is the standard precision-bearing steel and bearing fatigue life scales with steel cleanliness (vacuum-degassed / VIM-VAR grades), so premium-clean bearing steel is supplied by a short list of specialty mills, making it a supply-concentrated feedstock chokepoint.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck' so it renders as a real feedstock node: premium-clean bearing steel cleanliness gates bearing/roller fatigue life and is a short-list specialty-mill supply. Parented under the reducer (depth 4) and reused by the roller-screw rollers; deliberately NOT parented under the flexspline (that would push it past the depth-4 render budget). Likely citable source: ISO 683-17 bearing steels; specialty-steel cleanliness datasheets (e.g. Ovako / Proterial). Qualitative only this pass.",
  }),

  // ---------- H2: planetary roller-screw internals ----------
  node({
    id: "humanoid_roller_screw_threaded_shaft",
    name: "Roller-screw threaded shaft (central screw)",
    kind: "product",
    description:
      "Central screw with a precision multi-start thread that the planetary rollers ride; the precision-ground core of a planetary roller screw. Industry basis: patent and vendor decomposition describe a planetary roller screw as 'a screw with an outer thread, a nut, and a plurality of longitudinal rollers'; dedicated thread-grinding machines (e.g. EMAG WPG) are marketed specifically for roller-screw shafts with the highest precision requirements for humanoid-robot linear actuators.",
    maturityScore: 48,
    maturityLabel: "early_deployment",
    confidence: "medium",
    tags: ["screw", "actuation", "hard_to_develop"],
    notes:
      "Hard to develop: the multi-start shaft thread must be ground to sub-micron-class tolerance and matched to the rollers and nut; thread-grinding capacity is the upstream gate (existing thread_grinding_equipment node). Likely citable source: EMAG planetary-roller-screw grinding (WPG 7); USPTO US11994191 'Planetary roller screw'. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_roller_screw_rollers",
    name: "Planetary rollers (single-start grooved rollers)",
    kind: "product",
    description:
      "Set of threaded rollers between screw and nut with a convex single-start profile that multiplies contact points for high force density; precision-ground and profile-matched to the nut thread. Industry basis: roller threads must have a consistent convex profile with an angle matching the nut thread to distribute contact stress; roller grinding is the hardest step and gates output volume for roller-screw makers.",
    maturityScore: 46,
    maturityLabel: "early_deployment",
    confidence: "medium",
    tags: ["screw", "actuation", "hard_to_develop"],
    notes:
      "Hard to develop: grinding a consistent convex single-start roller profile at volume is the throughput-limiting step in roller-screw production. Rollers are 52100-class bearing steel (reuses the bearing-steel feedstock). Likely citable source: linearmotiontips.com roller-screw performance; USPTO US11994191. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_roller_screw_nut",
    name: "Roller-screw nut (internal-thread + ring gears)",
    kind: "product",
    description:
      "Coaxial nut with an internal multi-start thread and integrated ring gears that time the rollers; precision-machined hardened steel, often with an internal gear ring and a retainer/cage. Industry basis: roller-screw assemblies are described as 'a nut mounted coaxially around the screw with an inner thread' plus 'an internal gear ring and a retainer or cage'; integrated-ring-gear roller-screw manufacture is covered by patent (e.g. US10041573).",
    maturityScore: 47,
    maturityLabel: "early_deployment",
    confidence: "medium",
    tags: ["screw", "actuation"],
  }),

  // ---------- H3: dexterous-hand actuation cell ----------
  node({
    id: "humanoid_hand_hollow_cup_motor",
    name: "Coreless / hollow-cup micro motor",
    kind: "equipment",
    description:
      "Small coreless (ironless-rotor) brushed or slotless BLDC motor that drives one hand degree of freedom, chosen for low inertia and high acceleration in a forearm-mounted actuator pack. Industry basis: the 2025-2026 Tesla Optimus Gen-3 hand uses a hollow-cup-motor + lead-screw + rope-drive scheme with roughly a dozen-plus coreless/slotless motors per hand and actuators relocated to the forearm; maxon and Shenzhen PICEA Motion are named coreless-motor suppliers.",
    maturityScore: 44,
    maturityLabel: "early_deployment",
    confidence: "low",
    tags: ["hand", "actuation", "motor"],
    notes:
      "Architecture-level claim grounded in 2025-2026 Optimus Gen-3 hand-redesign coverage; exact per-hand motor counts kept qualitative (cited as a range, not asserted as fact). Likely citable source: robottoday.com Optimus hand redesign (hollow cup + lead screw + rope); foxtechrobotics.com dexterous-hand insight. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_hand_micro_leadscrew",
    name: "Hand micro lead-screw / ball-screw drive",
    kind: "equipment",
    description:
      "Miniature lead or ball screw that converts the hollow-cup motor's rotation into the linear pull on a finger tendon; the rotary-to-linear stage of each finger drive. Industry basis: Optimus Gen-3 hand reporting describes motor rotation converted into linear motion through a screw that then pulls the tendon connected to the finger bones, with the hand likely adopting a gearbox + lead-screw + tendon drive.",
    maturityScore: 40,
    maturityLabel: "prototype",
    confidence: "low",
    tags: ["hand", "actuation", "screw", "hard_to_develop"],
    notes:
      "Hard to develop: packaging a precision miniature lead/ball screw at fingertip scale with adequate life is an active design frontier; reuses precision-screw know-how. Likely citable source: robottoday.com Optimus hand redesign; optimusk.blog Optimus hardware specs. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_fingertip_tactile_element",
    name: "Fingertip tactile sensing element (MEMS / magnetic / visuotactile)",
    kind: "equipment",
    description:
      "The transducer inside the fingertip tactile array - a MEMS barometric/capacitive die, a magnetic (Hall) tactile cell, or a camera-based visuotactile module - that converts contact force and slip into signals. Industry basis: tactile fingertip sensors provide the force-feedback hardware in each fingertip and tactile sensing is a named critical enabler for dexterous manipulation; suppliers in graph include PaXini, XELA Robotics (tactile), and TE Connectivity (force).",
    maturityScore: 36,
    maturityLabel: "prototype",
    confidence: "medium",
    tags: ["tactile", "hand", "sensing", "hard_to_develop"],
    notes:
      "Hard to develop: durable, high-density, low-drift fingertip tactile transduction (whether MEMS, magnetic, or visuotactile) is one of the least-mature dexterous-manipulation enablers. Likely citable source: foxtechrobotics.com dexterous-hand sensing; arXiv Bowden-cable hand work. Qualitative only this pass.",
  }),

  // ---------- H4: Li-ion cell materials + BMS AFE ----------
  node({
    id: "humanoid_cell_cathode_active_material",
    name: "Cathode active material (high-nickel NMC)",
    kind: "material",
    description:
      "Nickel-rich layered-oxide (NMC, e.g. ~8:1:1 Ni:Mn:Co) cathode powder that sets the cell's energy density and the bulk of its cost and pulls in nickel/cobalt/lithium feedstock. Industry basis: a Li-ion cell comprises cathode + anode + separator + electrolyte, and high-energy humanoid cells run NMC chemistries; the cathode is the dominant cost and energy driver of the cell, and its precursor/active-material supply is concentrated.",
    maturityScore: 62,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "battery", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck': cathode active material dominates cell cost/energy and its high-nickel precursor supply is concentrated. Likely citable source: humanoid battery-pack design notes; cathode-materials reviews. Qualitative only this pass (no quantified Wh/kg or composition asserted as fact).",
  }),
  node({
    id: "humanoid_cell_anode_active_material",
    name: "Anode active material (graphite / Si-blend)",
    kind: "material",
    description:
      "Graphite (natural or synthetic) anode material, increasingly with a silicon additive for capacity; the second core electrode material of the cell. Industry basis: the anode is one of the four canonical cell components, and silicon-blended graphite is the route to the higher gravimetric energy that humanoid duty cycles demand; graphite supply (especially synthetic and high-purity natural) is geographically concentrated.",
    maturityScore: 62,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "battery", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck': graphite (and Si-blend) anode supply is concentrated and gates energy density. Likely citable source: humanoid battery-pack design notes; humanoid battery program writeups. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_cell_separator",
    name: "Battery separator (microporous polyolefin)",
    kind: "material",
    description:
      "Microporous PE/PP film, often ceramic-coated, that prevents anode-cathode contact while passing ions; a safety-critical, supply-concentrated specialty film. Industry basis: the separator prevents the cathode from directly contacting the anode while allowing current-carrying ions to pass, and high-power separator film is a recognized chokepoint with few qualified makers.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "battery", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck': qualified high-power separator film is a recognized few-supplier chokepoint and a safety-critical component. Likely citable source: humanoid battery-pack design notes; humanoid battery design-challenge writeups. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_bms_analog_frontend",
    name: "BMS analog front-end / fuel-gauge IC",
    kind: "equipment",
    description:
      "Multi-cell monitoring analog front-end (AFE) IC that measures per-cell voltage, temperature, and current and balances cells; the silicon heart of the battery-management module. Industry basis: the BMS monitors cell voltages, temperature, and current and balances load, and AFE/fuel-gauge ICs are supplied by a short list of vendors (TI, Analog Devices, NXP); Texas Instruments and NXP are already in the graph.",
    maturityScore: 64,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["battery", "electronics", "semiconductor"],
  }),

  // ---------- H5: motor stack materials ----------
  node({
    id: "humanoid_motor_stator_lamination_steel",
    name: "Electrical (silicon) steel laminations",
    kind: "material",
    description:
      "Thin grain-oriented or non-oriented Si-Fe laminations stacked to form the motor stator/rotor core; low-loss electrical steel is a supply-concentrated specialty. Industry basis: frameless torque motors use laminated electrical-steel cores, and thin high-grade non-oriented electrical steel for high-speed robot motors is made by a short list of mills (Nippon Steel, POSCO, JFE, Baowu); raw-material lists for robot motors include iron/steel and copper.",
    maturityScore: 64,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "motor", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck': thin high-grade non-oriented electrical steel for high-speed robot motors is a short-list specialty-mill supply and a real upstream constraint. Renders at depth 4 under the frameless BLDC motor. Likely citable source: non-oriented electrical-steel grade datasheets (Nippon Steel / POSCO). Qualitative only this pass.",
  }),
  node({
    id: "humanoid_motor_copper_magnet_wire",
    name: "Copper magnet (enamelled) wire",
    kind: "material",
    description:
      "Insulated copper winding wire for the motor stator coils; gauge and insulation class set slot fill and thermal rating. Industry basis: copper magnet wire is the universal motor-winding material and an explicit raw-material input to robot/EV motors; slot fill and insulation class gate torque density and duty cycle. Per ADR-0005 this is kept as a material leaf (commodity at ingot/wire level) rather than over-decomposed, absent a specific robot-grade specialty corner.",
    maturityScore: 70,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "motor"],
    notes:
      "Deliberately NOT key-tagged: copper magnet wire is largely commodity, so per ADR-0005 it stays a material leaf and does not render on the canvas. It is recorded for completeness and exposure, not to lift the rendered count. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_ndfeb_magnet_feedstock",
    name: "Sintered NdFeB magnet feedstock (Nd2Fe14B + Dy/Tb)",
    kind: "material",
    description:
      "Sintered neodymium-iron-boron magnet blanks (with Dy/Tb for high-temperature coercivity) - the upstream feedstock that the rare-earth magnet supply node converts into finished arc magnets. Industry basis: NdFeB (Nd2Fe14B) is the highest-energy-product permanent magnet and the standard robot-motor magnet, with Dy/Tb heavy-rare-earth additions raising coercivity for hot joint motors; sintered-magnet feedstock supply is a recognized China-concentrated chokepoint.",
    maturityScore: 58,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "motor", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck': sintered NdFeB feedstock (and its heavy-rare-earth Dy/Tb content) is a China-concentrated supply chokepoint. Deepens the existing rare-earth magnet supply node by one upstream layer; renders at depth 4. Likely citable source: NdFeB magnet references (MP Materials, Arnold Magnetics). Qualitative only this pass.",
  }),

  // ---------- H6: 6-axis force/torque sensor internals ----------
  node({
    id: "humanoid_ft_elastic_element",
    name: "Sensor elastic element (compliant spoke / Maltese-cross body)",
    kind: "product",
    description:
      "Precision-machined metal elastic body (spoke / Maltese-cross / compliant-beam form) whose strain encodes the six-axis load; the mechanical core of a force/torque sensor. Industry basis: six-axis force/torque sensors use precision-machined elastic bodies with metallic strain gauges arranged on them to form multiple Wheatstone bridges, and the elastic-element design (low cross-axis coupling) is the core IP of the sensor.",
    maturityScore: 56,
    maturityLabel: "early_deployment",
    confidence: "medium",
    tags: ["force_torque", "sensing", "hard_to_develop"],
    notes:
      "Hard to develop: designing an elastic element with high sensitivity and low cross-axis coupling, then machining it precisely, is the core force/torque sensor IP. Likely citable source: optimized six-axis F/T sensor papers; ScienceDirect compliant six-axis sensor work. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_ft_strain_transducer",
    name: "Strain transducer (foil gauge / silicon piezoresistor)",
    kind: "equipment",
    description:
      "Foil strain gauges or silicon piezoresistive die bonded to the elastic element and wired into Wheatstone bridges; the transduction element of the force/torque sensor. Industry basis: strain gauges are attached to the beam surfaces of the elastic element to form Wheatstone bridges, and MEMS variants use ion-implanted piezoresistors; bridge trimming and gauge bonding are the precision manufacturing steps.",
    maturityScore: 58,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["force_torque", "sensing"],
  }),

  // ---------- H7: joint encoder internals ----------
  node({
    id: "humanoid_encoder_magnetic_asic",
    name: "Magnetic encoder ASIC (Hall array) + diametric magnet",
    kind: "equipment",
    description:
      "A diametrically polarized magnet rotating above an ASIC Hall-sensor array that resolves absolute angle; the dominant compact robot-joint encoder type. Industry basis: a small diametrically polarized magnet rotates above an ASIC containing an array of Hall-effect sensors and generates a voltage as it rotates, and magnetic encoder ASICs are supplied by a short list of vendors (e.g. AMS-OSRAM, Renishaw, MPS).",
    maturityScore: 66,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["encoder", "sensing"],
  }),
  node({
    id: "humanoid_encoder_optical_codedisk",
    name: "Optical code disk + photodetector (high-res absolute, output-side option)",
    kind: "product",
    description:
      "Etched glass or metal code disk read by an LED/photodetector array for high-resolution absolute position where magnetic resolution is insufficient, used as the output-side encoder in dual-encoder designs (not a universal requirement on every joint). Industry basis: optical encoders include a disc/code-plate, a sensor, and a processor, with absolute optical encoders using concentric patterns where each tic gives a unique binary code; output-side optical encoders co-exist with motor-side magnetic ones in documented hybrid designs.",
    maturityScore: 62,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["encoder", "sensing"],
    notes:
      "Framed as the high-resolution / output-side option (dual-encoder designs), NOT asserted as present on every humanoid joint, to stay honest about coverage. Likely citable source: robot-sensor surveys; USPTO US11002562 hybrid magnetic+optical encoder. Qualitative only this pass.",
  }),

  // ---------- H8: structure materials ----------
  node({
    id: "humanoid_struct_magnesium_alloy",
    name: "Magnesium alloy (die-cast structural)",
    kind: "material",
    description:
      "Lightest structural metal (density ~1.8 g/cm3) used for skeletal/joint housings and shells to cut mass and aid thermal spreading. Industry basis: magnesium alloys are described as a core material in Tesla Optimus Gen 2, helping reduce component weight and enhance thermal management. Per ADR-0005 kept as a material leaf (commodity at ingot level) absent a robot-specific cast-Mg specialty corner.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "structure"],
    notes:
      "Deliberately NOT key-tagged: structural Mg alloy is commodity at ingot level, so per ADR-0005 it stays a material leaf and does not render. Recorded for grounding and exposure (Optimus-specific coverage). Qualitative only this pass (density stated qualitatively).",
  }),
  node({
    id: "humanoid_struct_peek_cf",
    name: "PEEK / carbon-fiber-reinforced polymer",
    kind: "material",
    description:
      "High-performance thermoplastic (PEEK), often carbon-fiber-reinforced, for joint mechanisms, brackets, and wear parts - metal-like specific strength at low mass. Industry basis: PEEK offers specific strength exceeding many conventional metals and is used in skeletal structures and joint mechanisms, often reinforced with carbon fiber; Victrex (PEEK) and Evonik are already suppliers in the graph, and qualified high-performance PEEK supply is concentrated.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "structure", "bottleneck"],
    notes:
      "Key-tagged 'bottleneck': aerospace/robotics-grade PEEK and CF-reinforced PEEK supply is concentrated (e.g. Victrex, Evonik) and is a genuine specialty-materials corner. Renders at depth 3 under the torso enclosure. Likely citable source: PEEK-for-humanoid-robot materials writeups. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_struct_aluminum_alloy",
    name: "Aerospace/structural aluminum alloy",
    kind: "material",
    description:
      "Machined or cast aluminum alloy (density ~2.7 g/cm3, roughly one-third that of steel) for primary frame members and brackets. Industry basis: aluminum alloys have about one-third the density of steel and offer good casting, machinability, and corrosion resistance, making them a standard humanoid frame material. Per ADR-0005 kept as a material leaf (commodity at ingot level).",
    maturityScore: 66,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "structure"],
    notes:
      "Deliberately NOT key-tagged: structural Al alloy is commodity at ingot level, so per ADR-0005 it stays a material leaf and does not render. Recorded for grounding/exposure. Qualitative only this pass (density stated qualitatively).",
  }),

  // ---------- H9: inverter power switch ----------
  node({
    id: "humanoid_inverter_power_switch",
    name: "Power switching device (Si MOSFET / GaN FET)",
    kind: "equipment",
    description:
      "The low-voltage power MOSFET or GaN FET that switches joint-motor phase current and sets inverter efficiency, size, and thermal load. Industry basis: joint inverters for roughly 48 V humanoid motors use low-voltage Si MOSFETs or GaN FETs, with GaN an active power-density frontier; suppliers Infineon, EPC (GaN), Texas Instruments, and STMicroelectronics are all in the graph. Modeled as one device node (Si/GaN) rather than split, to avoid padding.",
    maturityScore: 64,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["power_electronics", "semiconductor"],
  }),

  // ---------- H10: perception transducers ----------
  node({
    id: "humanoid_depth_image_sensor",
    name: "CMOS image sensor + depth emitter (VCSEL / IR)",
    kind: "equipment",
    description:
      "The CMOS/RGBIR image sensor plus the structured-light or time-of-flight emitter (VCSEL/IR) that together form the depth camera's front end. Industry basis: depth-camera reference designs integrate RGBIR image sensors for stereoscopic depth and a ToF LiDAR module, and ToF couples a strobe emitter to a CMOS sensor; depth-sensor suppliers Orbbec, RealSense, and STMicroelectronics are in the graph.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["depth", "sensing", "semiconductor"],
  }),
  node({
    id: "humanoid_imu_mems_die",
    name: "MEMS IMU die (gyro + accelerometer)",
    kind: "equipment",
    description:
      "The six-axis MEMS inertial die (three-axis gyroscope plus three-axis accelerometer) inside the IMU module that provides attitude and balance sensing. Industry basis: humanoid sensor sets combine IMU components with depth/stereo sensing, and MEMS IMU dies are supplied by a short list (Bosch Sensortec, STMicro, TDK/InvenSense, ADI); Bosch Sensortec, TDK, and STMicroelectronics are in the graph.",
    maturityScore: 70,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["imu", "sensing", "semiconductor"],
  }),

  // ---------- H11: compute SoC + memory ----------
  node({
    id: "humanoid_edge_inference_soc",
    name: "Edge AI inference SoC (robot brain)",
    kind: "equipment",
    description:
      "The system-on-chip running onboard perception and vision-language-action inference (e.g. NVIDIA Jetson Thor-class, Qualcomm, Rockchip, D-Robotics); it sets onboard AI throughput within the robot's power budget. Industry basis: humanoid onboard compute is a named SoC chokepoint and the acceptance standard explicitly scopes in the named compute SoC; suppliers NVIDIA (Jetson/Thor), Qualcomm, Rockchip, and D-Robotics are all in the graph.",
    maturityScore: 60,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["compute", "semiconductor", "bottleneck"],
    notes:
      "In-scope per the acceptance standard (the named compute SoC). The full upstream logic-die/HBM fabrication chain lives in the ai_compute_chain domain - this node is the humanoid-side boundary, not a duplicate of that chain. Likely citable source: NVIDIA Jetson Thor / Qualcomm robotics SoC pages. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_compute_lpddr_memory",
    name: "LPDDR / on-module memory",
    kind: "equipment",
    description:
      "Low-power DRAM (LPDDR5/5X) and storage co-packaged with or beside the inference SoC; it gates on-robot model size and memory bandwidth. Industry basis: edge AI compute modules pair the SoC with LPDDR memory, and memory bandwidth gates on-device model size. This node is kept deliberately shallow: the DRAM/HBM fabrication chain is a documented boundary that lives in the ai_compute_chain domain, so memory is not decomposed further here.",
    maturityScore: 64,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["compute", "semiconductor"],
    notes:
      "Boundary note (per Day-0 rule, documented boundaries grade as decisions): on-module LPDDR is included as the robot-side memory dependency, but the upstream DRAM/HBM chain is owned by the ai_compute_chain domain - intentionally not decomposed here to avoid scope bleed. Likely citable source: NVIDIA Jetson module LPDDR5 datasheets. Qualitative only this pass.",
  }),

  // ---------- H12: thermal internals ----------
  node({
    id: "humanoid_heat_pipe_vapor_chamber",
    name: "Heat pipe / vapor chamber",
    kind: "product",
    description:
      "Sealed two-phase heat-spreader that moves heat from motors or compute to the enclosure or a cooling loop; the workhorse passive thermal path in compact high-duty-cycle robots (not universal on every humanoid). Industry basis: compact high-power electronics use heat pipes and vapor chambers for heat spreading, analogous to the two-phase cooling loop modeled in the flagship; two-phase spreaders are a recognized supply-concentrated item (Aavid/Boyd, Auras, AVC).",
    maturityScore: 62,
    maturityLabel: "commercially_available",
    confidence: "medium",
    tags: ["thermal"],
    notes:
      "Framed as the high-duty-cycle option, not asserted as present on every humanoid, to stay honest about coverage. Likely citable source: heat-pipe/vapor-chamber vendor literature (Boyd/Aavid); high-conductivity thermal-management patents. Qualitative only this pass.",
  }),
  node({
    id: "humanoid_thermal_interface_material",
    name: "Thermal interface material (TIM)",
    kind: "material",
    description:
      "Gap-filler, grease, or pad between heat-generating dies/motors and spreaders that sets the contact thermal resistance. Industry basis: TIM is the standard interface between a heat source and a spreader in robot compute and motor thermal paths, and high-performance TIM is a specialty-materials supply (Henkel, Dow, Shin-Etsu); Shin-Etsu is already in the graph.",
    maturityScore: 66,
    maturityLabel: "commercially_available",
    confidence: "low",
    tags: ["material", "thermal"],
    notes:
      "Deliberately NOT key-tagged this pass: TIM is recorded so existing specialty suppliers (e.g. Shin-Etsu, Henkel) can attach in the exposure pass, but it is counted as a non-rendering material leaf (delta 0) per the plan. Qualitative only this pass.",
  }),
];

const newEdges = [
  // H1
  edge({ id: "e_humanoid_strain_wave__requires__flexspline", source: "humanoid_strain_wave_reducer", target: "humanoid_reducer_flexspline", claim: "A strain-wave reducer requires a flexspline (one of its three canonical members); the flexspline is the fatigue-life-limiting, hardest-to-manufacture part.", confidence: "high" }),
  edge({ id: "e_humanoid_strain_wave__requires__circular_spline", source: "humanoid_strain_wave_reducer", target: "humanoid_reducer_circular_spline", claim: "A strain-wave reducer requires a circular spline (rigid internal ring gear), the second of its three canonical members.", confidence: "high" }),
  edge({ id: "e_humanoid_strain_wave__requires__wave_generator", source: "humanoid_strain_wave_reducer", target: "humanoid_reducer_wave_generator", claim: "A strain-wave reducer requires a wave generator (elliptical cam plus deformable flex bearing), the third of its three canonical members.", confidence: "high" }),
  edge({ id: "e_humanoid_strain_wave__requires__cross_roller_bearing", source: "humanoid_strain_wave_reducer", target: "humanoid_cross_roller_bearing", claim: "The strain-wave reducer's joint output is carried by a thin-section cross-roller bearing (often integrated into the reducer/joint housing).", confidence: "medium" }),
  edge({ id: "e_humanoid_strain_wave__requires__bearing_steel", source: "humanoid_strain_wave_reducer", target: "humanoid_bearing_steel_feedstock", claim: "The reducer's bearings and flex bearing are made from high-cleanliness bearing steel; parented here (not under the flexspline) to keep the feedstock within the depth-4 render budget.", confidence: "medium" }),

  // H2
  edge({ id: "e_humanoid_roller_screw__requires__threaded_shaft", source: "humanoid_planetary_roller_screw", target: "humanoid_roller_screw_threaded_shaft", claim: "A planetary roller screw requires a precision multi-start threaded central shaft.", confidence: "high" }),
  edge({ id: "e_humanoid_roller_screw__requires__rollers", source: "humanoid_planetary_roller_screw", target: "humanoid_roller_screw_rollers", claim: "A planetary roller screw requires a set of profile-ground planetary rollers; roller grinding is the throughput-limiting step.", confidence: "high" }),
  edge({ id: "e_humanoid_roller_screw__requires__nut", source: "humanoid_planetary_roller_screw", target: "humanoid_roller_screw_nut", claim: "A planetary roller screw requires a coaxial internal-thread nut with integrated ring gears that time the rollers.", confidence: "high" }),
  edge({ id: "e_humanoid_roller_screw_rollers__requires__bearing_steel", source: "humanoid_roller_screw_rollers", target: "humanoid_bearing_steel_feedstock", claim: "Planetary rollers are made from 52100-class high-cleanliness bearing steel (shared feedstock with the reducer bearings).", confidence: "medium" }),

  // H3
  edge({ id: "e_humanoid_micro_hand__requires__hollow_cup_motor", source: "humanoid_micro_hand_actuator", target: "humanoid_hand_hollow_cup_motor", claim: "The micro hand actuator is driven by a coreless / hollow-cup micro motor (per the Optimus Gen-3 hollow-cup + lead-screw + tendon architecture).", confidence: "medium" }),
  edge({ id: "e_humanoid_micro_hand__requires__micro_leadscrew", source: "humanoid_micro_hand_actuator", target: "humanoid_hand_micro_leadscrew", claim: "The micro hand actuator uses a miniature lead/ball screw to convert motor rotation into the linear tendon pull.", confidence: "medium" }),
  edge({ id: "e_humanoid_fingertip_array__requires__tactile_element", source: "humanoid_fingertip_tactile_array", target: "humanoid_fingertip_tactile_element", claim: "The fingertip tactile array requires a tactile sensing element (MEMS, magnetic, or visuotactile transducer).", confidence: "high" }),
  edge({ id: "e_humanoid_hollow_cup_motor__requires__rare_earth_magnet", source: "humanoid_hand_hollow_cup_motor", target: "humanoid_rare_earth_magnet_supply", claim: "Coreless/slotless hand motors use NdFeB-class permanent magnets (shared rare-earth magnet dependency).", confidence: "medium" }),

  // H4
  edge({ id: "e_humanoid_cell__requires__cathode", source: "humanoid_lithium_ion_cell_selection", target: "humanoid_cell_cathode_active_material", claim: "A Li-ion cell requires a cathode active material; high-nickel NMC dominates cell cost and energy.", confidence: "high" }),
  edge({ id: "e_humanoid_cell__requires__anode", source: "humanoid_lithium_ion_cell_selection", target: "humanoid_cell_anode_active_material", claim: "A Li-ion cell requires an anode active material (graphite, increasingly Si-blended).", confidence: "high" }),
  edge({ id: "e_humanoid_cell__requires__separator", source: "humanoid_lithium_ion_cell_selection", target: "humanoid_cell_separator", claim: "A Li-ion cell requires a microporous separator film; high-power separator is a recognized few-supplier chokepoint.", confidence: "high" }),
  edge({ id: "e_humanoid_bms__requires__afe", source: "humanoid_battery_management_system", target: "humanoid_bms_analog_frontend", claim: "The battery management system requires an analog front-end / fuel-gauge IC to monitor and balance cells.", confidence: "high" }),

  // H5
  edge({ id: "e_humanoid_frameless_bldc__requires__lamination_steel", source: "humanoid_frameless_bldc_motor", target: "humanoid_motor_stator_lamination_steel", claim: "The frameless BLDC motor core is built from thin electrical (silicon) steel laminations.", confidence: "high" }),
  edge({ id: "e_humanoid_frameless_bldc__requires__copper_wire", source: "humanoid_frameless_bldc_motor", target: "humanoid_motor_copper_magnet_wire", claim: "The frameless BLDC motor stator is wound with insulated copper magnet wire.", confidence: "high" }),
  edge({ id: "e_humanoid_rare_earth_magnet__requires__ndfeb_feedstock", source: "humanoid_rare_earth_magnet_supply", target: "humanoid_ndfeb_magnet_feedstock", claim: "The rare-earth magnet supply is produced from sintered NdFeB feedstock (with Dy/Tb for high-temperature coercivity); a China-concentrated upstream chokepoint.", confidence: "medium" }),

  // H6
  edge({ id: "e_humanoid_force_torque__requires__elastic_element", source: "humanoid_force_torque_sensing", target: "humanoid_ft_elastic_element", claim: "A six-axis force/torque sensor requires a precision-machined elastic element whose strain encodes the load.", confidence: "high" }),
  edge({ id: "e_humanoid_ft_elastic_element__requires__strain_transducer", source: "humanoid_ft_elastic_element", target: "humanoid_ft_strain_transducer", claim: "The elastic element requires strain transducers (foil gauges or silicon piezoresistors) wired into Wheatstone bridges.", confidence: "high" }),

  // H7
  edge({ id: "e_humanoid_joint_encoder__requires__magnetic_asic", source: "humanoid_joint_encoder_position", target: "humanoid_encoder_magnetic_asic", claim: "The joint encoder commonly uses a magnetic encoder ASIC (Hall array) over a diametrically polarized magnet for compact absolute angle sensing.", confidence: "high" }),
  edge({ id: "e_humanoid_joint_encoder__requires__optical_codedisk", source: "humanoid_joint_encoder_position", target: "humanoid_encoder_optical_codedisk", claim: "Where higher resolution is needed (output-side / dual-encoder designs), the joint encoder uses an optical code disk and photodetector.", confidence: "medium" }),

  // H8
  edge({ id: "e_humanoid_skeleton__requires__aluminum_alloy", source: "humanoid_lightweight_skeleton_frame", target: "humanoid_struct_aluminum_alloy", claim: "The lightweight skeleton frame uses structural aluminum alloy for primary members and brackets.", confidence: "high" }),
  edge({ id: "e_humanoid_skeleton__requires__magnesium_alloy", source: "humanoid_lightweight_skeleton_frame", target: "humanoid_struct_magnesium_alloy", claim: "The lightweight skeleton frame uses die-cast magnesium alloy for the lightest structural housings.", confidence: "medium" }),
  edge({ id: "e_humanoid_torso_enclosure__requires__peek_cf", source: "humanoid_torso_enclosure_skin", target: "humanoid_struct_peek_cf", claim: "The torso enclosure and joint mechanisms use PEEK / carbon-fiber-reinforced polymer for low-mass, high-specific-strength parts.", confidence: "medium" }),

  // H9
  edge({ id: "e_humanoid_inverter__requires__power_switch", source: "humanoid_inverter_power_stage", target: "humanoid_inverter_power_switch", claim: "The joint inverter power stage requires a low-voltage power switching device (Si MOSFET or GaN FET).", confidence: "high" }),

  // H10
  edge({ id: "e_humanoid_depth_camera__requires__image_sensor", source: "humanoid_depth_camera_lidar", target: "humanoid_depth_image_sensor", claim: "The depth camera requires a CMOS image sensor plus a structured-light/ToF emitter (VCSEL/IR) as its front end.", confidence: "high" }),
  edge({ id: "e_humanoid_imu__requires__mems_die", source: "humanoid_imu_attitude_sensing", target: "humanoid_imu_mems_die", claim: "IMU attitude sensing requires a six-axis MEMS inertial die (gyro + accelerometer).", confidence: "high" }),

  // H11
  edge({ id: "e_humanoid_edge_compute__requires__inference_soc", source: "humanoid_edge_ai_compute_module", target: "humanoid_edge_inference_soc", claim: "The edge AI compute module requires an onboard inference SoC (the named compute chokepoint).", confidence: "high" }),
  edge({ id: "e_humanoid_edge_compute__requires__lpddr_memory", source: "humanoid_edge_ai_compute_module", target: "humanoid_compute_lpddr_memory", claim: "The edge AI compute module requires on-module LPDDR memory; the upstream DRAM/HBM chain is a documented boundary owned by the ai_compute_chain domain.", confidence: "medium" }),

  // H12
  edge({ id: "e_humanoid_motor_thermal__requires__heat_pipe", source: "humanoid_motor_joint_thermal_path", target: "humanoid_heat_pipe_vapor_chamber", claim: "High-duty-cycle motor/joint thermal paths use a heat pipe or vapor chamber as a two-phase spreader (the high-duty-cycle option, not universal).", confidence: "medium" }),
  edge({ id: "e_humanoid_compute_spreader__requires__tim", source: "humanoid_compute_heat_spreader", target: "humanoid_thermal_interface_material", claim: "The compute heat spreader requires a thermal interface material between the die/source and the spreader.", confidence: "high" }),
];

// Splice into existing files.
const nodes = JSON.parse(fs.readFileSync(NODES_PATH, "utf8"));
const edges = JSON.parse(fs.readFileSync(EDGES_PATH, "utf8"));

// Insert new nodes BEFORE the first organization node so org nodes stay grouped
// at the tail (matches existing file layout: non-org nodes first, orgs last).
const firstOrgIdx = nodes.findIndex((n) => n.kind === "organization");
const insertAt = firstOrgIdx === -1 ? nodes.length : firstOrgIdx;
const merged = [...nodes.slice(0, insertAt), ...newNodes, ...nodes.slice(insertAt)];

fs.writeFileSync(NODES_PATH, JSON.stringify(merged, null, 2) + "\n");
fs.writeFileSync(EDGES_PATH, JSON.stringify([...edges, ...newEdges], null, 2) + "\n");

console.log(`Nodes: ${nodes.length} -> ${merged.length} (+${newNodes.length})`);
console.log(`Edges: ${edges.length} -> ${edges.length + newEdges.length} (+${newEdges.length})`);
console.log(`Inserted new nodes at index ${insertAt} (before first org).`);
