# Launch Detail Rail Priority Spec

**Date:** 2026-06-12
**Status:** Historical draft, superseded for current acceptance by
`docs/ACCEPTANCE.md`, `docs/QA-agent.md`, and `docs/GRAPH_UX.md`.
Do not implement this document literally without first updating it to the
2026-06-17 Chokepoint / Cost / Barrier Sources vocabulary.
**Scope:** `/d/<slug>` detail rail, selected-node detail, product detail summary, exposure access messaging, and bilingual copy.
**Non-scope for this worker:** production code, tests, data edits, paywall logic changes, checkout changes.

## Brief

The launch surface at `drt030.com` is a retail-focused chokepoint map for industry and investment research readers. The first screen after opening `/d/ai-compute` or selecting a node should answer:

1. Why this node matters in the chain.
2. Whether it is a Chokepoint, and which structural axis drives it.
3. What the free layer already includes.
4. What the paid exposure layer adds.
5. What the reader should inspect next.

The UI should stop leading with internal graph-database metadata. Raw kind pills, domain tags, raw maturity score, exhaustive upstream/downstream lists, and research-root controls are useful to operators but should not dominate the launch first viewport. Current copy should use Chokepoint, Cost, and Barrier Sources rather than the older Heat/Risk vocabulary.

## Local Context Read

Source docs and code inspected:

- `docs/plans/MASTER-PLAN.md`
- `docs/plans/2026-06-09-commercial-launch-week.md`
- `docs/design-principles.md`
- `docs/superpowers/specs/2026-06-10-product-knowhow-layers-design.md`
- `src/components/RouteDetailRail.tsx`
- `src/components/NodeDetailPanel.tsx`
- `src/components/ProductView.tsx`
- `src/components/ExposureAccessBanner.tsx`
- `src/components/ExposureLockCta.tsx`
- `src/components/LanguageProvider.tsx`
- `src/components/EvidenceList.tsx`
- `src/components/GraphExplorer.tsx`
- `src/app/d/[slug]/page.tsx`
- `src/app/globals.css`
- Relevant tests: `tests/routeDetailRail.test.ts`, `tests/detailRail.test.ts`, `tests/productView.test.ts`, `tests/exposureAccessBanner.test.ts`

Current state:

- `/d/[slug]` loads a route-specific graph, computes holder teasers from the full graph, strips exposure server-side, renders `ExposureAccessBanner`, then renders `GraphExplorer`.
- `/d/ai-compute` is the full-free trust demo; current paid/future-paid boundaries are route-specific and must match `src/lib/domains.ts`.
- `GraphExplorer` should expose the current reader-facing lenses: System decomposition, Chokepoint, and Cost.
- `RouteDetailRail` should lead with Chokepoint verdict, elevated structural axis, Cost as separate magnitude, Barrier Sources, exposure state, and evidence state.
- `NodeDetailContent` already contains most launch-relevant information, but the order is mixed: kind/domain pills appear first; then priority strip; then investor answer/product-specific sections; then many technical sections and lists.
- `ExposureAccessBanner` explains free vs paid at the top of the route, but exposure status is not yet tightly integrated into selected-node first-screen reading.
- `ExposureLockCta` renders locked exposure CTAs where candidate exposure would appear.
- `EvidenceList` shows review status and confidence per evidence item, but selected-node first-screen lacks a compact reviewed/unreviewed evidence status summary.

## Launch IA Contract

Free layer stays visible:

- decomposition structure
- bottlenecks
- Heat
- component-level evidence
- validation trail

Paid exposure layer:

- supplier identities beyond free teasers
- tickers/listing
- market-share/capacity signals
- organization-level evidence
- future updates to the chain

Phase 1 must not introduce depth gating, auth, databases, client-side leakage, or a new graph model. It should reorder and summarize existing local graph data.

## Information Priority

### Raise To First Screen

These should be visible above the fold in the route rail or selected-node detail:

- **Plain-language node role:** one sentence grounded in existing `description`, current root context, `requires` edges, and `bottleneckOf`.
- **Top bottleneck / Heat:** Heat `N/100`, with wording that it is a relative pressure signal, not a probability.
- **What it blocks:** if `bottleneckOf` exists, say which parent/product this node gates; if the selected node has top blocker children, show the top 2 or 3.
- **Exposure state:** locked, unlocked, or full-free demo state near the selected-node summary, not only in the page banner.
- **Reviewed evidence status:** compact count such as `2 reviewed / 5 total evidence records`, or `No direct evidence yet`.
- **Next 2-3 things to inspect:** top blockers, evidence gap, exposure layer, or highest-Heat child depending on node type and available data.

### Demote Or Collapse

These remain available but should not lead the first viewport:

- `domain` tags such as `ai_compute_chain`, `investable_supplier`, `semiconductor_equipment`
- raw `kind` pills as the first visual element
- raw maturity score and maturity history
- raw opportunity/composite scores
- exhaustive upstream/downstream/sibling lists
- full metric dumps and empty metric rows
- `targetContext` key/value dumps
- organization exposure lists when the current chain is locked
- internal research root controls, including `Set as research root`
- operator-style wording such as "Investor answer panel" if it reads like an internal module label rather than a reader promise

## Component-Level Spec

### `ExposureAccessBanner`

Keep the route-level banner, but make it a route context marker rather than the only exposure explanation.

Locked AI compute state:

- Eyebrow: `Access state`
- Title: `{n} suppliers hidden in the paid exposure layer`
- Body should explicitly say the free map remains useful.
- Free vs paid comparison stays visible on desktop.
- On mobile, comparison stacks without pushing the graph too far below the fold.

Unlocked AI compute state:

- Title: `Exposure layer unlocked`
- Body: supplier identities, listing signals, and org evidence are visible for this chain.
- Do not show the unlock CTA.

Parcel full-free demo state:

- Title: `Full free demo: exposure layer included`
- Body: this route shows what an unlocked chain looks like.
- Do not imply a paid upsell is required for this route.

### `RouteDetailRail` Route Tab

Default route tab should read like "where to start", not a generic ranked list.

Recommended order:

1. Header: chain or current root title, plus compact access state chip.
2. `Start here` card:
   - top Heat node
   - Heat `N/100`
   - evidence status for that top node, if cheap to compute
   - locked/unlocked/full-free exposure state
3. `Key chokepoints` list:
   - show 3 primary entries by default, not a visually equal list of 5 if space is tight
   - each entry shows node name, plain role fallback, Heat, and review/evidence status
   - action text should imply inspection: `Inspect`, `查看`
4. Secondary collapsed groups:
   - major subsystems
   - primary cost chain
   - least mature dependencies

For Phase 1, this can reuse existing `priorityEntries`, `nodeRisk`, `nodeName`, and `compactDescription`. Do not add a new ranking algorithm.

### `RouteDetailRail` Selected Summary

Current selected summary should become the reader-facing first screen when a node is selected and route tab remains active.

Recommended order:

1. Node name.
2. Plain-language role sentence.
3. Signal row:
   - Heat
   - bottleneck role
   - evidence status
4. Exposure mini-card:
   - locked: `Exposure layer locked: {n} suppliers hidden for this chain`
   - unlocked: `Exposure layer unlocked: supplier/listing evidence is visible`
   - parcel full-free: `Full-free demo: exposure visible here`
5. `Inspect next` links, max 3.
6. Short description.
7. Advanced action area:
   - `Set as research root` moves below the reader summary or into a collapsed `Research controls` section.

Avoid showing domain tags or raw kind in this summary. If kind is useful, use it as a small muted label after the role sentence, not as the primary content.

### `NodeDetailContent`

This is the full detail tab and can keep richer information, but it should still start with launch-relevant answers.

Recommended order:

1. Node name with deprecated/disputed badges if present.
2. Plain-language role sentence.
3. `Why it matters` card:
   - Heat
   - bottleneck role
   - evidence status
   - exposure state
4. Product-only or module-only `Chokepoint readout`:
   - top risk bottleneck
   - throughput constraints if present
   - cost gap only when product target exists and coverage is not misleading
5. `Inspect next` section:
   - top 2-3 blockers or child dependencies
   - evidence gap callout when no direct evidence
   - exposure CTA when locked
6. `Evidence trail` preview:
   - status counts
   - first 2 records, prioritizing `reviewed`, then `disputed`, then `unreviewed`
   - full list in collapsible details if long
7. `Technical details` collapsed:
   - raw kind and domain tags
   - maturity score/history
   - full metrics
   - target context
   - exhaustive upstream/downstream/sibling lists
   - internal research controls

The phase should preserve all current information. The change is default visibility and ordering, not data removal.

### `ProductView`

`ProductView` is a product-detail page, but launch readers may land there from rail links. It should follow the same priority:

1. Product role and target context in plain language.
2. Top chokepoint / Heat.
3. Exposure state.
4. Evidence status.
5. Next sections to inspect.
6. Cost, maturity, metrics, required modules, and full evidence below.

Rename or wrap the current `Investor answer panel` with reader-facing copy such as:

- EN: `Chokepoint readout`
- ZH: `瓶颈读数`

Keep "not investment advice" framing where appropriate. The product can serve investment research readers without sounding like a stock-tip product.

### `LanguageProvider`

All visible copy must have English and Simplified Chinese keys. New copy should avoid raw schema names in reader-facing labels.

Recommended copy families:

| Intent | English | Simplified Chinese |
|---|---|---|
| Node role | `Why this node matters` | `这个节点为什么重要` |
| Heat | `Heat {n}/100` | `Heat {n}/100` or `热度 {n}/100` |
| Heat explanation | `Relative pressure signal, not a probability.` | `相对压力信号，不是概率。` |
| Exposure locked | `Exposure layer locked` | `Exposure 层已锁定` |
| Exposure unlocked | `Exposure layer unlocked` | `Exposure 层已解锁` |
| Full-free demo | `Full-free demo: exposure included` | `完整免费 Demo：已包含 exposure 层` |
| Evidence status | `Evidence status` | `证据状态` |
| Inspect next | `Inspect next` | `下一步查看` |
| Technical details | `Technical details` | `技术细节` |
| Research controls | `Research controls` | `研究控制项` |

Use `nodeName(id, fallback)` for node names. Do not hard-code Chinese node names outside the existing translation dictionary.

## Phase 1: Launch-Safe Minimal Change

Goal: make the existing `/d/ai-compute` and `/d/parcel-robot` first screens read correctly for launch without touching schema, data import, gating, or graph layout.

### Design Defaults

- Use existing data only.
- Generate role sentences from existing descriptions and graph relations; do not invent new claims.
- Keep Heat as `N/100`, never `%`.
- Keep full data accessible below or inside collapsible sections.
- Keep route-level `ExposureAccessBanner`, but add selected-node exposure state inside the rail.
- Do not change `stripExposureLayer` behavior.

### Proposed Execution Tasks

**P1-A: Build a reader-summary presentation layer**

- Owned surface: `RouteDetailRail.tsx`, `NodeDetailPanel.tsx`, optionally small local helper functions.
- Behavior:
  - derive role sentence
  - derive evidence status counts
  - derive access state label from route/domain context
  - derive inspect-next candidates from existing top blockers and direct evidence gaps
- Out of scope:
  - new schema fields
  - new scoring
  - data edits
- Validation:
  - unit coverage for role/evidence/access ordering through component static render tests

**P1-B: Reorder `RouteDetailRail` route and selected-node summary**

- Owned surface: `RouteDetailRail.tsx`, route rail CSS.
- Behavior:
  - route tab leads with start-here/top chokepoint
  - selected summary leads with role, Heat, evidence, exposure, inspect-next
  - domain tags and raw kind leave the first summary
  - research-root action demoted
- Out of scope:
  - changing canvas layout
  - changing ranking semantics
- Validation:
  - `tests/routeDetailRail.test.ts`
  - browser check on `/d/ai-compute` desktop and mobile

**P1-C: Reorder `NodeDetailContent` full detail**

- Owned surface: `NodeDetailPanel.tsx`, `EvidenceList.tsx` only if evidence preview is extracted.
- Behavior:
  - top of full detail mirrors reader priority
  - evidence status appears near top
  - full evidence and raw technical detail remain accessible
  - upstream/downstream lists are no longer above first reader answers
- Out of scope:
  - changing evidence records
  - changing review status semantics
- Validation:
  - `tests/detailRail.test.ts`
  - add or adjust static markup assertions so `Why this node matters` and `Evidence status` precede raw technical sections

**P1-D: Product page parity**

- Owned surface: `ProductView.tsx`.
- Behavior:
  - rename/wrap `Investor answer panel` as reader-facing `Chokepoint readout`
  - exposure state and evidence status visible above cost/maturity/metric detail
  - parcel product remains a full-free demo
- Out of scope:
  - redesigning product page layout
  - adding new product routes
- Validation:
  - `tests/productView.test.ts`

**P1-E: Copy, styling, and responsive polish**

- Owned surface: `LanguageProvider.tsx`, `globals.css`.
- Behavior:
  - all new labels in EN/ZH
  - mobile rail text wraps cleanly
  - no text overflow in chips/buttons/cards
  - no nested cards inside cards where avoidable
  - lock/unlock/full-free states have non-color cues
- Validation:
  - `tests/languageCoverage.test.ts`
  - `npm run verify`
  - `npm run build`
  - `npm run verify:ui` if UI routing or meaningful app surface changes occur

### Phase 1 Acceptance Criteria

Desktop, `/d/ai-compute`, locked/no entitlement:

- First viewport shows the locked exposure state.
- Selecting a high-Heat node shows role, Heat, bottleneck/evidence status, and locked exposure mini-card above raw tags.
- No hidden supplier identities, tickers, org evidence, or org-only names leak in locked state.
- The reader can still inspect decomposition, bottlenecks, component evidence, and validation context for free.

Desktop, `/d/ai-compute`, unlocked entitlement:

- Banner and rail both show unlocked exposure state.
- Exposure sections show supplier/listing/org evidence where available.
- Unlock CTA is absent or clearly inactive.

Desktop, `/d/parcel-robot`:

- Banner and rail state say full-free demo.
- Supplier/exposure examples are visible without entitlement.
- Copy makes clear this is what an unlocked chain looks like.

Mobile, 360-430px wide:

- `/d/ai-compute` banner stacks without clipping.
- Graph remains usable enough to select a node; rail below graph shows the same priority order.
- Route rail max-height does not trap the first important card below a long internal list.
- Buttons and tabs do not overflow.

Chinese:

- New copy has Simplified Chinese translations.
- `nodeName` fallback works for graph node display names.
- No English-only control labels in the new first-screen priority surface.

Automated:

- `npm run verify` passes after implementation.
- `npm run build` passes for UI/app-router changes.
- `npm run verify:ui` passes or the implementer records why browser verification was not reliable.

## Phase 2: Richer Reader Workflow

Goal: move beyond launch-safe ordering into a reader workflow that helps industry/investment readers traverse a chain without learning graph-editor concepts.

### Phase 2 Ideas

1. **Reader path mode**
   - A persistent `Start here -> Bottleneck -> Evidence -> Exposure -> Next node` reading path.
   - Deep links preserve root, selected node, lens, and rail state.
   - Works for launch threads and newsletter links.

2. **Evidence trail summary**
   - Dedicated evidence-status component with reviewed/unreviewed/disputed counts.
   - Shows what was reviewed by humans vs agent-generated/unreviewed.
   - Full evidence list remains available for audit.

3. **Exposure layer tray**
   - Locked state: counts and categories only, no identities.
   - Unlocked state: supplier identities, listing status, market-share/capacity signals, org evidence.
   - Free teaser suppliers are clearly labeled as trust-building previews.

4. **Freshness and update log**
   - Per-domain `Updated <date>` and `What changed` line.
   - Supports the Master Plan value-layer doctrine: future updates are part of the paid exposure value.

5. **Reader-facing node summaries in graph data**
   - If role sentences become important claims, move them from derived UI copy into explicit graph metadata with evidence/review status.
   - Keep Phase 1 derived summaries limited to restating existing description and relation data.

6. **Mobile reader mode**
   - A list-first mode for mobile readers where the graph is still present but the chokepoint reading path is the primary navigation.
   - This is separate from Phase 1, because the launch-safe change should not redesign the canvas.

## Review-First Design Notes

Implementation should wait for main-agent review of this section:

- The main question is whether Phase 1 should introduce a route/domain access context into `RouteDetailRail`, or whether the rail should infer only from existing `locked` summaries.
- `lockedEntry === null` currently means either "unlocked", "full-free", or "nothing hidden". The selected-node rail needs a clearer access-state input if it must distinguish these states reliably.
- Role sentences must be derived and conservative. They should not create new supply-chain claims that are not already in node descriptions, edges, or evidence.
- Evidence preview ordering should not imply `unreviewed` evidence is verified. The status label must remain visible.

## Suggested Test Matrix

Static/component tests:

- `RouteDetailRail` locked state renders exposure status before raw technical tags.
- `RouteDetailRail` selected summary renders `Why this node matters`, Heat, evidence status, and `Inspect next`.
- `RouteDetailRail` does not show domain tags in the first selected summary.
- `NodeDetailContent` full detail keeps raw tags and exhaustive lists inside or below `Technical details`.
- `ProductView` shows `Chokepoint readout` before cost/maturity/required modules.
- `ExposureAccessBanner` retains locked, unlocked, and full-free states.
- New translation keys covered by `languageCoverage`.

Browser checks:

- `/d/ai-compute` locked, desktop 1440x900.
- `/d/ai-compute` unlocked, desktop 1440x900, using a test entitlement cookie or local entitlement fixture.
- `/d/parcel-robot` full-free, desktop 1440x900.
- `/d/ai-compute` locked, mobile 390x844.
- Same key checks in Chinese.

Leak checks:

- Locked AI compute should not expose stripped supplier names in HTML, rail text, evidence snippets, or org-only evidence.
- Parcel route should still expose its full-free demo suppliers.

## Risks

- **Ambiguous access state:** current rail only sees locked summaries indirectly; it may need explicit route access context to distinguish unlocked from full-free.
- **Overclaiming role copy:** derived role sentences must not add unsupported claims.
- **Mostly unreviewed AI compute evidence:** showing evidence status early is good for honesty but may make the launch surface look unfinished if review flips are not complete.
- **Duplicate exposure messaging:** route banner plus rail mini-card can feel repetitive. The banner should explain the product boundary; the rail card should explain the selected node's access state.
- **Mobile canvas remains limited:** Phase 1 improves the rail reading order but does not solve full mobile graph ergonomics.
- **Existing dirty worktree:** many related files are currently modified. Later implementers should inspect current diffs before editing and avoid reverting unrelated user or worker changes.

## Next Executable Tasks

1. Main agent reviews this spec and decides Phase 1 scope.
2. If approved, assign P1-A/P1-B first because they establish the presentation model and route rail priority.
3. Then assign P1-C and P1-D in parallel only if ownership boundaries are clear; both may touch similar summary helpers.
4. Finish with P1-E for language, CSS, tests, and browser verification.
5. Re-run launch acceptance on locked AI compute, unlocked AI compute, parcel full-free demo, and Chinese UI before deploy.
