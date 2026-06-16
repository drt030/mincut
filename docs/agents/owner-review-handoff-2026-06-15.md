# Owner review hand-off — reusable_launch + humanoid expansion (2026-06-15)

Both paid domains were expanded to **flagship parity** and **ACCEPTED by independent,
adversarial acceptance-judge agents** (fresh per cycle; they re-ran every gate and refused to
trust the orchestrator's self-reports). This is the consolidated "review it all at the end" packet.

## Status

| Domain | Verdict | Gate B integrity | Gate D exposure_recall | Supplier orgs | Commits |
|---|---|---|---|---|---|
| `spacex_reusable_launch` | **ACCEPTED** (verdict-2) | 0.967 | 0.73–0.76 (≥0.65) | 2 → ~47 | ce712ce→16bd329 |
| `humanoid_robotics` | **ACCEPTED** (verdict-2) | 1.00 | 0.82 strict / 1.0 excl. captive | 13 → 49 | d4b003a→eac3bd7 |

Both: segment_recall 1.0, chokepoint_flag_rate 1.0, validate + verify green, top-15 review queue
delivered, `reviewStatus` never agent-flipped. Eval used a lighter-than-GPU holdout protocol
(disclosed in `.eval/budget.md`) — thresholds pass on the judges' own independent grading.

## 1. Owner-only action — the two `portfolioState` flips

Each domain is eligible to flip `audit-preview → paid-candidate` in `src/lib/domains.ts`
(`DOMAIN_PORTFOLIO_STATES`). This is the owner gate — no agent performed it.

## 2. Top-15 review queues (your per-claim flip decisions)

- `docs/agents/review-queue-spacex-reusable-launch.md` — 6 flip-candidate / 6 honest-unreviewed / 3 flagged.
- `docs/agents/review-queue-humanoid-robotics.md` — 2 flip-candidate / 5 honest-unreviewed / 8 flagged.

`reviewStatus: reviewed` is yours alone to grant (ADR-0001). The queues list, per claim, the exact
evidence and the flip decision being asked.

## 3. Source-quality escalations (24) — your call before any of these specific numbers/edges flip

**SpaceX (8)** — detail in review-queue-spacex §6: Toray >50% PAN single-source (2nd source needed),
Microchip RTG4 sourceStatus, Linde→SpaceX LOX edge (secondary-only customer ID), Moog 10-K
re-source, Eaton (satellite not launch), Parker (re-source to SLS/Orion page), 2 spacex.com SPA
records (browser-render or re-anchor to Falcon User's Guide / prospectus).

**Humanoid (16)** — detail in review-queue-humanoid §16. Highlights:
- **GSA/Rollvis ">50% Swiss roller-screw share" + "Tesla Optimus sources GSA RGTI"** — SEO/blog-only;
  identity verified, the share/customer claims are escalated (kept qualitative).
- **Sanhua thermal/liquid-cooling supplier** — NOT primary-sourceable; the real ~5bn-RMB Tesla order
  is for *actuators*, not thermal. Kept `reported_capable_supplier`, flagged — do not upgrade.
- **Orbbec ">70% 3D-vision share" / RealSense "60% of developers"** — vendor self-claims, non-humanoid
  scope; verbatim but not independent.
- **Schaeffler ticker `SHA.DE` → live `SHA0.DE`** — symbol precision; `org_schaeffler` is cross-domain
  + test-pinned, so NOT auto-renamed.
- Parent-linkage exposure to surface: **PTG Holroyd → CQME (2722.HK)**, **PICEA/Han's Motion → Han's
  Laser (002008.SZ)**. Bot-blocked primaries (st.com, Yaskawa, TE) re-confirmed via proxy/search.

## 4. Minor non-blocking worklist (judges recorded; none blocks acceptance)

- Two orphan context numbers in org descriptions: Rockchip "~6 TOPS", D-Robotics "80–128 TOPS" (the
  latter already in humanoid queue §16.8) — source or drop.
- Captive software-stack nodes (locomotion/manipulation models) could carry explicit
  `scope`/`decomposition_frontier` notes (no gate check requires it; they are not falsely decomposed).
- humanoid Li-ion cell component lists 6 suppliers vs the soft ≤5 cap (CATL/LG/Samsung/Panasonic/
  Molicel/EVE) — optionally move the 6th to notes.
- Optional round-2 depth (not needed for parity, would not overfit the holdout): SpaceX upstream
  frontier decomposition (He→Qatar, CH4→LNG, propulsion valves); humanoid CMOS image-sensor upstream.
