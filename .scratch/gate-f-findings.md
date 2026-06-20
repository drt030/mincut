# Gate F — Browser User-Flow Findings (domain-expansion acceptance standard §7.5)

**Reviewer:** adversarial QA (Gate F, per docs/QA-agent.md)
**Date:** 2026-06-16
**Method:** real Chrome via chrome-devtools MCP, viewport 1512×950 (desktop) + 390/500px (mobile).
**Routes under test:** `/d/spacex-reusable-launch`, `/d/humanoid-robotics`.
**Flagship baseline:** `/d/ai-compute`.
**Contract:** Gate F passes only with **0 blocker/major rendered-product findings** (§8). Both domains were already "data-accepted (A–E), user-flow PENDING".

---

## 0. Verdict summary

| Domain | Gate F verdict | Blockers | Majors | Rendered nodes (vs flagship 69) |
|---|---|---|---|---|
| `spacex-reusable-launch` | **FAIL** | 0 | 2 | 36 (52% of flagship) |
| `humanoid-robotics` | **FAIL** | 0 | 2 | 58 (84% of flagship) |

Both fail on the **same root cause (FF-1)**: the exposure paywall **leaks real supplier identities + tickers** for cross-domain orgs on gated audit-preview routes — directly contradicting the gating business model. This is shared infra (`stripExposureLayer`), so it fails *both* domains. Secondary majors differ per domain.

A blocker was *considered* for FF-1 (it defeats the paywall = "invalidates the product promise") but held at **major** because the leak is partial (only `manufactured_by`/`implemented_by` cross-domain orgs, surfaced in one rail section), the graph/evidence still gate correctly, and the gated orgs (with the domain's own tag) ARE correctly redacted to "locked supplier". If the owner treats paywall integrity as the product promise, escalate FF-1 to blocker.

---

## 1. Baseline calibration (flagship `/d/ai-compute`)

- Rendered radial tree: **69 nodes / 74 edges**, clean console (Vercel analytics only).
- Subsystem hues distinct (fab teal / interconnect green / packaging magenta / advanced-packaging orange). Bottleneck-risk lens weights edges red.
- Clicking HBM surfaces the **full supplier teaser**: "公司和股票候选 / 3 个候选" (3 candidates) — SK海力士 (000660.KS, share 70%), 三星 (005930.KS), 美光 (MU) — each with ticker + country + share + a "Top connected leads, not a complete exposure list" disclaimer.
- This is the *ungated* reference. Gated domains correctly strip the NAMES; the question Gate F asks is whether they still quantify the locked value and don't leak. They do neither cleanly.

Data shape (for rendered-vs-data context):

| Domain | total | orgs (stripped server-side) | non-org renderable | materials | rendered focal tree | edges (data) |
|---|---|---|---|---|---|---|
| ai-compute | 205 | 91 | 114 | 33 | 69 | 312 |
| spacex | 74 | 47 | 27 | 13 | **36** | 100 |
| humanoid | 129 | 47 | 82 | 2 | **58** | 152 |

SpaceX is genuinely thin on decomposition (only 27 non-org renderable nodes; 64% of its data is org nodes). Humanoid is near flagship density.

---

## 2. SpaceX reusable launch — `/d/spacex-reusable-launch`

**Rendered tree:** 36 nodes / 35 edges. Console: clean (no errors).
**Gray nodes (6, all by-design materials):** stainless steel, Al-Li plate, titanium mill, helium, LOX, LCH4 — `hsl(0,0%,60%)`, applySectorAngles Rule 4 hash-placed. NOT a defect; noted under FF-7 as a UX observation only.
**No `unknown`-maturity NON-org nodes** (all 44 `unknown`-maturity nodes are organizations, which correctly carry no maturity). The Day-0 "16 unknown-maturity nodes" debt is resolved. **F4 PASSES** on non-org nodes.

### FF-1 (major · data_model) — Exposure paywall leaks real cross-domain supplier names + tickers
- **Surface:** RouteDetailRail → `detail-secondary-research` → "Modeled manufacturer links". `src/lib/exposureGate.ts` `stripExposureLayer` + `GATED_DOMAINS`.
- **Repro:** `/d/spacex-reusable-launch?root=spacex_reusable_launch_stack&focus=liquid_oxygen_lox_supply` → Detail tab → "Modeled manufacturer links" renders **"Linde plc · LIN — Public listing: LIN — Linde is SpaceX's main industrial-gas supplier of liquid oxygen…"**. Full org name + ticker + narrative, on a gated audit-preview route.
- **Root cause:** `stripExposureLayer` hides an org only if the org's OWN `domain` array contains a gated chain tag (exposureGate.ts:49-56). Cross-domain orgs defined in another domain's node file (e.g. `org_linde` lives in `parcel_sorting_robot.json` with domain `["industrial_gas",…]`) carry NO `spacex_reusable_launch` tag, so they bypass stripping even when rendered inside the SpaceX (gated) graph via a `manufactured_by`/`implemented_by` edge.
- **Scope (SpaceX):** 6 cross-domain orgs reachable from gated nodes — Eaton, Schaeffler, SKF, Air Liquide, Linde, DuPont. Those reached via `manufactured_by` (Linde ← LOX) leak in the rail; `reported_capable_supplier` ones don't currently render in this section but ARE one relation-type change away from leaking.
- **Impact:** Defeats the paid-exposure business model: the value the user is meant to pay for (who makes it + ticker) is shown for free for any supplier that also exists in a free/other chain. Also asymmetric/confusing: same node shows "locked supplier" for in-domain orgs and a real name for cross-domain ones.
- **Fix direction:** gate on **view context** (the gated route being rendered), not solely the org's own `domain`. Either (a) strip any org whose only path into a gated graph is via that graph's edges, or (b) redact cross-domain org prose to "locked supplier" in gated render. Add a regression test asserting no org `name`/`ticker` survives in a gated graph's rail.

### FF-2 (major · ux) — Supplier-rich nodes do not quantify the locked value (no per-node teaser)
- **Surface:** RouteDetailRail node detail (both Start-here and Detail tabs).
- **Repro:** focus `aerospace_titanium_mill_product` (headline bottleneck; data has 3 holders: ATI, TIMET, VSMPO). Detail tab shows investor brief + "4 条来源" but the only supplier signal is "locked supplier" inside evidence prose. **No "N suppliers · M listed · top-2 >X%"** teaser. `detail-exposure-evidence-summary` and `exposure-lock-cta` are **absent** from this rail (they live in the `/graph` NodeDetailPanel, not the `/d/<slug>` RouteDetailRail).
- **The only count** surfaces (a) **domain-wide**, not per-node ("24 organization records are modeled for QA but not shown here"), and (b) only after clicking the "公司 / 查看可用性" link on the Start-here tab — which **navigates away** to a different node, so it never describes the node the user was inspecting. Per-node `hiddenOrgCount`/holder-count teaser (`useHolderTeaser`/`holderSummary`) only renders for `isKnowHowNode` nodes (NodeDetailPanel.tsx:277), never for product/material nodes like titanium.
- **Impact:** the paywall shows a locked door without telling the user how much is behind THIS node. A researcher on the titanium chokepoint sees "locked supplier" with no indication 3 suppliers / top-2 concentration sit behind it. Weakens the upgrade pitch exactly where it should be strongest.
- **Fix direction:** render a per-node locked teaser on RouteDetailRail for any node with ≥1 hidden holder: "N suppliers · M listed · top-2 >X%" using the pre-strip holder count (count survives even when names are stripped). Reuse `exposureCandidateAuditPreviewFallback` but bind `{n}` to the node's holder count, not the domain total.

### FF-3 (major→minor · data_model/i18n) — zh mode leaks English node descriptions / bottleneck-thesis
- **Surface:** `LanguageProvider.tsx` node dictionary; RouteDetailRail "核心判断"/"具体卡点" bodies.
- **Repro:** zh mode, focus titanium → header/lens/labels are zh ("航空级钛材轧制品") but the body reads **"Aerospace-grade titanium mill products (plate, bar, billet…)…它重要，因为…"** — English description spliced into a Chinese sentence. Same on the root node and every node checked.
- **Root cause:** `LanguageProvider.tsx` maps node id → zh **name only** (79 spacex entries); there is no zh map for `description`/notes/metric text. Node files have `name`+`description` in EN, no `descriptionZh`. `tests/languageCoverage.test.ts` only checks **names** (line 41), so A7 passes while descriptions leak — the gate has a blind spot.
- **Impact:** the primary research content (the "core judgment" a Chinese user reads) is in English. Severity is major for a zh-primary audience; minor if EN-first. EN side is fully consistent.
- **Fix direction:** add zh `description`/bottleneck-thesis coverage (sidecar or LanguageProvider) and extend languageCoverage.test.ts to assert description coverage, not just names.

### FF-4 (opportunity) — SpaceX tree is half the flagship; reads thinner
- 36 rendered vs 69 flagship. Justified by data (only 27 non-org renderable nodes), but the radial still communicates Falcon-9 vs Starship vs ground vs common-enablers branch structure clearly (F3 graph-as-map PASSES). Not a defect; flag that SpaceX's decomposition is the least deep of the three and is the domain most likely to read as "thin" to a paying user.

### Passing on SpaceX
- F3 graph renders as a readable radial map; branch identity stable across lens/layer toggles.
- F4 no gray/unclassified non-org nodes (the 6 grays are by-design materials).
- Lens overlays (系统分解/成本驱动/瓶颈风险/成熟度) all present; Maturity lens correctly re-weights EDGES (node identity stable) per ADR-0007.
- EN↔zh toggle switches the whole chrome cleanly; no layout break; lens toggle not truncated at desktop.
- Console clean throughout.

---

## 3. Humanoid robotics — `/d/humanoid-robotics`

**Rendered tree:** 58 nodes / 57 edges (strongest of the three; 84% of flagship). Console: clean.
**Gray nodes (2, both by-design materials):** rare-earth magnets, high-stiffness low-mass materials. **No unexpected gray.** Subsystem hues richly distributed (actuation orange, perception purple, thermal pink/magenta, compute blue, structure pink, battery yellow, manipulation green). Radial geometry clearly signals actuation + perception are the most complex subsystems WITHOUT a side list — **F3 strongly PASSES**.

### FF-1 (major · data_model) — same cross-domain exposure leak, worse here
- **Repro:** `/d/humanoid-robotics?...&focus=humanoid_rare_earth_magnet_supply` → Detail → "Modeled manufacturer links" renders **"MP Materials · MP — Global rare-earth supply from Mountain Pass: 10% — Public listing: MP — MP Materials began trial production of sintered NdFeB magnets at its Fort Worth Independence facility (~1,000 t/yr…)"**. Real name + ticker + share + narrative, on a gated route.
- **Scope (humanoid):** **9 cross-domain orgs leak** — Schaeffler, MP Materials, Renishaw, HEIDENHAIN, Broadcom, NSK, THK, NTN, Henkel (`org_*` defined in other domain files, no humanoid gated tag). Worse than SpaceX (6) because more humanoid holders are shared bearing/magnet/encoder suppliers.
- Same root cause + fix as §2 FF-1.

### FF-2 (major · ux) — no per-node supplier teaser / value quantification
- Same defect as §2 FF-2. On the rare-earth magnet chokepoint (the marquee humanoid bottleneck) the rail shows "6 sources" + the leaked MP Materials block, but **no "N suppliers · M listed · top-2 >X%"** quantification of the held-back exposure. Domain-wide count path same as SpaceX.

### FF-3 (minor · i18n) — zh description leak
- Same mechanism as §2 FF-3. zh mode shows zh names but English descriptions ("NdFeB-class magnet supply that affects compact motors…它重要，因为…"). Humanoid has its own ~node-name zh entries but no description zh.

### FF-5 (minor · performance/correctness) — Cmd+K search returned a stale/empty index once (intermittent, NOT cleanly reproducible)
- **Observed once:** after a heavy mixed cross-domain navigation sequence, Cmd+K on the humanoid page returned "No matches" for battery/motor/roller/humanoid, and typing "a" surfaced **SpaceX** nodes (Aerospace Al-Li, Falcon 9 avionics) — i.e. the search index held the previous domain's nodes.
- **Could not reproduce** on: fresh load (battery → 6 correct humanoid hits), Know-how toggle (motor → correct), in-app focus navigation (roller → correct). So Cmd+K works in normal flows; the stale state appears tied to some navigation race, not a steady-state bug. Reported at low confidence — worth a guarded look at when the command-palette index rebuilds vs when graph data swaps, but do NOT treat as a confirmed major.
- Cmd+K itself: opens correctly ("Search nodes by name, metric, or description…"), fuzzy-matches name+description, lists results with constraint tags.

### FF-6 (minor · accessibility/ux, mobile) — 4th lens ("Maturity") overflows off-screen at ≤500px without a scroll affordance
- At 390/500px the lens row's container is `overflow-x: visible` and scrollWidth>clientWidth; "Maturity" sits at x≈529 (off the 500px viewport), `inViewport:false`. No horizontal scrollbar; reachable only via awkward body pan. Applies to all domains (shared control). Fix: `overflow-x:auto` + scroll-snap, or wrap, on the mobile lens row.

### Passing on humanoid
- F3 graph renders as the best map of the three; subsystem complexity legible from geometry.
- F4 no gray/unclassified non-org nodes.
- Mobile (390px): detail rail stacks cleanly, "Top blockers" badges + investor-brief mini-grid readable, graph lazy-renders all 58 nodes on scroll, no horizontal overflow of the page.
- EN↔zh chrome toggle clean. Console clean. Gate route (`/gate`) loads, computes the parcel target from local data, status "failed 3/5" (honest gap exposure, no invented confidence).

---

## 4. Cross-cutting (both domains)

- **Server-side org stripping works for in-domain orgs** (correctly redacted to "locked supplier"; 0 `org_*` nodes in either rendered graph; 0 `rf__node-org_*`). The leak (FF-1) is strictly the cross-domain-org gap.
- **Detail rail used on `/d/<slug>` is `RouteDetailRail`, not `NodeDetailPanel`.** The richer exposure teaser/lock-CTA built into NodeDetailPanel (`detail-exposure-evidence-summary`, `exposure-lock-cta`, per-node holder teaser) is on `/graph` only — so the domain landing pages never show it. This is the structural reason FF-2 exists.
- **audit-preview path deliberately omits the org count `{n}`** (RouteDetailRail.tsx:628-638 exposurePointOfNeed for audit-preview has no `{n}`, unlike the `locked` branch). The 24-org count only leaks through `exposureCandidateAuditPreviewFallback` in the (graph-only) NodeDetailPanel.
- No runtime errors, overlays, blank canvases (after layout settle), or broken navigation observed on either route.

---

## 5. Top 5 fixes (priority order)

1. **FF-1 — close the cross-domain exposure leak** (data_model, both domains). Gate stripping on the rendered route's domain, not the org's own `domain`; redact cross-domain org name/ticker/prose in gated graphs. Add a regression test: "no organization name or ticker string survives in a gated `/d/<slug>` rail." Highest priority — it nullifies the paid product.
2. **FF-2 — per-node locked supplier teaser** (ux, both). On RouteDetailRail, for any node with ≥1 hidden holder show "N suppliers · M listed · top-2 >X%" from the pre-strip holder count. Quantify the paywall where the researcher actually is.
3. **FF-3 — zh description coverage + gate it** (i18n, both, weighted by zh-primary audience). Translate node `description`/bottleneck-thesis/metric text; extend `languageCoverage.test.ts` beyond names so A7 catches the gap.
4. **FF-6 — mobile lens row scroll** (accessibility). `overflow-x:auto`/wrap so "Maturity" is reachable ≤500px.
5. **FF-5 — investigate Cmd+K stale-index race** (low confidence). Confirm the command-palette index rebuilds when graph data swaps; only a real fix if reproducible.

(FF-4 SpaceX thinness is an owner content call, not an engineering fix.)
