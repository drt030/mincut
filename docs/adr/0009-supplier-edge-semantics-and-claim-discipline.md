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
