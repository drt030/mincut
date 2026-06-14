---
description: Run the evidence credibility audit on a domain (deterministic triage + Opus judgment), strictly per the defined method.
argument-hint: <domain-slug> — ai-compute | parcel-robot | humanoid-robotics | controlled-fusion | spacex-reusable-launch | spacex-orbital-data-center
---

Run the evidence credibility audit for domain **$1**, strictly following the defined protocol. This is a fixed method — do NOT improvise or invent a different audit.

## Authoritative method (read before acting)
- `docs/agents/evidence-audit-brief.md` — the judgment-subagent brief; obey its Hard Rules.
- Doctrine: `docs/adr/0001-review-status-ladder.md` (owner-only `reviewed`, machineCheck axis), `docs/adr/0009-supplier-edge-semantics-and-claim-discipline.md` (one fact per claim; value+unit+basis+scope+asOf+verbatim quote), and `docs/superpowers/specs/2026-06-14-evidence-credibility-audit-agent-design.md`.

## Steps
1. **Deterministic triage** (zero-token, pure code):
   `npm run audit:evidence -- --domain $1 --refresh`
   (drop `--refresh` for an offline-only pass). Read the bucket counts and `.scratch/audit-$1-<date>/report.md`.
2. **Persist the safe mechanical marks:** `npm run audit:evidence -- --domain $1 --write` — stamps `machineCheck` (dead/wrong sources → `failed`; clean → `structural_ok`/`needs_fetch`). Confirm semantically that ONLY `machineCheck` changed and `reviewStatus` is untouched.
3. **Extract judge batches:** dump the `needs_fetch` records (id, url, excerpt, supported-claim text) into `.scratch/audit-$1-<date>/judge-batch-N.json` (≈5 batches).
4. **Judgment layer:** dispatch one **Opus 4.8** subagent per batch (model: opus — verification is not the cheap tier). Give each `docs/agents/evidence-audit-brief.md` + its batch. Each returns ONLY `{verified:[...], escalations:[...]}` matching `agentVerdictsSchema`, with **≤ 2 escalations per batch** so the global total stays **≤ 10**.
5. **Apply verified (machine axis only):** aggregate to `.scratch/audit-$1-<date>/verdicts.json`; keep as `verified` only records with `quoteMatch: exact` (substance-only / partial-quote records go on a light-fix list, not verified). Run `npm run audit:evidence -- --domain $1 --write --verdicts <file>` to stamp `machineCheck=verified`. Re-verify semantically: only `machineCheck` changed, `reviewStatus` still untouched.
6. **Present to the owner** (do not decide for them): the **flip-ready queue** (verified records — owner-only `reviewed` decision) and the **≤10 escalations**, each with a specific question.

## Hard invariants — never violate
- **NEVER write `reviewStatus: "reviewed"` from any agent path.** Only the owner approves; flips are applied via `applyOwnerFlips` (`npm run audit:evidence ... --apply-flips`/owner step). The audit core is test-guarded (`tests/auditNeverWritesReviewed.test.ts`).
- Escalations ≤ 10 total; rank by gate stakes if more qualify and defer the rest.
- Demote dead/wrong sources; never delete an evidence record (move to `rejectedEvidenceIds` / mark `machineCheck=failed`).
- Verification/code subagents run **Opus 4.8**, not Sonnet/Haiku.
- After data writes, run `npm test` and confirm no new failures before reporting done.
