# Evidence Credibility Audit Agent — Design

Date: 2026-06-14 · Status: design (pending owner review)

## Problem

The flagship AI-compute domain ships **0 of 388 evidence records `reviewed`**; parcel
ships 1 of 188. The entire commercial positioning ("generation is cheap, verification
isn't" — MASTER-PLAN bear-case counter) rests on a credibility ladder whose top rungs
are empty. ADR-0001 makes `reviewStatus: reviewed` **owner-only and never agent-granted**,
and ADR-0009 makes a flip eligible only after per-fact, owner-checked verification. Doing
that by hand across ~600 records does not scale, so the ladder stays empty and the
flagship's core differentiator is unbacked.

We need an audit agent that does all the *verifiable* legwork at scale, lifts a real
machine-checked credibility signal, and leaves the owner only the genuinely human calls —
capped at a handful per run.

## Goals

- Make machine-checkable verification scale across all evidence without an LLM doing what
  code can do for free.
- Introduce a credibility signal the agent **can** grant honestly (source re-fetched,
  quote and number confirmed) that is distinct from human review.
- Reduce the owner's review job from hours to seconds: a pre-verified flip-ready queue plus
  **≤10** genuinely-ambiguous escalations per run.
- Preserve ADR-0001 literally: only the owner grants `reviewed`; `reviewed` stays the only
  path to a 5/5 gate score.

## Non-goals

- Auto-granting `reviewed` (forbidden; test-enforced).
- The full claim-object YAML schema from ADR-0009 (deferred post-launch).
- Re-decomposition or new content (that is a separate workstream).

## 1. Two-axis credibility model

Two orthogonal axes, granted by different subjects:

| Axis | Granted by | Means | Gate effect |
| --- | --- | --- | --- |
| `reviewStatus` (existing) | **owner only** | a human judged the claim plausibly true | can lift to **5/5** (ADR-0001) |
| `machineCheck` (**new**) | the audit agent | source re-fetched; excerpt present in source; number supported at the stated basis/scope | lifts the unreviewed cap to **4/5** (this design) |

`machineCheck` is a **separate field**, not a fifth `reviewStatus` enum value — that would
pollute "reviewStatus = human judgment." ADR-0001's enum is unchanged.

The scoring ladder becomes five rungs:

```
disputed 2/5  <  unreviewed 3/5  <  unreviewed + machineCheck=verified 4/5  <  reviewed 5/5
```

## 2. Schema change

Additive optional field on `evidenceSchema` (and, where claims carry inline review state,
on node/edge schemas — evidence is the primary carrier):

```ts
machineCheck: z.object({
  status: z.enum(["verified", "structural_ok", "needs_fetch", "failed"]),
  checkedAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quoteMatch: z.enum(["exact", "partial", "absent", "not_checked"]).optional(),
  numberInQuote: z.boolean().optional(),
  notes: z.string().optional(),
}).optional()
```

- `verified` — online re-fetched, `excerpt` found in the source, claimed number supported.
  The only status that earns a public "source re-checked" chip and the 4/5 cap lift.
- `structural_ok` — passed offline checks, low-stakes, not fetched. Internal only; **not**
  surfaced as a credibility claim and does **not** lift the gate cap.
- `needs_fetch` — high-stakes and structurally clean; transient, resolved by the agent layer
  to `verified` / `failed` / escalation.
- `failed` — structural failure or dead/wrong source; lands in the fix or demote list.

`machineCheck` never implies human judgment and is independent of `reviewStatus`. A record
can be `reviewStatus: unreviewed` + `machineCheck: verified` (the common scaled state),
or `reviewStatus: reviewed` + no `machineCheck` (owner reviewed without a re-fetch).

## 3. Architecture: deterministic core + agent judgment layer

### 3a. `scripts/audit-evidence.ts` (deterministic, all ~600 records, zero LLM tokens)

For each evidence record and the claim(s) it supports:

1. **Structural checks (offline):**
   - `excerpt` present (89/388 missing on ai-compute).
   - The claimed number/metric value appears as a normalized substring of `excerpt`
     (number-in-quote).
   - Single-fact: flag descriptions/metrics bundling multiple fact types (ADR-0009) —
     heuristic: multiple distinct number+unit pairs in one supported sentence/metric.
   - The supported metric carries basis + scope + `asOf`.
   - Edge semantics: flag `manufactured_by` edges whose evidence describes a weaker
     relation (qualified/reported/strategic/owned/capacity/second-source/allocation) per
     ADR-0009.
2. **HTTP refresh (online, deterministic):** re-fetch each URL; set `sourceStatus` from the
   HTTP result + a basic content check (200-with-body / `404` / `unreachable` /
   redirect-to-`generic_homepage`).
3. **Triage** every record into one bucket:

| Bucket | Disposition |
| --- | --- |
| `demote` — dead / wrong-topic source (e.g. the existing `sourceStatus: "404"` records still sitting in `evidenceIds`) | **auto-applied:** move id from `evidenceIds` to `rejectedEvidenceIds`, reason into `limitations` |
| `failed` — missing `excerpt`, number-not-in-quote, multi-fact, overloaded edge | **fix list** (owner/data-worker repairs) |
| `needs_fetch` — structurally clean **and** high-stakes | handed to the agent judgment layer |
| `structural_ok` — structurally clean, low-stakes | mark `machineCheck.status = structural_ok`; not fetched |

**"High-stakes"** = supports a gate top-bottleneck claim, **or** is a flip candidate
(structurally clean + `sourceStatus` healthy + single-fact + asOf), **or** backs an
ADR-0009 highest-tier claim ("single-source" / "100%" / "only qualified" / "exclusive").

### 3b. Audit subagent (judgment layer, Sonnet, per domain / per batch)

Receives **only** the `needs_fetch` subset. For each:

- WebFetch the source; judge whether the `excerpt` is actually present and whether the page
  supports the claimed number at the **same basis and scope**.
- Match → set `machineCheck.status = verified` (with `quoteMatch`, `numberInQuote`); add to
  the **flip-ready queue**.
- Partial / conflicting / ambiguous-basis / suspiciously-precise / paywalled-can't-confirm
  → add to the **≤10 escalation list** with a specific question.

Runs on Opus 4.8 — evidence verification is judgment work, not a simple search, so it does not use the cheap-model tier (the deterministic core already removed the high-volume bulk).

## 4. Escalation rubric (the ≤10)

A record escalates to the owner **only** when the agent genuinely cannot resolve it
mechanically:

- Quote only partially supports the number ("~70%" cited as "72%").
- Two sources for the same fact conflict.
- Basis ambiguous (revenue vs unit vs bit vs shipment share — ADR-0009's exact failure mode).
- Suspiciously precise number with no matching quote (the "fabricated precision" round-6 caught).
- Source is paywall/login-walled **and** the record is a flip candidate (matters, can't confirm).

The agent caps escalations at **10**. If more qualify, it ranks by stakes (gate weight of
the supported claim) and escalates the top 10; the remainder go to the fix list flagged
"needs owner fetch (deferred)." Each escalation states the specific question, the
conflicting values, and the source(s).

## 5. Safety boundary: auto-apply vs propose

- **Auto-applied** (reversible, audit-trail-preserving): `sourceStatus` refresh; demote
  dead/wrong sources to `rejectedEvidenceIds`; `machineCheck` markings.
- **Proposed only — owner decides:** every `reviewStatus → reviewed` flip; every escalation.

**Red line:** the agent path **never** writes `reviewStatus: reviewed`. Enforced by a test
asserting no audit code writes `reviewed` and that flips apply only through the
owner-approved `flips.json` step.

## 6. Gate integration

Add `MACHINE_VERIFIED_CAP = 4` alongside `DISPUTED_CAP = 2` / `UNREVIEWED_CAP = 3`.

`EvidenceFindings` gains `machineVerifiedClaimIds` = the id set of unreviewed claims whose
supporting (non-deprecated) evidence includes a `machineCheck.status === "verified"` record.
`applyReviewStatusCap` becomes (comparison is **by id**, not object identity):

```ts
function applyReviewStatusCap(findings: EvidenceFindings): number | undefined {
  if (findings.disputedClaims.length > 0 || findings.disputedEvidence.length > 0) return DISPUTED_CAP;
  const unverifiedUnreviewed = findings.unreviewedClaims.filter(
    (c) => !findings.machineVerifiedClaimIds.has(c.id),
  );
  if (unverifiedUnreviewed.length > 0) return UNREVIEWED_CAP;            // any bare unreviewed → 3
  if (findings.machineVerifiedClaimIds.size > 0) return MACHINE_VERIFIED_CAP; // all remaining machine-verified → 4
  return undefined;                                                      // all reviewed → 5
}
```

Properties (preserve "worst record drags the question down"):

- A question reaches 4/5 only if **every** unreviewed claim it leans on is machine-verified.
- A question reaches 5/5 only if all are owner-`reviewed`.
- `disputed` (2/5) and `deprecated` (excluded) are **not** rescued by machine verification.
- Cost-scoped cap (`cost_constraints`, iter-19) gets the same machine-verified treatment,
  scoped to cost claims.

This is an ADR-0001-level change → **update ADR-0001** (extend the ladder table and the
"revisit when / cap values" note) and cross-reference ADR-0009 (machine verification
operationalizes its "% of quantified claims with ok_exact quotes" successor metric).

## 7. UI integration

- `EvidenceList`: add a "✓ source re-checked" chip when `machineCheck.status === "verified"`,
  beside the existing `reviewStatus` pill. `structural_ok` shows nothing.
- `LandingContent` honesty ladder: insert a middle rung between "Thin" (unreviewed) and
  "Strong" (reviewed): "Source-checked — re-fetched, quote and number confirmed; not yet
  owner-reviewed." EN + zh.
- `DomainThesisBanner`: show `X source-checked / Y reviewed / Z total` instead of just
  reviewed/total.

## 8. Outputs

- `.scratch/audit-<domain>-<runid>/report.md` — counts per bucket; the flip-ready queue
  (one confirmable line each); the fix list; the ≤10 escalations with questions.
- `.scratch/audit-<domain>-<runid>/flips.json` — owner-approvable patch that sets
  `reviewStatus: reviewed` on confirmed records (applied by a separate `--apply-flips` step,
  never by the agent).
- Data files receive the auto-applied mechanical changes (`sourceStatus`,
  `rejectedEvidenceIds`, `machineCheck`) in place.

## 9. Invocation

```
npm run audit:evidence -- --domain ai-compute          # deterministic core + writes worklist
npm run audit:evidence -- --domain ai-compute --judge  # also runs the agent judgment layer
npm run audit:evidence -- --apply-flips <flips.json>    # owner step: apply approved reviewed flips
```

## 10. Testing

- Deterministic-core unit tests over fixtures with known violations (missing `excerpt`,
  number-not-in-quote, multi-fact, `sourceStatus: 404`) → expected triage buckets.
- **Red-line test:** no audit code path produces `reviewStatus: reviewed`; flips apply only
  via the explicit `--apply-flips` step.
- Gate test: `unreviewed + machineCheck=verified` claim caps at 4/5; a single bare
  unreviewed claim still caps at 3/5; `disputed` stays 2/5; all-reviewed reaches 5/5.
- Schema test for `machineCheck`.
- Core determinism test: network mocked/skipped → identical triage across runs.

## 11. First-run target & rollout

1. ai-compute (flagship: 0/388 reviewed, 89 missing excerpts, existing 404s to demote) —
   highest leverage.
2. parcel (depth demo).
3. The four audit-preview domains as their content firms up.

## 12. Deferred / future

- Full ADR-0009 claim-object schema.
- Whether `machineCheck=verified` should expire (re-fetch staleness window) — start with a
  visible `checkedAsOf`; no auto-expiry in v1.
- Optional: machine-verify as input to the `audit-preview → paid-candidate` promotion gate.
