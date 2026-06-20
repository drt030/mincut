# Rigor Surfacing — Evidence Credibility Badge + Thesis Falsifiers

**Date:** 2026-06-15
**Status:** Design — approved in brainstorming, pending spec review
**Scope tier:** Launch-window rigor "small wins" (MASTER-PLAN 6/15 measure window; survives even a PIVOT-DISTRIBUTION "freeze engineering except content" branch because both items are derived/config, not new subsystems)

## 1. Motivation

These two features absorb the genuinely useful ideas from the `chokepoint-atlas`
sibling repo **without copying it**, and both land on a layer MinCut already
owns: **verification / honesty rigor**. They make MinCut's existing (and
strictly more rigorous) machinery *legible*, which is what turns the launch
positioning — *"Generation is cheap now. Verification isn't."* — from a slogan
into something a visitor can see per-citation and per-thesis.

Gap analysis (2026-06-15) confirmed most of chokepoint-atlas's "strengths" are
already present in stronger form (`evidenceType` ×13, `confidence`,
`reviewStatus` with gate caps, `machineCheck`, `sourceStatus` ×10). The only
real gaps are:

1. our rigor is **not legible at a glance** (scattered pills), and
2. we have **no pre-registered falsification surface** for our headline
   bottleneck theses.

Deliberately **out of scope** (the negative space is the brand):

- ❌ No `mispricing` / per-name buy score (violates research-tool / 不荐股 positioning).
- ❌ No standalone `catalyst_watch` / freshness subsystem (the freshness layer is the
  SCALE-branch v2 endgame, not a launch item).
- ❌ No copying chokepoint-atlas's `Confirmed/Inferred/Weak/Needs-verification` labels
  or `lane`/`ticker`/`underwrite` vocabulary — we use our own ladder's language.

## 2. Feature 1 — Evidence Credibility Badge

### 2.1 What it is

A **pure derived function** that rolls the existing scattered evidence signals
into one legible credibility tier, rendered as a single badge per evidence row
with a "why" tooltip. **Zero schema migration** — it reads fields already on
`Evidence` (`reviewStatus`, `machineCheck`, `sourceStatus`, `type`,
`confidence`).

This is a *consolidation*, not an addition: today `EvidenceList.tsx` shows a
type pill, an optional confidence pill, an optional internal `reviewStatus`
pill, and an optional `✓ source-checked` pill. The badge folds confidence +
`machineCheck` + public review-state into **one tier**; the `type` pill stays
(it carries orthogonal information), and the raw `reviewStatus` pill stays
gated behind `showInternalReviewState`.

### 2.2 Derivation (`src/lib/evidenceCredibility.ts`, new pure module)

```ts
export type CredibilityTierKey =
  | "reviewed"        // rank 5
  | "source_checked"  // rank 4
  | "unverified"      // rank 3
  | "disputed";       // rank 2

export type CredibilityTier = {
  key: CredibilityTierKey;
  rank: 5 | 4 | 3 | 2;
  linkBroken: boolean; // surfaced in tooltip; downgrades unreviewed items (see below)
};

export function credibilityTier(e: Evidence): CredibilityTier;
```

The ladder is **exactly CONTEXT.md's existing gate ladder, surfaced** (it
introduces no new judgement):
`disputed 2 < unreviewed 3 < unreviewed+verified 4 < reviewed 5`.

Resolution order (first match wins, then link-broken adjustment):

| Condition | Tier (rank) |
|---|---|
| `reviewStatus === "disputed"` | `disputed` (2) |
| `reviewStatus === "reviewed"` AND `confidence === "high"` AND `type ∉ {vendor_claim, internal_note}` | `reviewed` (5) |
| `reviewStatus === "reviewed"` (otherwise — medium/low conf, or vendor/internal) | `source_checked` (4) |
| `reviewStatus ∈ {unreviewed, undefined}` AND (`machineCheck.status === "verified"` OR `sourceStatus === "ok_exact"`) | `source_checked` (4) |
| else | `unverified` (3) |

`linkBroken = sourceStatus ∈ {"404", "unreachable", "wrong_topic"}`.
Link-broken adjustment: a dead citation isn't support, so a **`source_checked`
tier reached only via a machine signal** (`machineCheck.status === "verified"`
with no human review) **drops to `unverified`** when the link is broken — i.e.
the machine said "verified" at some past `checkedAsOf` but the link is dead now;
the tooltip flags "citation link needs refresh". A human `reviewed`/`disputed`
verdict is **not** overridden (the human verdict stands; tooltip still flags the
dead link). `unverified` is unaffected. `deprecated` evidence is already hidden
by the UI and is out of the badge's contract (documented; the function may be
called but callers don't render deprecated rows).

### 2.3 Public vs internal labels

Honor the existing `showInternalReviewState` flag and the `publicEvidenceText`
softening already in `EvidenceList.tsx`. Tier → label (bilingual, new `t()`
keys in `LanguageProvider.tsx`):

| key | EN (public) | zh (public) | visual class |
|---|---|---|---|
| `reviewed` | Reviewed | 已审核 | `pill-cred-reviewed` (green) |
| `source_checked` | Source-checked | 已核源 | `pill-cred-source-checked` (blue, reuse existing `pill-source-checked`) |
| `unverified` | Not yet validated | 待独立验证 | `pill-cred-unverified` (grey) |
| `disputed` | Disputed | 有争议 | `pill-cred-disputed` (amber) |

`disputed` is shown publicly on purpose — per the MASTER-PLAN honesty doctrine
("verification is ALWAYS FREE TO SEE"), showing a problem we found is the
honesty signal, not something to hide.

### 2.4 Tooltip ("why")

Built from existing fields so the rigor is concrete, e.g.:
- `source_checked` via machineCheck → "Source re-fetched {machineCheck.checkedAsOf}; quote match: {machineCheck.quoteMatch}".
- `reviewed` → "Human-reviewed; confidence {confidence}; {type}".
- `unverified` + linkBroken → "Citation link needs refresh ({sourceStatus})".

Tooltip key `evidenceCredibilityHint_*` per tier; reuse `evidenceSourceCheckedHint` where it fits.

### 2.5 Testing (TDD)

- Unit-test `credibilityTier` over the full matrix: each `reviewStatus` ×
  `machineCheck.status` × `sourceStatus` × `type` × `confidence` cell of
  interest, including link-broken adjustment and the reviewed-but-vendor cap.
- Component test: `EvidenceList` renders exactly one credibility badge per row,
  the badge label matches the tier, and the internal `reviewStatus` pill stays
  gated behind `showInternalReviewState`.

## 3. Feature 2 — Thesis Falsifiers (narrowed)

### 3.1 What it is

A **pre-registered** "weakest assumption + what would overturn this" attached to
a domain's **headline bottleneck thesis** — the forward-looking honesty
commitment that an agent's one-shot confirmation-only research can't fake.

Narrowed scope (per 2026-06-15 discussion): **only domains that make a real
directional call** carry falsifiers; pure-decomposition maps leave them empty.
This is distinct from `reviewStatus: disputed` (present-tense "a human found
counter-evidence") — falsifiers are future-tense and written *before* the
counter-evidence exists, mirroring the eval Layer-3 forward-pick freeze
discipline already in MASTER-PLAN.

### 3.2 Data (`src/lib/domains.ts`)

Two optional fields on the domain config (English prose, consistent with the
existing English-raw `description`; UI section labels localized via `t()`):

```ts
/** Pre-registered weakest load-bearing assumption of this domain's headline
 *  bottleneck thesis. Omit on pure-decomposition maps with no directional call. */
weakestAssumption?: string;
/** The concrete future observation that would prove the headline bottleneck
 *  call wrong even if every cited node stays true. */
thesisBreaker?: string;
```

Bilingual falsifier *values* are a deferred follow-up (consistent with
`description` being English-raw today); section *labels* are bilingual now.

### 3.3 Authored copy (launch)

**ai-compute (flagship):**
- weakestAssumption: "AI-accelerator demand keeps converting into sustained CoWoS / HBM / advanced-packaging capacity expansion, rather than a short inventory cycle that normalizes."
- thesisBreaker: "If CoWoS/HBM capacity catches up — lead times compress and allocation language drops out of earnings — while accelerator shipments keep growing, then packaging/test was not the binding constraint and the bottleneck call is wrong."

**humanoid-robotics (paid-candidate / audit-preview):**
- weakestAssumption: "Humanoid viability is gated by physical component maturity (actuators, hands, thermal) rather than by the learned control policy, so the bottleneck sits in the component stack."
- thesisBreaker: "If a humanoid reaches reliable commercial deployment on today's off-the-shelf actuators and the clear differentiator is the control/data stack, the component-stack framing is wrong and the gate is software."

**parcel-robot (depth demo):** left empty for launch (it is a decomposition depth
reference, not a directional call) unless a sharp call is added later.

### 3.4 Rendering (`src/components/DomainThesisBanner.tsx`)

A new section rendered **whenever `weakestAssumption || thesisBreaker` is
present**, in **both** the `explainsAccess` branch and the `direct` (flagship /
depth-demo / audit-preview) branch — the flagship is exactly where the headline
thesis matters most and must show it. Placed adjacent to the evidence-review
summary so the three-part rigor reads together: *thesis → its weakest assumption
→ our evidence hardness* (the juxtaposition chokepoint-atlas structurally
cannot produce, because it has no evidence-review layer).

New `t()` keys: `domainThesisWeakestAssumption` ("Weakest assumption" / "最弱假设"),
`domainThesisBreaker` ("What would overturn this" / "什么会推翻它").

### 3.5 Testing

- Component test: banner renders the falsifier section when fields present,
  omits it cleanly when absent, in **both** branches.

## 4. Sequencing

1. **Badge first** — pure function + tests + UI consolidation; no data authoring, no copy.
2. **Falsifiers second** — config fields + banner section + authored copy for ai-compute & humanoid.

Both are small enough to ship inside the 6/15 measure window and are
content/derived rather than new subsystems.

## 5. Absorb-not-copy scorecard

| chokepoint-atlas idea | Copy would be | What we do instead (on our axis, past them) |
|---|---|---|
| Evidence ladder A/B/C/D | add a manual `tier` field + their labels | **derive** a tier from live audit state (`machineCheck`/`sourceStatus`) that can't be hand-gamed and updates when the audit agent re-runs; our ladder's own vocabulary |
| `thesis_breaker` string | copy a free-text field | pre-registered falsifier rendered **beside our evidence-rigor summary** (the third leg they can't produce); future-tense, distinct from our `disputed` state |

## 6. Risks / open questions

- **No blocking open questions.** Tier display names and visual colors are
  tunable in implementation without changing the derivation contract.
- Auto-committing this spec to `master` is deferred to the user (harness commits
  on request only); the file is written for review regardless.
