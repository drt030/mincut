# 竞品分析 / Competitive Landscape — MinCut

> **用途**：记录 MinCut 的可比项目（竞品 / 近亲项目）及其相对优劣，供产品定位、ADR 讨论、对外说明（README / 投资人材料）和"是否要做某功能"决策直接引用。**目的是省去重复搜索**——下次想了解"市面上有没有人做类似的东西"，先读本文档。
>
> **编制日期**：2026-06-14
> **数据来源**：一次 `deep-research` 工作流（fan-out 网络搜索 → 抓取来源 → 三票对抗验证 → 综合）。运行规模：5 个搜索角度、24 个抓取来源、抽取 119 条主张、25 条进入对抗验证、**23 条通过 / 2 条被否决剔除**、106 个子代理。
> **语言约定**：正文中文；项目名、技术术语、字段名、URL 保持英文（与本仓库 canonical 约定一致）。
> **维护**：领域变化快（见 §7 时效性）。建议每 6–12 个月、或在重写定位/对外材料前复核一次。新增竞品请标注可信度分层（见下）。

---

## 0. 可信度分层（重要）

本文档的竞品分两档，**引用时务必区分**：

- **🟢 Tier A — 深度验证（7 个）**：经过 3 票对抗验证、有逐字抓取证据。结论可直接引用。
- **🟡 Tier B — 已检索、未对抗验证（6+ 个）**：抓到了来源、但主张未进入验证名额，按一般认知 + 抓取片段简述。**结论强度低，引用前请自查来源**。其中 **OpenBOM 和 Squiggle 最可能挑战"MinCut 在成本 / 估算轴独特"的结论**。

> ⚠️ 原始调研目标是"≥10 个竞品"。Tier A 只有 7 个，是因为 PKM、BOM/PLM、文献图谱、供应链、技术情报等类别的主张没挤进 top-25 验证名额——**不代表这些类别不存在竞品**，只代表本轮没对它们做严格核验。补齐它们是首要后续待办（见 §8）。

---

## 1. 一句话结论（TL;DR）

**没有任何一个竞品同时具备 MinCut 的"六件套"。** 每条对比轴都存在比 MinCut 更强的"单项冠军"，但**没有谁把它们组合在一起**。其中两项机制在全部 7 个 Tier A 竞品里**逐一被证实缺失**，是 MinCut 最难被替代的差异点：

1. **四级证据评审阶梯（unreviewed / reviewed / disputed / deprecated）联动评分**；
2. **仅用本地数据的验证门（validation gate，competency-question 评分）**。

"面向单一工业品的制造级分解深度"同样无人覆盖。MinCut 的相对弱点是**数据规模 / 单人策展成本**、**不确定性数学的成熟度**，以及**无协作 / 众包通道**。精神上最接近的是 **Historical Tech Tree、Gap Map、Foresight Tech Trees**（若按"文明自举 + 显式成熟度阶梯"单项论，则 GVCS 最可比）。

---

## 2. 速览对比矩阵

✓ = 具备　◐ = 部分 / 弱　✗ = 无。
轴含义：**分解** = 产品级模块 / 工艺 / 材料分解；**瓶颈·时间** = 瓶颈随时间演化 / 回放；**成本** = 层级成本汇总；**证据** = 证据评审分级。

| 项目 | 分解 | 瓶颈·时间 | 成熟度 | 成本 | 证据评审 | AI 研究 | 开源·本地 | 档位 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **MinCut** | ✓ | ✓ | ✓ | ✓ 区间 | ✓ 四级 | ✓ | ✓ 本地 | — |
| Historical Tech Tree | ✗ | ◐ 隐含年代 | ◐ | ✗ | ✗ | ✗ | ✓ | 🟢A |
| Foresight Tech Trees | ◐ 领域级 | ✓ 前瞻瓶颈 | ✗ | ✗ | ✗ | ✗ | ◐ 部分 | 🟢A |
| Gap Map | ✗ | ✓ 瓶颈库 | ✗ | ✗ | ◐ 单级审核 | ✗ | ◐ MIT 数据 | 🟢A |
| GVCS (Open Source Ecology) | ◐ wiki 式 | ✗ | ✓ 五级阶梯 | ◐ 宣传 | ✗ | ✗ | ✓ | 🟢A |
| OnlineWardleyMaps | ✗ | ◐ 演化轴 | ◐ 手工位置 | ✗ | ✗ | ✗ | ✓ MIT | 🟢A |
| Valispace | ✓ 需求级 | ✗ | ✗ | ✓ 公式+裕度 | ✗ | ✗ | ✗ 闭源 | 🟢A |
| Guesstimate | ✗ | ✗ | ✗ | ✓ 分布采样 | ✗ | ✗ | ◐ 前端 MIT | 🟢A |
| OpenBOM | ✓ BOM | ✗ | ✗ | ✓ 层级 | ✗ | ◐ | ✗ | 🟡B |
| Squiggle / Squiggle Hub | ✗ | ✗ | ✗ | ✓ 分布 DSL | ✗ | ✗ | ✓ | 🟡B |
| Roam / Obsidian Discourse Graph | ✗ | ✗ | ✗ | ✗ | ✓ claim/evidence | ◐ | ✓ 本地 | 🟡B |
| Connected Papers / ResearchRabbit / Litmaps | ✗ | ◐ 时间线 | ✗ | ✗ | ✗ | ✗ | ✗ | 🟡B |
| Sourcemap | ◐ 供应链层 | ✗ | ✗ | ◐ | ✗ | ✗ | ✗ | 🟡B |
| ITONICS / Gartner Hype Cycle / PatSnap | ◐ | ◐ 成熟度方法论 | ◐ | ✗ | ✗ | ◐ | ✗ | 🟡B |

---

## 3. 对比基线：MinCut 自身的"六件套"

（为使本文档自包含，先固定基线。详见 README、CONTEXT.md、`docs/adr/`。）

1. **类型化制造分解**：capability → sibling products → modules → manufacturing processes → materials 的 typed dependency graph（Zod schema 校验）。
2. **时间戳成熟度 + 回放**：每个 maturity 评估带 `maturityAsOf`；`maturityHistory` 预留给时间滑块，支持回溯式"什么解锁了什么、何时"（ADR-0002）。
3. **区间成本汇总**：成本为 `{min, typical, max}`，区间算术累加，逐层 15% 集成开销，`max(direct, children-sum×1.15)`（ADR-0003）。
4. **证据评审阶梯联动评分**：unreviewed / reviewed / disputed / deprecated 四级，对验证门评分有差异化封顶（disputed 封得比 unreviewed 更低）（ADR-0001）。
5. **仅本地数据的验证门**：用 competency questions 给"本地图谱能多好地回答关于目标产品的问题"打分，**门评分时不联网、不查模型记忆**。
6. **agent 研究 → 候选导入流水线 + 研究任务队列**：线上研究在 app 外进行，产出带引用的 `unreviewed` 候选记录导入本地。

**定位**：开源、本地优先（local JSON）、单人 / 小团队的制造学习研究工具。双模式——前瞻式（"什么瓶颈卡住一个新兴产品的到来？"）+ 回溯式（"什么解锁了什么、何时？"）。

---

## 4. Tier A — 深度验证的 7 个竞品

### 4.1 Historical Tech Tree　🟢 *精神最接近*

- **链接**：<https://www.historicaltechtree.com/>（About：<https://www.historicaltechtree.com/about>）
- **谁做的**：Étienne Fortier-Dubois，个人项目。
- **状态 / 开源 / 定价**：活跃（站点标注 *Last updated: June 07, 2026*）；GitHub 开源、接受 PR；免费。
- **规模**：2025-05-26 公开发布时约 1,750 项技术 / 2,000 连接；2026 春已达约 2,270 项技术 / 3,100+ 连接。
- **数据模型**：单一节点类型（技术）的 **DAG** + 时间轴定位（取"首个实用版本"年份）；少量科学发现是作者自认的边缘例外。
- **✅ 相对 MinCut 优势**：与 MinCut"回溯式 what-unlocked-what"视角最同构；历史纵深与数据规模远超 MinCut 单产品 v0；完全免费开放。
- **❌ 相对 MinCut 劣势**：无分层类型（能力 / 产品 / 模块 / 工艺 / 材料），不做产品级分解；无瓶颈标记、无成本、无证据阶梯、无验证门；成熟度仅隐含于年代、无时间滑块回放；**100% 人工维护（作者亲述）**；面向公众通识而非制造研究者。
- **对 MinCut 的启示**：作者自述纯手工维护是前车之鉴——MinCut 的 agent 导入流水线正是对冲手段，但规模化效果尚未验证。

### 4.2 Gap Map (Convergent Research)　🟢 *最值得直接利用*

- **链接**：<https://www.gap-map.org/>（API：<https://www.gap-map.org/api/>；schema：<https://gap-map.org/data/schema.json>）
- **谁做的**：Convergent Research（发布博文：essentialtechnology.blog，Adam Marblestone 等，2025-04-15）。
- **状态 / 开源 / 定价**：v1.0（2025-04），© 2026 维护中；**数据完全开放（分类 JSON API + 整包 ZIP），MIT 许可**；网站本身闭源。引用格式：*Convergent Research (2025). Gap Map Database.*
- **数据模型**：三类互联实体——**R&D Gaps**（瓶颈，~101）/ **Foundational Capabilities**（基础能力，363）/ **Resources**（机构 / 资助 / 文献 / 路线图 / 白皮书 / 技术种子 / 个人，977），覆盖 20 个科学领域。方法论是**定性策展**（数百次专家访谈），官方自称"激发讨论的说明性工具"，非全面调查、非优先级路线图。
- **✅ 相对 MinCut 优势**：Tier A 中瓶颈导向数据**最开放、策展规模最大**；机器可读 JSON + schema + MIT，**可直接作为 MinCut 的 `import:candidates` 候选源**；有机构策展背书。
- **❌ 相对 MinCut 劣势**：面向跨学科科学领域，**根本不做产品的模块 / 工艺 / 材料分解**；schema 全文扫描——status / score / maturity / cost / disputed / deprecated **零字段**（即无成本、无区间、无时间戳成熟度、无回放）；证据仅单级人工审核（"Your contribution will be reviewed before being added"），无四级阶梯联动评分；非本地优先；无 agent 流水线。
- **关键证据**：验证者 curl 实测四个 JSON 端点全部 HTTP 200（gaps ~96 KB / capabilities ~221 KB / fields ~12 KB / resources ~281 KB）；下载 schema.json 全文扫描，评分 / 评审 / 成熟度 / 成本相关字段均为 0 次出现。

### 4.3 Foresight Institute Tech Trees　🟢 *前瞻瓶颈同构*

- **链接**：原 `foresight.org/tech-tree/` 已 **301 重定向**，正式引用用 Wayback：<https://web.archive.org/web/20221201191318/https://foresight.org/tech-tree/>；GitHub：<https://github.com/foresight-org/LongevityTechTree> 等五树。
- **谁做的**：非营利 Foresight Institute。
- **状态 / 开源 / 定价**：2025–26 活跃；五树托管 GitHub、接受 fork/PR、部分开放众包；免费。**范围已扩展**（2025 起新增 Secure AI Tech Tree，private ML 框架演化为 Intelligent Cooperation）。
- **覆盖领域**：longevity、原子级精密制造 / nanotech、neurotech / 脑机接口、private ML / computing、太空 / 小行星采矿。
- **数据模型**（2022-03 页面自述）：节点 + 现有项目 + **"可资助挑战"(fundable challenges)**，配套设想人力 / 资金热图。**目标用户：外部资助者(funders) 与人才(talent)**，新树亦面向研究者 / 政策制定者；目的是协调资源投入。
- **✅ 相对 MinCut 优势**：在"识别关键瓶颈"上与 MinCut 同构且属前瞻式（2025 AI 树明确以 identify key bottlenecks 为目标）；有专家网络与机构背书；部分开放众包。
- **❌ 相对 MinCut 劣势**：**领域级**科技树，而非单一工业品的 BOM 式分解；无成本 / 区间、无证据阶梯、无本地验证门、无成熟度回放；服务"资助协调"而非个人学习；量化热图多年未见落地。

### 4.4 GVCS / Open Source Ecology　🟢 *成熟度阶梯最可比*

- **链接**：<https://www.opensourceecology.org/gvcs/>
- **谁做的**：Open Source Ecology（OSE），GVCS 为其旗舰项目。
- **状态 / 开源 / 定价**：2025–26 仍活跃（页面含 2025-12 课程），但重心部分转向 Seed Eco-Home；图纸全免费、整站 CC BY-SA 4.0。
- **数据模型 / 成熟度**：目标覆盖建立"小型可持续现代文明"所需的全部 **50 台工业机器**；对每台机器用显式阶梯——**"Learning Factor-e"模型**：概念验证 → 首台原型 → 完整文档 → 可工作原型 → 开放企业模式；据此自报 2018 年整体完成度约 **1/3**。
- **✅ 相对 MinCut 优势**：与 MinCut 同属"文明 / 工业自举"知识项目且完全开放；其**人工评定的五级成熟度阶梯是 Tier A 中与 MinCut 时间戳成熟度最直接可比的机制**；产出是真能造的机器与图纸，落地性远强于纯图谱。
- **❌ 相对 MinCut 劣势**：产出是 **wiki 式机器文档而非可查询的类型化依赖图**，无法在图上推理；成熟度为人工阶段标签，无时间滑块、无证据阶梯、无瓶颈演化记录；成本目标停在宣传层、无区间汇总；无 agent；1/3 完成度为 2018 自报，且前成员曾质疑机器实际可用性。

### 4.5 OnlineWardleyMaps　🟢 *演化 / 成熟度轴的方法论标杆*

- **链接**：<https://onlinewardleymaps.com/>；源码 <https://github.com/damonsk/onlinewardleymaps>；文档 <https://docs.onlinewardleymaps.com/>
- **谁做的**：Damon Skelhorn（个人）。Wardley Mapping 方法论本身归属 Simon Wardley（CC BY-SA 4.0）。
- **状态 / 开源 / 定价**：**免费、MIT 开源**（GitHub 即站点运行源码，306★、~1,429 commits、2026-06-05 仍推送，活跃）。
- **数据模型**：**"Maps as Code"文本 DSL**（`.owm`，2018 年首现）——组件手工指定二维坐标（如 `component Customer [1, 0.4]`，即 [可见性, 演化度]），无类型 `->` 连线；`evolve` 关键字 + inertia / accelerator / deaccelerator 表达组件沿 genesis→commodity 移动；REST API 以 `.owm` 文本存取，`mapIterations` 是手动快照步进器（无时间戳 / 动画 / 回放）。约 2026-02 才补 WYSIWYG 编辑器。
- **✅ 相对 MinCut 优势**：唯一深度重叠点恰是 MinCut 核心关切之一——**能力向商品化演进的成熟度轴**；方法论生态成熟（VS Code / Obsidian 插件，OWM 为事实标准格式）；完全免费开源、社区活跃。
- **❌ 相对 MinCut 劣势**：本质是**人工摆放的战略画布**，无 Zod 式类型约束、无产品 / 模块 / 工艺 / 材料分层；成熟度无时间戳、无历史回放、无证据；无成本核算 / 区间估算、无证据分级、无瓶颈时间维度、无内建 AI（LLM 可输出 OWM 格式、第三方 AI 工具存在，但非产品功能）；面向商业战略讨论而非制造学习。
- **注**：一条称"docs 站采用 CC BY-SA 许可"的主张被 **0-3 否决**——代码为 MIT，CC BY-SA 属 Wardley 方法论本身。

### 4.6 Valispace　🟢 *成本汇总的工业级对手*

- **链接**：<https://www.valispace.com/valispace_features/engineering-budgets/>；文档 <https://docs.valispace.com/vhd/budget-table-and-chart>（© 2025）
- **谁做的**：Valispace（商业公司）。**2023-12 被 Altium 收购**（约 $15.6M；Altium 后被 Renesas 收购）。
- **状态 / 开源 / 定价**：**闭源、收费**；独立产品现标记为 legacy，以 Altium 365 Requirements & Systems Portal 延续，官方文档维护至 2025。
- **数据模型**：MBSE / 系统工程工具；**Engineering Budgets** 跟踪系统级 cost / mass / power 预算，由用户自定义公式驱动、从设计参数(Valis)**自动逐层汇总**（`soc()` = sum of children，另有 `rssoc()`/`aoc()`/`poc()`）。
- **✅ 相对 MinCut 优势**：工业级、公式驱动的**多维预算自动汇总**（覆盖成本之外的质量 / 功率，比 MinCut 仅聚焦成本更宽）；与需求管理 / 系统设计深度集成；并有 security margins + **线性不确定性传播 + worst-case 自动计算**（如"+1.28% margin, worst-case 0.238kg"），即其不确定性处理实际存在，机制为"裕度+线性传播"。
- **❌ 相对 MinCut 劣势**：闭源收费、面向工程团队而非个人学习；无证据评审阶梯、无时间戳成熟度 / 瓶颈演化、无回放、无学习导向 UX、无 agent；被收购后独立产品前景不明。
- **注**：一条"营销页无 margins / ranges"的主张是 **2-1 票、仅页面级成立**——产品文档其他页面**确有**裕度 / 线性不确定性传播 / worst-case，**不可推广为"Valispace 无不确定性能力"**。

### 4.7 Guesstimate　🟢 *不确定性数学更强*

- **链接**：<https://github.com/getguesstimate/guesstimate-app>；文档 <https://docs.getguesstimate.com/docs/theory/monte_carlo_simulations>
- **谁做的**：原作者社区，现由 **Quantified Uncertainty Research Institute (QURI)** 维护。
- **状态 / 开源 / 定价**：**开源（前端 MIT，~2.4k★、3,475+ commits，未归档）**；标语"A Spreadsheet for the Uncertain"。
- **数据模型**：**电子表格 + 蒙特卡洛**，而非领域依赖图——单元格(metric)可输入区间或概率分布，每次变更从每个输入随机抽 **5,000 样本**经公式运算，输出置信区间。
- **✅ 相对 MinCut 优势**：**不确定性数学比 MinCut 的区间算术更丰富**（完整分布形状经采样自然传播，区间算术只有上下界、易过度保守）；交互轻、上手快、完全通用。
- **❌ 相对 MinCut 劣势**：无领域类型体系（单元格公式只构成隐式 DAG）；无制造分解、无成熟度 / 瓶颈 / 时间、无证据评审、无 agent、无学习导向结构。
- **注**：一条"后端闭源、非本地优先"的主张被 **0-3 否决**——其自托管 / 本地优先程度**本轮未确证**，正反都未坐实，**不要假定可纯本地运行**。

---

## 5. Tier B — 已检索、未对抗验证（凑齐 10+，🟡 低可信）

> 已抓到来源、但主张未进对抗验证。按一般认知 + 抓取片段简述，**引用前请自查**。

| # | 项目 | 一句话 | 相对 MinCut 的关键点 |
|---|---|---|---|
| 8 | **OpenBOM** | BOM/PLM，层级化产品成本汇总 | ⚠️ **最可能挑战"MinCut 成本轴独特性"**——它就是做分层 BOM 成本 roll-up 的；但无瓶颈 / 时间 / 证据 / 学习维度，闭源 SaaS。来源：<https://www.openbom.com/blog/how-to-use-openbom-for-product-costing> |
| 9 | **Squiggle / Squiggle Hub** | QURI 出品、Guesstimate 的"代码版续作"，分布式估算 DSL，开源 | ⚠️ **挑战"估算轴"**——不确定性数学强于 MinCut；但无领域图、无分解。来源：<https://quantifieduncertainty.org/posts/announcing-squiggle-hub/> |
| 10 | **Roam / Obsidian Discourse Graph** | 用 claim/evidence/question 类型化节点做论证图，本地优先 | **MinCut「证据评审阶梯」机制最可能的近亲**，值得专项调研；但无产品分解 / 成本 / 成熟度。来源：<https://discoursegraphs.com/>、<https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/fundamentals/what-is-a-discourse-graph> |
| 11 | **Connected Papers / ResearchRabbit / Litmaps** | 文献关系图谱，有时间线视图 | 是论文引用图，非能力 / 制造分解。来源：<https://effortlessacademic.com/litmaps-vs-researchrabbit-vs-connected-papers-the-best-literature-review-tool-in-2025/> |
| 12 | **Sourcemap** | 供应链多层映射 | 有"层级分解"味道但面向溯源合规，闭源企业级。来源：<https://www.sourcemap.com/technology/supply-chain-mapping> |
| 13 | **ITONICS / Gartner Hype Cycle / PatSnap / CB Insights / Kialo** | 技术雷达·炒作周期（成熟度 / 时间方法论）、技术情报、论点地图 | 各自蹭到 1 条轴，但都是企业情报或方法论，非可查询的本地类型化图谱。来源：<https://www.itonics-innovation.com/technology-radar>、<https://www.gartner.com/en/research/methodologies/gartner-hype-cycle>、<https://www.patsnap.com/ai>、<https://en.wikipedia.org/wiki/Kialo> |

> **未抓取但已知应纳入下轮**：Obsidian / Logseq / TheBrain / Tana / Kumu.io（PKM 图谱）、Arena PLM / Duro（PLM）、Capella / Innoslate / Flow Engineering（其余 MBSE）。

---

## 6. 定位总结

### 🎯 MinCut 真正独特的（护城河）
- 不在任何单项，而在**六机制组合**——没有竞品同时具备。
- 其中两项在全部 7 个 Tier A 竞品中**逐一证实缺失**：① **四级证据评审阶梯联动评分**；② **仅本地数据的验证门**。这两点最难被替代。
- "面向单一工业品的制造级分解深度"也无人覆盖。

### ⚠️ MinCut 最弱的地方
- **数据规模 / 单人策展成本**：Historical Tech Tree（2,270+ 节点）、Gap Map（977 资源）有先发与策展规模优势。
- **不确定性数学**：区间算术弱于 Guesstimate 的分布采样、工程化不如 Valispace 的 margin / worst-case。
- **无协作 / 分享 / 众包通道**：影响数据增长与外部校验。

### 🤝 精神最接近的 2–3 个
1. **Historical Tech Tree** —— 回溯式"什么解锁了什么"依赖图 + 个人开放项目气质。
2. **Gap Map** —— 瓶颈 / 能力 / 资源三元类型模型 + 开放 MIT JSON（可直接作导入源）。
3. **Foresight Tech Trees** —— 前瞻式瓶颈识别与资源协调。
- （若只按"文明自举学习目的 + 显式成熟度阶梯"单项论，**GVCS** 最可比。）

---

## 7. 局限与诚实声明

- **覆盖缺口（最重要）**：仅 7 个项目经对抗验证；PKM、BOM/PLM、其余 MBSE、技术情报、文献图谱、供应链、讨论图谱、Squiggle 等类别无验证材料。**"MinCut 独特性"结论仅在 Tier A 集合内严格成立**；尤其 OpenBOM 与 Squiggle 可能直接挑战成本 / 估算轴的结论。
- **2 条被否决剔除**：OnlineWardleyMaps 文档站 CC BY-SA 许可说法（代码实为 MIT）；Guesstimate"后端闭源、非本地优先"说法（正反都没坐实）。
- **2 条 2-1 票带限定**：Gap Map"未公开方法学文档"略过度（有叙述性说明、无方法学规范）；Valispace 营销页"无 margins"仅单页成立。
- **时效性（核验截至 2026-06）**：Historical Tech Tree 核验前两天刚更新；OWM 的 WYSIWYG 为 2026-02 新功能；Foresight 原页已 301、关键引文靠 Wayback、范围已扩展；Valispace 收购后以 Altium 365 延续、独立产品 legacy，功能延续性应复查；GVCS 的 1/3 完成度为 2018 自报、重心已转向 Seed Eco-Home。
- **来源口吻**：Valispace 预算页、GVCS 页为厂商 / 项目自述（营销口吻），定性结论均已由技术文档或第三方独立佐证后才采用。

---

## 8. 后续研究待办（actionable）

1. **补一轮 Tier B → Tier A 验证调研**，优先级：**OpenBOM**（层级成本汇总）、**Squiggle**（分布式估算 DSL）、**Roam/Obsidian Discourse Graph**（证据阶梯近亲）——这三个最可能动摇 MinCut 的独特性结论。
2. 确认 **Guesstimate 完整技术栈**（guesstimate-server 后端）是否开源、能否纯本地 / 自托管——直接关系它在"开放 / 本地优先"轴上与 MinCut 的远近。
3. 确认 **Altium 365 Requirements & Systems Portal** 是否完整保留 Valispace 的 margin / worst-case 预算汇总；调查现有 MBSE / 估算工具中是否存在真正的**区间算术**实现（而非线性传播 / 采样），供 MinCut 对标或证伪其方法选择。
4. 专项核查：**是否存在任何现成工具把证据评审状态（类似 unreviewed/reviewed/disputed/deprecated 阶梯）与节点评分联动**——Roam / Obsidian discourse graph 生态是该机制最可能的近亲。
5. 纳入未抓取的已知项目：Obsidian / Tana / TheBrain / Kumu、Arena PLM / Duro、Capella / Innoslate。

---

## 9. 全部来源清单（按搜索角度，省去重搜）

**角度 1 — 近亲开放项目（科技树 / 差距地图 / 工业自举）**
- <https://www.historicaltechtree.com/>（含 /about）
- <https://foresight.org/tech-tree/>（已 301 → 用 Wayback 存档）
- <https://www.gap-map.org/>（含 /about、/contribute、/api/、/data/schema.json）
- <https://www.opensourceecology.org/gvcs/>

**角度 2 — 能力演化与成熟度映射（Wardley Mapping）**
- <https://onlinewardleymaps.com/> · <https://github.com/damonsk/onlinewardleymaps> · <https://docs.onlinewardleymaps.com/>
- <https://learnwardleymapping.com/2024/06/24/top-5-wardley-mapping-tools-for-2024/> · <https://learnwardleymapping.com/tools/>
- <https://github.com/wardley-maps-community/awesome-wardley-maps>

**角度 3 — 工程分解 / BOM 成本汇总 / 区间估算**
- <https://www.valispace.com/valispace_features/engineering-budgets/>（文档 <https://docs.valispace.com/vhd/budget-table-and-chart>）
- <https://github.com/getguesstimate/guesstimate-app>
- <https://quantifieduncertainty.org/posts/announcing-squiggle-hub/>
- <https://www.openbom.com/blog/how-to-use-openbom-for-product-costing>

**角度 4 — 图谱化知识 / 证据评审 / 文献图谱**
- <https://discoursegraphs.com/>
- <https://oasis-lab.gitbook.io/roamresearch-discourse-graph-extension/fundamentals/what-is-a-discourse-graph>
- <https://effortlessacademic.com/litmaps-vs-researchrabbit-vs-connected-papers-the-best-literature-review-tool-in-2025/>
- <https://en.wikipedia.org/wiki/Kialo>

**角度 5 — 商业技术情报 / 供应链图谱 / 路线图**
- <https://www.cypris.ai/insights/top-8-tech-scouting-platforms-for-enterprise-r-d-teams-in-2025>
- <https://www.sourcemap.com/technology/supply-chain-mapping>
- <https://www.itonics-innovation.com/technology-radar>
- <https://www.patsnap.com/ai>
- <https://www.gartner.com/en/research/methodologies/gartner-hype-cycle>
- <https://prospeo.io/s/cb-insights-alternatives>

---

## 10. 给 MinCut 的可执行建议

1. **Gap Map 直接接入**：MIT 许可的 gaps / capabilities / resources JSON 可作为 `import:candidates` 的现成候选源，省一部分手工策展。
2. **把证据评审阶梯 + 本地验证门当作对外主打差异点**——这是全部 7 个 Tier A 竞品都没有的两件事。
3. **重新审视区间算术的取舍**：是否对关键瓶颈引入 Guesstimate / Squiggle 式分布采样？这是 MinCut 成本轴目前相对最弱的一环。
4. **对冲单人策展瓶颈**：Historical Tech Tree 纯手工维护是前车之鉴，agent 导入流水线的规模化效果需尽快用真实数据验证。
