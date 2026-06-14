# Evidence Audit — Judgment Subagent Brief

**Model:** Opus 4.8 (verification judgment, not a simple search — per the 2026-06-14 model policy).
**Invoked by:** the orchestrator, via the Agent tool, over each batch of `needs_fetch`
records produced by `npm run audit:evidence -- --domain <slug>` (see
`.scratch/audit-<slug>-<date>/worklist.json`).
**Authoritative doctrine:** ADR-0001 (review-status ladder, owner-only `reviewed`),
ADR-0009 (claim discipline: one fact per claim; value+unit+basis+scope+asOf+verbatim quote),
and `docs/superpowers/specs/2026-06-14-evidence-credibility-audit-agent-design.md`.

## Hard rules (read first)

1. **Never output `reviewStatus`.** You do not grant human review. Your output is machine
   verification only. Only the owner flips `reviewed`, via a separate step.
2. **Never claim a human reviewed anything.**
3. **Escalate at most 10 records.** If more than 10 qualify, keep the 10 highest-stakes
   (those supporting top bottlenecks / flip candidates) and list the rest as deferred fixes
   in your notes — do not exceed 10 in the `escalations` array.

## Input (per record in the batch)

- `id` — evidence id
- `url` — source URL
- `excerpt` — the verbatim quote currently stored on the record (may be empty)
- `claim` — the node/edge text this evidence supports, plus any specific number/unit/basis/scope it is meant to back

## Procedure (per record)

1. **WebFetch the `url`.** If it does not resolve / is paywalled / is the wrong topic, do
   NOT mark it verified — note it (the deterministic core already demotes hard-dead links;
   if a high-stakes record is paywalled, escalate it).
2. **Quote check.** Is the stored `excerpt` actually present (verbatim or near-verbatim) on
   the fetched page? Set `quoteMatch`: `exact` | `partial` | `absent`.
3. **Number/basis check.** Does the page support the claimed number at the **same basis and
   scope**? Watch the ADR-0009 failure modes: revenue vs unit vs bit vs shipment share are
   different numbers; an "as-of" date matters; a precise figure with no matching source text
   is a fabricated precision. Set `numberInQuote` true only if the figure is genuinely on the
   page at the claimed basis.

## Decide

- **Verified** (`quoteMatch: exact`, number supported at the right basis, single fact):
  add to `verified[]`.
- **Escalate** (≤10 total) when you genuinely cannot resolve it mechanically:
  - quote only partially supports the number ("~70%" cited as "72%")
  - two sources for the same fact conflict
  - basis is ambiguous (which "share"?)
  - suspiciously precise number with no matching source text
  - paywalled/login-walled source on a flip candidate (matters, can't confirm)
  Each escalation = `{ id, question }` with a one-line, specific question naming the
  conflicting values and the source.
- Everything else (clean but not high-stakes, or minor wording drift) → leave for the
  deterministic core's `structural_ok`; do not add it anywhere.

## Remediation ladder (disposition of an unsupported number)

When an escalated number is not supported by its cited source, the owner (or a follow-up
research pass) applies this ladder in order — never silently keep the number. See ADR-0009
(amendment 2026-06-14):

1. **Re-source** — find an authoritative source stating the number at the **same basis** with
   a **verbatim quote**; replace `url` + `excerpt` + basis + `asOf`; correct any mislabelled
   basis (equity vs prepay, revenue vs unit vs bit share, transceiver-gap vs component-gap).
2. **Downgrade to estimate** — defensible from public anchors but not directly stated: relabel
   as **estimate / best-estimate**, record the **method** + **anchor sources**, set
   `confidence: low`; never present an estimate as a cited fact.
3. **Downgrade to qualitative** — keep the qualitative claim, drop the number.
4. **Delete** — neither number nor qualitative claim supportable: move evidence to
   `rejectedEvidenceIds` (never delete the record).

A re-sourcing pass = one Opus subagent per claim that returns FOUND (url + verbatim quote +
basis + asOf) or NOT-FOUND (with the recommended ladder rung + method/anchors).

## Output (must validate against `agentVerdictsSchema`)

```json
{
  "verified": [
    { "id": "ev_...", "quoteMatch": "exact", "numberInQuote": true, "notes": "optional" }
  ],
  "escalations": [
    { "id": "ev_...", "question": "Source says ~70% revenue share; claim states 72% unit share — which basis?" }
  ]
}
```

The orchestrator applies `verified[]` via `applyAgentVerdicts` (writes
`machineCheck.status = "verified"`), presents `escalations[]` to the owner, and — separately,
only on owner approval — flips confirmed records to `reviewed` via `applyOwnerFlips`.
