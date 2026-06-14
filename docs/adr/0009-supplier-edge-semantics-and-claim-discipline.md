# ADR-0009: Supplier edge semantics and claim discipline

**Status:** Accepted (2026-06-11) · **Owner decision** via the second review-queue audit.

## Context

The 2026-06-11 owner audits of the AI-compute review queue found two structural failure modes
beyond bad links:

1. **`manufactured_by` was overloaded.** One relation was expressing: actual manufacturing,
   qualified-supplier status, reported-but-unverified capability, strategic supply (ZEISS↔ASML),
   ownership/acquisition (Ecolab↔CoolIT), outsourcing/capacity provision, second-source ramp,
   and customer allocation locks. Downstream (the paid exposure layer) renders all of them
   identically as "manufacturer", which both overstates weak links and understates strong ones.
2. **Multi-fact claims.** Node descriptions bundled share + capacity + lead time + price +
   qualification status into one sentence, so one bad number poisoned the whole node, and review
   flips became all-or-nothing.

## Decision

### 1. Relation split (schema, additive)

`edgeRelationSchema` gains: `qualified_supplier`, `reported_capable_supplier`,
`strategic_supplier_to`, `owned_by`, `capacity_provider`, `second_source_candidate`,
`allocation_locked_by`. `manufactured_by` now means exactly "actually manufactures this today".

Renderer rule: surfaces that only understand `manufactured_by` (investor panel, exposure layer,
teasers) simply do not display the weaker relations — conservative hiding is the correct default
for unverified or non-manufacturing links. Surfacing them is a deliberate future UI decision.

### 2. Claim discipline (data convention)

- **One claim = one fact type** (`market_share` / `capacity` / `lead_time` /
  `supplier_concentration` / `gating_status` / `event`). Encode as separate metric entries and
  separate description sentences; never bundle.
- **Every quantified claim carries:** value + unit + basis (revenue/unit/capacity/shipment/bit
  share are different numbers) + scope + asOf + a verbatim `sourceQuote` in the evidence record
  (`excerpt`). No quote → no number (downgrade to qualitative).
- **Single-source / "only qualified" / "100%" claims** are the highest review tier: ≥1 primary
  source or 2 independent quality sources, else stated as "reported, unverified".
- **Events ≠ consequences.** An investment/prepay/acquisition is recorded as a dated event;
  consequences ("capacity locked") need their own evidence.

### 3. Evidence lifecycle (schema, additive)

- Every evidence record carries `sourceStatus`
  (`ok_exact` reviewer-confirmed · `fetch_ok` · `paywalled_snippet` · `generic_homepage` ·
  `market_report_seo` · `unreachable` · `404` · `wrong_topic`). Mechanical URL audits refresh it.
- Demoted evidence moves from `evidenceIds` to **`rejectedEvidenceIds`** on the node (audit trail
  preserved; never deleted), with the reason in the record's `limitations`. UI never renders
  rejected evidence as citations.

### 4. Review gate (process)

A claim is flip-eligible only when: all supporting evidence is `ok_exact` · sourceQuote present ·
single-fact claim · metric basis+scope+asOf present · edge type is semantically specific ·
owner personally checked the URL. Forbidden as support: `404` / `generic_homepage` /
`wrong_topic` / `market_report_seo`-only / unsourced lead-times / exclusivity without the
high-tier sourcing above. Flips are per-FACT, not per-node; reviewStatus stays owner-only
(ADR-0001 unchanged).

## Consequences

- 2026-06-11 migration: High-NA blanks edge → `reported_capable_supplier` (low);
  CoolIT→Ecolab `owned_by` (IR-sourced); CDU/InP-substrate/High-NA bottleneck flags removed
  pending quantified evidence; disputed share-split evidence marked `disputed` (owner-instructed);
  21 manufactured_by edges that lost their only (bad) evidence are queued for re-sourcing rather
  than silently kept-as-supported.
- The eval metric `evidence_integrity` is superseded by this lifecycle: future domains measure
  "% of quantified claims with ok_exact quotes", not "% of claims with a URL".
- Full claim-object schema (the YAML shape in the audit) is deferred to post-launch; the interim
  encoding is disciplined metrics + descriptions as above.

## Amendment 2026-06-14: remediation ladder for unsupported quantified claims

When an audit finds a quantified claim whose cited source does not support the number
(fabricated precision, wrong basis/scope, or dead/wrong-topic source), apply this ladder in
order — never silently keep the number:

1. **Re-source.** Search for an authoritative source (one primary, or two independent quality
   secondary sources) that states the number at the **same basis and scope**; a **verbatim
   quote** is required. If found, replace the citation (`url` + verbatim `excerpt` + basis +
   `asOf`) and re-verify. Correct a mislabelled basis here too (e.g. equity vs prepay,
   revenue vs unit vs bit share, transceiver-gap vs component-gap).
2. **Downgrade to estimate.** If no source states the exact number but it is a defensible
   estimate from public anchors, relabel it as an **estimate / best-estimate**: record the
   estimation **method** and the **anchor sources** in the record (`limitations` / notes),
   set `confidence: low`, and present it as an estimate — never as a cited fact.
3. **Downgrade to qualitative.** If the qualitative claim holds but no defensible number
   exists, drop the number and keep the qualitative statement.
4. **Delete.** If neither the number nor the qualitative claim is supportable, remove it
   (move evidence to `rejectedEvidenceIds`; never delete the record outright).

This ladder is the standard disposition for audit escalations; it operationalises the
"No quote → no number" rule above. The audit agent proposes the disposition; the owner
approves any `reviewed` flip (ADR-0001).
