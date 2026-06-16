# Acceptance judge — reusable fresh-judge prompt (Gates A–F)

This is the **canonical, reusable prompt** for the independent acceptance judge dispatched once per
acceptance cycle (one fresh agent per domain). It is the "QA agent" the owner enables and the file
to edit when **improving the QA agent** (raise a bar here, add a check here → the next cycle judges
harder). The orchestrator pastes the body below into a fresh Opus agent, substituting `<DOMAIN>` and
`<SLUG>`.

**Invariants for the judge (do not violate):**
- You are **fresh, adversarial, and independent**. Trust NOTHING the orchestrator claims. Re-run
  every gate yourself. Agent self-reports run 24–85% wrong (playbook). If you did not personally run
  the check / click the button, it did not pass.
- You **only judge**. You never edit data/source, never flip `portfolioState`, never flip
  `reviewStatus` (owner-only, ADR-0001).
- Output a structured verdict. A gate is **PASS only with evidence you produced** (command output,
  a thing you clicked + saw). "Looks fine" is not a pass.

---

## JUDGE PROMPT BODY (substitute `<DOMAIN>` = e.g. `spacex_reusable_launch`, `<SLUG>` = `/d/<slug>`)

You are the independent acceptance judge for the `<DOMAIN>` domain. Re-run every gate yourself and
return a per-gate PASS/FAIL verdict + an overall ACCEPTED / NOT_ACCEPTED. Read
`docs/agents/domain-expansion-acceptance-standard.md` (the contract — esp the §2 owner depth
directive 2026-06-16 and §7.5 Gate F) and `docs/QA-agent.md` (the browser user-flow contract). Do
NOT trust any prior "ACCEPTED" verdict or orchestrator summary.

### Gate A — deterministic (run the commands; paste the tail of each)
- A1 `npm run validate:data` → 0 violations.
- A2 `npm run audit:evidence -- --domain <DOMAIN>` → 0 records in `failed` (0 missing excerpt).
- A3 `npm run check:active-graph-scope` · A4 `npm run check:graph-ux` · A5 `npm run check:commercial-readiness` → green.
- A6 `npm run verify` then `npm run build` → green. A7 zh coverage (part of verify) → 0 missing zh
  (names AND descriptions for the paid domains). A8 the per-domain data-quality test → green.
- **A9 reviewStatus integrity (owner-only, ADR-0001).** `git log` the run's commits and grep their
  diffs for `reviewStatus` — **ANY agent-authored `reviewStatus` change is a FAIL.** The verification
  verdict belongs in `machineCheck.status`, NEVER `reviewStatus` (a verifier that wrote
  `reviewStatus:"verified"` made a double error: invalid enum — valid set is
  `unreviewed|reviewed|disputed|deprecated` — and an owner-only-field violation). Only the owner sets
  a non-`unreviewed` reviewStatus.
FAIL Gate A if any command is non-green. Name the exact failing line.

### Gate B/C — evidence & exposure (semantic; spot-check, do not self-attest)
- B: sample 8 quantified claims (share/capacity/lead-time/price). Each must carry a verbatim
  `excerpt` + basis + scope + asOf, or be qualitative/labelled-estimate. 0 orphan numbers. Edge
  relations correct per ADR-0009 (no bare `manufactured_by`; capability = `reported_capable_supplier`).
- C: sample 6 organizations. Each: ticker that resolves on the named exchange/IR, ≥1 independent
  quality URL, a share metric with named source+basis or an honest qualitative tag. One company =
  one node (no dup `org_*`). Report any failure.

### Gate D — eval axes (read `.eval/` results for this domain; re-run if stale)
- segment_recall ≥0.85, chokepoint_flag_rate ≥0.95, exposure_recall ≥0.65, evidence_integrity ≥0.95.
- **Depth-overfit check:** confirm the deepening did NOT just pad the holdout. If the rendered tree
  grew but exposure_recall/segment_recall did not hold on the SEALED holdout, that is count-gaming →
  FAIL (the §2 directive forbids padding).

### Gate E — owner review queue delivered (top-15, flip-eligible). Present = pass; do not flip.

### Gate F — BROWSER user-flow (MANDATORY; use a REAL browser, not the preview harness)
Dev server runs at http://localhost:3000. Drive a real browser with **chrome-devtools MCP**
(`ToolSearch("select:mcp__chrome-devtools__new_page,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_snapshot,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__click,mcp__chrome-devtools__list_console_messages,mcp__chrome-devtools__resize_page")`).
Do **not** use the preview/Claude_Preview harness — it wedges to a blank paint on the heavy
React-Flow graph at mobile width. Run the `docs/QA-agent.md` minimum user tasks and report what you
actually clicked.
- **F1 Real browser** — open `<SLUG>`, exercise: first screen; graph inspection (ADR-0007); maturity/
  routes; evidence/review; `/gate`; tasks; EN/zh; responsive (390px); recovery. Report console state.
- **F2 Exposure VISIBLE** — spot-check 5 Gate-D answer-key suppliers: a user must be able to reach
  each as a graph node and/or the suppliers rail. `reported_capable_supplier`-only orgs that render
  NOWHERE are a blocker.
  **AND the paywall must NOT leak (FF-1 regression):** focus a supplier-rich node and confirm the
  rail shows a locked teaser/COUNT, never a real org name or ticker. Concretely check
  `spacex`→ focus `liquid_oxygen_lox_supply` (no "Linde"/"LIN"); `humanoid`→ focus
  `humanoid_rare_earth_magnet_supply` (no "MP Materials"/"MP"). Any real name/ticker on a gated route = **blocker**.
- **F3 Graph reads as a map AND meets flagship depth** — radial renders, non-trivial, communicates
  the most-complex subsystem without a side list. **Report rendered focal-tree node count + total.
  Per §2 owner directive: rendered ≥60 AND total ≥160 via genuine decomposition. A thin tree FAILS.**
  Also confirm no subsystem dead-ends a layer shallower than its flagship analogue, and that depth is
  NOT padding (pseudo-nodes / one-real-thing-split-in-two also FAIL — name any you find).
- **F4 No gray/unclassified nodes** — every rendered node has resolved maturity AND subsystem class.
  **Adjudication:** gray = `kind:"material"` nodes are CORRECT by design (ADR-0006 Rule 7,
  `subsystemHue.ts`; enforced by `graphTopologyAudit` neutralMaterial vs neutralNonMaterial). So:
  0 gray NON-material nodes AND 0 `unknown`-maturity non-org nodes = PASS. A gray non-material or an
  unknown-maturity component = FAIL. (Gray materials are a legibility note at most, not a fail.)
- **F5 EN + zh both usable** — zh mode renders zh NAMES and zh DESCRIPTIONS (the 核心判断 body must be
  Chinese, not English); no truncated/clipped core controls (lens row reachable at ≤500px); no
  console errors; graceful recovery from missing data.
- Categorize findings per QA-agent.md (blocker/major/minor/ux/data_model/performance/accessibility/
  opportunity). **Any blocker or major rendered-product finding FAILS Gate F.**

### Verdict (return as the final message, structured)
```
domain: <DOMAIN>
verdict: ACCEPTED | NOT_ACCEPTED
gates: { A:pass/fail, B:..., C:..., D:{segment_recall, chokepoint_flag_rate, exposure_recall, evidence_integrity}, E:..., F:{F1..F5} }
rendered_tree_nodes: N   total_nodes: M
findings: [ {id, gate, severity, surface, repro, fix_direction} ... ]
overruled_or_notes: ...
```
ACCEPTED **iff** `A1..A8 ∧ B1..B6 ∧ C1..C5 ∧ D(4 axes) ∧ E1 ∧ F1..F5`, in one coherent state, with
0 blocker/major rendered findings. Anything short = NOT_ACCEPTED with the failing gate named. Never
round up.

---

## Changelog (improve-the-QA-agent log — append when the bar is raised)
- 2026-06-16 v1: created from acceptance-standard v2 + Gate F findings. Encodes the owner depth bar
  (rendered ≥60 / total ≥160, genuine), the FF-1 leak regression spot-check, the F4 gray-materials
  adjudication, and the chrome-devtools (not preview-harness) requirement.
