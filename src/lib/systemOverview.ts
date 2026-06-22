export type SystemOverviewLocale = "zh" | "en";

export type SystemOverviewRowKey =
  | "systemTarget"
  | "productionPath"
  | "constraintMechanism"
  | "improvementPath"
  | "industryChainImpact"
  | "mainRisks"
  | "evidenceSupport";

export type SystemOverviewRow = {
  key: SystemOverviewRowKey;
  label: string;
  value: string;
};

export type SystemOverviewCopy = {
  title: string;
  subtitle: string;
  rows: SystemOverviewRow[];
};

type LocalizedSystemOverview = Record<SystemOverviewLocale, SystemOverviewCopy>;

const zhRows = (
  rows: Record<SystemOverviewRowKey, string>,
): SystemOverviewRow[] => [
  { key: "systemTarget", label: "系统目标", value: rows.systemTarget },
  { key: "productionPath", label: "生产路径", value: rows.productionPath },
  { key: "constraintMechanism", label: "约束机制", value: rows.constraintMechanism },
  { key: "improvementPath", label: "提升路径", value: rows.improvementPath },
  { key: "industryChainImpact", label: "产业链影响", value: rows.industryChainImpact },
  { key: "mainRisks", label: "主要风险", value: rows.mainRisks },
  { key: "evidenceSupport", label: "证据支持", value: rows.evidenceSupport },
];

const enRows = (
  rows: Record<SystemOverviewRowKey, string>,
): SystemOverviewRow[] => [
  { key: "systemTarget", label: "System target", value: rows.systemTarget },
  { key: "productionPath", label: "Production path", value: rows.productionPath },
  { key: "constraintMechanism", label: "Constraint mechanism", value: rows.constraintMechanism },
  { key: "improvementPath", label: "Improvement path", value: rows.improvementPath },
  { key: "industryChainImpact", label: "Industry-chain impact", value: rows.industryChainImpact },
  { key: "mainRisks", label: "Main risks", value: rows.mainRisks },
  { key: "evidenceSupport", label: "Evidence support", value: rows.evidenceSupport },
];

const SYSTEM_OVERVIEWS: Record<string, LocalizedSystemOverview> = {
  ai_accelerator_module_hbm_cowos: {
    zh: {
      title: "系统概览",
      subtitle: "AI 计算模组的核心问题是：前沿芯片、HBM、先进封装、基板和测试能否同步变成可出货的模组。",
      rows: zhRows({
        systemTarget: "交付面向数据中心训练和推理的 AI 计算模组：前沿逻辑芯片与 HBM 在先进封装中集成到高阶基板上，并达到可出货的带宽、功耗与可靠性要求。",
        productionPath: "前沿逻辑芯片与 HBM 堆叠分别制造并筛选后，通过硅中介层或桥接方案和高层数有机基板完成先进封装，再经过电性、热可靠性和互连检测成为可出货模组。",
        constraintMechanism: "成品吞吐取决于可分配 HBM、先进封装窗口、高阶基板/中介层供给和后段测试/良率的同步；任一环节慢于其他环节，都会让已完成芯片或内存变成排队库存。",
        improvementPath: "最有效方向是耦合扩产和良率爬坡：同步扩大并认证 HBM 供应、先进封装、基板/中介层和 HBM/封装测试能力，同时提高后段装配与终测良率。",
        industryChainImpact: "研究重点应集中在控制 HBM 可得性、先进封装容量、高阶基板/中介层、HBM/封装测试与关键封装设备的位置；商业压力更可能体现为产能预留、供应优先级和扩产资源。",
        mainRisks: "晶圆或单一封装扩产快于 HBM、基板/中介层或测试能力，会形成后段排队；HBM 堆叠/测试良率、供应商认证、需求预期回落和先进制程/封装扩产周期都可能降低可出货模组增速。",
        evidenceSupport: "当前证据支持 HBM + 先进封装是 AI 加速模组的核心架构，先进封装、高阶基板、HBM 分配/扩产和后段测试压力共同决定模组可得性。",
      }),
    },
    en: {
      title: "System overview",
      subtitle: "The AI compute module question is whether leading-edge silicon, HBM, advanced packaging, substrates, and test can turn into shippable modules at the same pace.",
      rows: enRows({
        systemTarget: "Deliver a data-center training and inference AI compute module: leading-edge logic silicon and HBM integrated through advanced packaging on a high-end substrate, with shippable bandwidth, power, and reliability.",
        productionPath: "Leading-edge logic dies and HBM stacks are fabricated and screened separately, then assembled through an interposer or bridge package on a high-layer organic substrate, and finally qualified through electrical, thermal-reliability, and interconnect test.",
        constraintMechanism: "Module throughput depends on available HBM, advanced-packaging windows, substrate/interposer supply, and back-end test/yield moving together; if any one runs slower, finished dies or memory turn into queued inventory.",
        improvementPath: "The strongest improvement path is coupled capacity and yield ramp: expand and qualify HBM supply, advanced packaging, substrate/interposer supply, and HBM/package test while improving assembly and final-test yield.",
        industryChainImpact: "Research should focus on positions controlling HBM availability, advanced-packaging capacity, high-end substrate/interposer supply, HBM/package test, and key packaging tools; commercial pressure is more likely to show up as capacity reservation, supply priority, and expansion resources.",
        mainRisks: "Wafer or single packaging expansion can outrun HBM, substrate/interposer, or test capacity and create back-end queues; HBM stack/test yield, supplier qualification, demand reversal, and leading-edge fab/package lead times can all slow shippable module growth.",
        evidenceSupport: "Current evidence supports HBM plus advanced packaging as the core AI accelerator-module architecture, with packaging, high-end substrates, HBM allocation/expansion, and back-end test jointly determining module availability.",
      }),
    },
  },
  low_cost_parcel_sorting_robot_300k_rmb: {
    zh: {
      title: "系统概览",
      subtitle: "这个产品的关键不是单个机器人零件，而是低成本硬件、视觉识别、输送线节拍和异常处理能否稳定组合。",
      rows: zhRows({
        systemTarget: "交付一个面向物流包裹场景的低成本分拣单元：单机械臂、真空吸附末端、视觉系统和输送线集成在一起，并接近 30 万 RMB 总系统成本目标。",
        productionPath: "先选型机械臂、末端执行器、相机/光源、边缘计算、输送线和安全件，再完成视觉标定、输送节拍、机器人动作、分拣决策和现场安装调试。",
        constraintMechanism: "吞吐和成本不是由单个零件决定；视觉识别、包裹间距、时间戳/位置跟踪、机械臂抓取节拍、无读码和卡滞恢复任一环节不稳，都会把理论分拣能力变成人工干预和停机。",
        improvementPath: "当前最需要提升的是现场集成吞吐和可靠性：优化包裹单件化/间距控制、视觉光照与识别、低延迟控制、异常恢复和维护流程，减少人工介入。",
        industryChainImpact: "研究重点应放在机器视觉光源/相机/边缘计算、低成本机械臂与末端执行器、输送线传感与控制、系统集成和售后维护能力；这些位置决定产品能否从样机变成可复制部署。",
        mainRisks: "包裹尺寸和表面差异、不可读标签、并排/堆叠来件、卡滞、安全要求、安装周期和维护成本都会削弱投资回报；如果现场调试依赖人工经验，规模复制会变慢。",
        evidenceSupport: "当前证据和图谱结构支持这个产品边界由机械臂、真空末端、视觉、输送线、决策、安全、维护和成本栈共同构成，核心约束集中在识别、节拍、异常恢复和部署维护。",
      }),
    },
    en: {
      title: "System overview",
      subtitle: "The product is not a single robot part; it is whether low-cost hardware, vision, conveyor timing, and exception handling work as a repeatable sorting cell.",
      rows: enRows({
        systemTarget: "Deliver a low-cost parcel-sorting cell for logistics sites: one robot arm, vacuum end effector, vision system, and conveyor induction integrated near the RMB 300k total-system cost target.",
        productionPath: "Select the arm, end effector, camera/lighting, edge compute, conveyor, and safety hardware, then complete vision calibration, conveyor timing, robot motion, sorting decisions, and on-site commissioning.",
        constraintMechanism: "Throughput and cost are not set by one component; if recognition, parcel spacing, timestamp/position tracking, robot pick timing, no-read recovery, or jam recovery is unstable, theoretical capacity turns into manual intervention and downtime.",
        improvementPath: "The current priority is field integration throughput and reliability: improve singulation/gapping, vision lighting and recognition, low-latency controls, exception recovery, and maintenance workflows to reduce human intervention.",
        industryChainImpact: "Research should focus on machine-vision lighting/cameras/edge compute, low-cost robot arms and end effectors, conveyor sensing and control, system integration, and service capability because these positions determine repeatable deployment.",
        mainRisks: "Parcel size and surface variation, unreadable labels, side-by-side or stacked induction, jams, safety requirements, installation time, and maintenance cost can all weaken ROI; if commissioning depends on site-specific manual tuning, scaling slows.",
        evidenceSupport: "Current evidence and graph structure support a product boundary built from robot arm, vacuum end effector, vision, conveyor, decision, safety, maintenance, and cost stack, with constraints concentrated in recognition, timing, exception recovery, and deployment maintenance.",
      }),
    },
  },
  humanoid_robot_key_component_stack: {
    zh: {
      title: "系统概览",
      subtitle: "人形机器人的系统问题是早期机队能否稳定工作：关节、手、供电、散热、感知、控制和服务必须一起达标。",
      rows: zhRows({
        systemTarget: "交付可进入早期机队部署的人形机器人组件栈：执行器、手、电池与电源、散热、感知、机载计算、控制软件、结构、安全、制造测试和服务形成可运行平台。",
        productionPath: "先制造和采购关节模组、灵巧手、电池/电源、传感器、计算控制板、结构件和线束，再完成整机装配、标定、运动/操作软件调试、安全测试和售后服务准备。",
        constraintMechanism: "有用的机器人不是单项演示；关节扭矩/寿命、手部操作、电池续航、热管理、感知计算、运动控制、任务数据和制造测试任一短板，都会缩短有效工作时长或限制可执行任务。",
        improvementPath: "当前最需要提升的是系统集成和认证爬坡：提高关节模组与手部可靠性，打通电池/热管理，扩大控制与操作数据闭环，并把装配、校准、测试和现场服务流程标准化。",
        industryChainImpact: "研究重点应集中在精密执行器、减速器/电机/编码器、灵巧手和触觉、电池与功率器件、传感器/边缘计算、制造测试和服务体系；这些位置决定机器人能否从展示机走向机队。",
        mainRisks: "演示能力无法转化为长时作业、关键部件寿命不足、电池热限制、软件泛化弱、安全/责任要求、服务成本高或客户投资回报不清晰，都会推迟商业化。",
        evidenceSupport: "当前证据和图谱结构支持执行器、灵巧手、电池/电源、热管理、控制软件、操作 AI、制造测试和服务是早期人形机器人部署的耦合约束来源。",
      }),
    },
    en: {
      title: "System overview",
      subtitle: "The humanoid question is early fleet usefulness: joints, hands, power, thermal, sensing, control, manufacturing, and service must clear the bar together.",
      rows: enRows({
        systemTarget: "Deliver a humanoid component stack that can enter early fleet deployment: actuation, hands, battery and power, thermal, sensing, onboard compute, control software, structure, safety, manufacturing test, and service working as one platform.",
        productionPath: "Manufacture or source joint modules, hands, batteries/power, sensors, compute/control boards, structures, and harnesses, then assemble, calibrate, tune locomotion/manipulation software, run safety tests, and prepare field service.",
        constraintMechanism: "A useful robot is not a single demo; weaknesses in joint torque/life, hand manipulation, battery runtime, thermal design, sensing compute, whole-body control, task data, or manufacturing test shorten duty cycle or limit usable tasks.",
        improvementPath: "The current priority is system integration and qualification ramp: improve joint and hand reliability, close the battery/thermal loop, scale control/manipulation data feedback, and standardize assembly, calibration, testing, and field service.",
        industryChainImpact: "Research should focus on precision actuators, reducers/motors/encoders, dexterous hands and tactile systems, batteries and power devices, sensors/edge compute, manufacturing test, and service infrastructure because these positions determine the move from demo unit to fleet.",
        mainRisks: "Demo capability may not translate into long-duration work; limited component lifetime, battery/thermal limits, weak software generalization, safety/liability requirements, high service cost, or unclear customer ROI can all delay commercialization.",
        evidenceSupport: "Current evidence and graph structure support actuation, dexterous hands, battery/power, thermal management, control software, manipulation AI, manufacturing test, and service as coupled constraint sources for early humanoid deployment.",
      }),
    },
  },
  controlled_fusion_route_portfolio: {
    zh: {
      title: "系统概览",
      subtitle: "受控核聚变不是只比较哪条路线点火，而是看路线物理、燃料循环、材料、热提取、维护和经济性是否同时成立。",
      rows: zhRows({
        systemTarget: "比较受控核聚变路线能否走向净发电电站：判断路线物理、共同电站约束和商业化路径是否能组合成可运行的发电系统。",
        productionPath: "先区分托卡马克、仿星器、激光惯性约束和次级路线，再把约束/驱动装置、燃料循环、氚增殖包层、热提取、耐中子材料、远程维护、安全许可和电网经济性组合成电站系统。",
        constraintMechanism: "路线物理突破不足以形成电站；氚增殖、包层换热、等离子体面对材料、远程维护、可用率、安全监管和净电增益任一项跟不上，都会让发电系统停在实验或低可用阶段。",
        improvementPath: "当前最需要提升的是电站级共享约束验证：推进氚/包层/热提取、耐中子材料、远程维护和安全许可，同时让主要路线证明可重复、可维护、可经济化的净电路径。",
        industryChainImpact: "研究重点应放在超导磁体、高功率激光/脉冲电源、氚与锂基包层材料、等离子体面对材料、远程维护、真空/低温和电力电子位置；这些环节决定路线从实验走向电站的资源需求。",
        mainRisks: "净电增益不可重复、氚闭环不足、材料寿命短、维护停机过长、监管安全案例不清、建设成本高于替代能源或次级路线成熟度不足，都会改变商业化节奏。",
        evidenceSupport: "当前证据和图谱结构支持把主要路线、次级路线和共享电站约束分开阅读；共享约束对商业化可用率和电站可行性有决定作用。",
      }),
    },
    en: {
      title: "System overview",
      subtitle: "Fusion is not just which route ignites; route physics, fuel cycle, materials, heat extraction, maintenance, regulation, and economics must all work.",
      rows: enRows({
        systemTarget: "Compare controlled-fusion routes that could become net-electric power plants, instead of treating single experiments, route concepts, and unvalidated commercial products as equivalent.",
        productionPath: "Separate tokamak, stellarator, laser inertial, and secondary routes, then integrate confinement or driver hardware with fuel cycle, tritium-breeding blankets, heat extraction, neutron-tolerant materials, remote maintenance, safety licensing, and grid economics.",
        constraintMechanism: "A route-physics breakthrough is not enough for a plant; if tritium breeding, blanket heat extraction, plasma-facing materials, remote maintenance, availability, safety regulation, or net-electric gain lags, the system remains experimental or low-availability.",
        improvementPath: "The current priority is plant-level shared-constraint validation: advance tritium/blanket/heat extraction, neutron materials, remote maintenance, and safety licensing while primary routes prove repeatable, maintainable, economic net-electric paths.",
        industryChainImpact: "Research should focus on superconducting magnets, high-power lasers or pulsed power, tritium and lithium blanket materials, plasma-facing materials, remote maintenance, vacuum/cryogenic systems, and power electronics because these layers set the resource need from experiment to plant.",
        mainRisks: "Net-electric gain may not repeat, tritium closure may fail, materials lifetime may be too short, maintenance downtime may be too long, safety cases may remain unclear, build cost may lose to alternatives, or secondary routes may stay immature.",
        evidenceSupport: "Current evidence and graph structure support reading primary routes, secondary routes, and shared plant constraints separately; shared constraints are decisive for commercial availability and plant feasibility.",
      }),
    },
  },
  spacex_reusable_launch_stack: {
    zh: {
      title: "系统概览",
      subtitle: "可复用发射的系统问题不是能否回收，而是回收后能否低成本、低停机、高频率地再次发射。",
      rows: zhRows({
        systemTarget: "交付 SpaceX 中心的可复用轨道发射能力：把 Falcon 9 的运营复用和 Starship/Super Heavy 的快速全复用开发分开看，同时关注每千克入轨成本和发射节奏。",
        productionPath: "制造和集成运载器、发动机、热防护、航电、地面系统和发射许可后，完成发射、回收、检查/翻修、地面周转、客户/载荷集成和再次发射。",
        constraintMechanism: "复用只有在周转时间、检查置信度、翻修范围、发动机/热防护寿命、发射台恢复、发射场/空域协调和监管许可同步时才会转化为更高发射节奏和更低单位成本。",
        improvementPath: "当前最需要提升的是运营周转和快速复用认证：减少检查/翻修范围，稳定发射台和地面流程，验证 Starship 热防护与发动机重复使用，并让许可和发射场节奏匹配车辆能力。",
        industryChainImpact: "研究重点应放在发射地面系统、发动机与翻修工具、热防护材料、航电/耐辐射电子、复合材料和金属制造、发射服务与可比公开市场暴露；这些位置最能反映复用节奏提升带来的资源集中。",
        mainRisks: "Starship 快速复用尚未成熟、热防护或发动机寿命不足、发射台损伤、监管节奏、客户需求结构、Falcon 与 Starship 路线切换，以及 SpaceX 本身未公开上市，都会影响公开市场读法。",
        evidenceSupport: "当前证据和图谱结构支持把 Falcon 9 运营复用、Starship/Super Heavy 开发路线、共同复用使能项和地面运营分开阅读，并支持每千克入轨成本与发射节奏是核心系统指标。",
      }),
    },
    en: {
      title: "System overview",
      subtitle: "Reusable launch is not just recovery; the system question is whether the vehicle can fly again cheaply, quickly, and reliably.",
      rows: enRows({
        systemTarget: "Deliver a SpaceX-centered reusable orbital launch capability: read Falcon 9 operational reuse separately from Starship/Super Heavy rapid full-reuse development, with cost per kg and launch cadence as core system metrics.",
        productionPath: "Build and integrate the vehicle, engines, thermal protection, avionics, ground systems, and launch approvals, then launch, recover, inspect/refurbish, turn the pad and ground system, integrate payload/customer demand, and fly again.",
        constraintMechanism: "Reuse becomes lower unit cost and higher cadence only when turnaround time, inspection confidence, refurbishment scope, engine/thermal-protection life, pad recovery, range/airspace coordination, and licensing move together.",
        improvementPath: "The current priority is operating turnaround and rapid-reuse qualification: reduce inspection/refurbishment scope, stabilize pad and ground processes, prove repeated Starship thermal-protection and engine reuse, and align license/range cadence with vehicle capability.",
        industryChainImpact: "Research should focus on launch ground systems, engine and refurbishment tooling, thermal-protection materials, avionics/radiation-tolerant electronics, composites and metal manufacturing, launch services, and public comparables where evidence supports the exposure.",
        mainRisks: "Starship rapid reuse is not yet mature; thermal-protection or engine life, pad damage, regulatory cadence, customer-demand mix, Falcon-to-Starship transition, and SpaceX's private listing status all affect the public-market read.",
        evidenceSupport: "Current evidence and graph structure support reading Falcon 9 operational reuse, Starship/Super Heavy development, common reuse enablers, and ground operations separately, with cost per kg and launch cadence as core system metrics.",
      }),
    },
  },
  spacex_orbital_data_center_system: {
    zh: {
      title: "系统概览",
      subtitle: "轨道数据中心是未来产品候选：关键是有用算力能否同时通过供电、散热、辐射、链路、发射和监管约束。",
      rows: zhRows({
        systemTarget: "评估 SpaceX 中心的轨道 AI 计算/数据中心未来产品：把高功率计算载荷、航天器平台、供电、散热、辐射防护、光链路、发射部署和地面运营组成可用服务。",
        productionPath: "先筛选和认证 AI 计算载荷与存储/控制硬件，再集成卫星平台、太阳能阵列、热排散、辐射缓解、光学星间链路、制造测试、发射部署、地面系统和运行调度。",
        constraintMechanism: "轨道环境把算力转化成耦合约束：太阳能供电、真空热排散、辐射故障、链路带宽、单位可用算力发射成本、寿命替换和许可要求任一环节不足，都会降低可用算力或商业利用率。",
        improvementPath: "当前最需要提升的是空间级有用算力密度和系统认证：提高热排散和太阳能展开能力，完成高性能计算板的辐射/热真空筛选，验证光链路与任务调度，并证明发射部署经济性。",
        industryChainImpact: "研究重点应集中在空间电源和展开机构、热控/散热器、耐辐射计算板与零件筛选、光学星间链路、卫星制造测试和发射部署能力；目前更适合作为未来产品可行性跟踪。",
        mainRisks: "公开证据支持的是申请和意图而非成熟商业服务；功率/热预算、辐射失效、单位可用算力发射成本、轨道碎片和监管、链路可用性、客户利用率和与地面数据中心的成本对比都可能否定商业性。",
        evidenceSupport: "当前证据支持存在轨道数据中心相关申请和意图，并支持航天器平台、热控、辐射、光链路和发射部署是这类系统的核心约束。",
      }),
    },
    en: {
      title: "System overview",
      subtitle: "Orbital data center is a future-product candidate: useful compute must clear power, thermal, radiation, link, launch, and regulatory constraints together.",
      rows: enRows({
        systemTarget: "Evaluate a SpaceX-centered future orbital AI compute/data-center product: combine high-power compute payloads, spacecraft bus, power, thermal rejection, radiation mitigation, optical links, launch deployment, and ground operations into a usable service.",
        productionPath: "Screen and qualify AI compute payload, storage, and control hardware, then integrate the spacecraft bus, solar arrays, heat rejection, radiation mitigation, optical inter-satellite links, manufacturing test, launch deployment, ground systems, and operations scheduling.",
        constraintMechanism: "Orbit turns compute into a coupled system constraint: insufficient solar power, vacuum heat rejection, radiation fault tolerance, link bandwidth, launch cost per kW, replacement life, or licensing reduces useful compute or commercial utilization.",
        improvementPath: "The current priority is space-grade useful compute density and system qualification: improve heat rejection and solar deployment, qualify high-performance compute boards through radiation and thermal-vacuum screening, validate optical links and scheduling, and prove deployment economics.",
        industryChainImpact: "Research should focus on space power and deployment mechanisms, thermal-control/radiator hardware, radiation-tolerant compute boards and parts screening, optical inter-satellite links, satellite manufacturing/test, and launch deployment capability; today it is best read as future-product feasibility tracking.",
        mainRisks: "Public evidence supports application and intent, not a mature commercial service; power/thermal budget, radiation failure, launch cost per kW, debris and regulatory limits, link availability, customer utilization, and comparison with terrestrial data centers can all negate commercial viability.",
        evidenceSupport: "Current evidence supports an orbital data-center-related application and intent, and supports spacecraft bus, thermal, radiation, optical-link, and launch-deployment layers as core constraints for this system type.",
      }),
    },
  },
};

export function systemOverviewForRoot(
  rootId: string,
  locale: SystemOverviewLocale,
): SystemOverviewCopy | null {
  return SYSTEM_OVERVIEWS[rootId]?.[locale] ?? null;
}

export function systemOverviewRootIds(): string[] {
  return Object.keys(SYSTEM_OVERVIEWS);
}
