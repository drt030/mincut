---
status: accepted
---

# Review status ladder: four distinct semantics, not a binary

## Context

`reviewStatus` in the schema has four values — `unreviewed`, `reviewed`, `disputed`, `deprecated` — but the gate runner (`src/lib/gateRunner.ts`) and the import CLI (`scripts/import-candidates.ts`) historically only differentiated `unreviewed` vs `reviewed`. `disputed` and `deprecated` were silently treated as "not reviewed" and lumped with weak evidence. There was no documented contract for what each status means or how each affects gate scoring.

We need a clear ladder because:
- The agent-assisted import loop is becoming a primary source of new records, all written `unreviewed` by default.
- Reviewers need a way to record "I looked, but I disagree" that is *distinct* from "nobody has looked yet".
- Some claims age out (a metric is replaced, an evidence source is superseded) and need a soft-delete that preserves graph history without polluting maturity.

## Decision

Each `reviewStatus` value carries distinct semantics and a distinct gate-scoring effect. See `CONTEXT.md → Review status ladder` for the canonical table; in summary:

- **`unreviewed`** — added but not yet human-reviewed. Default for fresh records (and for `import:candidates`). Counts as coverage, caps relevant gate scores at **3/5**, generates a "review this" task.
- **`reviewed`** — a human has looked and judges the claim plausibly true. Combined with high confidence and non-vendor / non-internal evidence, can lift gate scores to **5/5**.
- **`disputed`** — a human has looked **and finds counter-evidence or active disagreement**. Counts as coverage, caps relevant gate scores at **2/5** (lower than `unreviewed`), generates a "resolve dispute" task.
- **`deprecated`** — was once accepted but is now superseded or no longer applicable. **Completely excluded** from gate scoring (not counted in trusted, weak, or coverage). UI hides by default. Soft-delete preserving history.

`import:candidates` accepts only `unreviewed` for fresh records; `reviewed`, `disputed`, and `deprecated` are not legitimate states for agent-imported candidates because all three imply a prior human judgment.

## Considered alternatives

- **Collapse to a binary** (reviewed vs not). Rejected: loses the ability to mark "looked and disagreed" distinctly from "not yet looked", and conflates soft-delete with current weak claims.
- **Treat `disputed` the same as `unreviewed`** (both cap at 3/5). Rejected: this would create an incentive to mark uncertain claims `disputed` to "occupy a slot" while signalling caution. Capping `disputed` *lower* than `unreviewed` keeps the honest signal — "we looked and found a problem" — without letting it lift the score.
- **Treat `deprecated` as weak instead of excluded.** Rejected: deprecated records exist for history/lineage, not for current evidence. Letting them count would pollute maturity estimates after schema or threshold revisions.

## Consequences

- `gateRunner.ts` must branch on all four values: exclude `deprecated` from `scopedClaims`, weak/trusted tallies, and coverage; add a `disputedClaims` collector with a 2/5 cap and a "resolve dispute" task generator.
- `import:candidates` rejects fresh records with `reviewStatus` in {`reviewed`, `disputed`, `deprecated`}, except in `--dry-run --allow-reviewed` preview mode (current behavior, extended to all three).
- `validate:data` should require `notes` on any `disputed` record (explaining the dispute) and any `deprecated` record (explaining what supersedes it).
- The UI default-hides `deprecated` records but keeps a toggle for graph history / lineage views.

## Revisit when

- Cap values (3/5 for `unreviewed`, 2/5 for `disputed`) prove unhelpful in practice.
- A real workflow need emerges for distinguishing sub-states of `disputed` (e.g. "actively contested" vs "minor caveat noted").
- The "soft-delete" semantics of `deprecated` conflict with an actual versioning need (a `versionedDeprecated` or snapshot mechanism would supersede it).

## Amendment 2026-06-14: machine-verification axis (`machineCheck`)

`reviewStatus` stays a human-only judgment with the four values above. A new,
**orthogonal** field `machineCheck` (on evidence records) is granted by the audit agent
and **never implies human review**:

- `machineCheck.status = "verified"` means the source was re-fetched, the stored `excerpt`
  was found on the page, and the claimed number is supported at the stated basis/scope.
- An `unreviewed` claim whose non-deprecated evidence includes a `verified` record has its
  gate cap **lifted one rung, from 3/5 to 4/5** (`MACHINE_VERIFIED_CAP` in `gateRunner.ts`).
- Only owner `reviewed` reaches 5/5. `disputed` (2/5) and `deprecated` (excluded) are **not**
  rescued by machine verification.
- The audit agent may write `machineCheck` but **never** `reviewStatus: reviewed` — that
  remains owner-only, applied through a separate `applyOwnerFlips` step (test-enforced).
- v1 scope: the lift applies to the **global** review-status cap only; the cost-scoped cap
  (`costScopedReviewStatusCap`) is unchanged because it keys on metric-node `reviewStatus`,
  which an evidence-level signal does not map onto cleanly.

The resulting scoring ladder: `disputed` 2 < `unreviewed` 3 < `unreviewed + machineCheck:verified` 4 < `reviewed` 5.

See ADR-0009 (claim discipline / `sourceStatus`) and
`docs/superpowers/specs/2026-06-14-evidence-credibility-audit-agent-design.md`.
