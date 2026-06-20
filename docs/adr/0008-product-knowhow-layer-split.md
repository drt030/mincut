---
status: accepted
---

# Product / know-how layer split; transactability as the moat signal

## Context

The canvas mixed artifacts (product, module, equipment, material) with
embodied activities (engineering_method, manufacturing_process). The
"make every node a product" instinct resolved into: every dependency
either has a transactional form or it doesn't, and that distinction is
the signal worth modelling (procurable know-how is a service product;
non-procurable know-how is where make-vs-buy bites).

Audience framing: the north star stays "a learner studying
manufacturing"; personas are learning focuses. The currently
prioritized focus is the retail secondary-market investor hunting
supply-chain chokepoints ("shiso leaf" strategy): irreplaceable,
high-barrier, supply-concentrated, market-ignored upstream segments.

## Decision

1. Kinds stay. "Know-how" (技术诀窍) is the display-layer umbrella for
   `engineering_method` + `manufacturing_process`. "Capability" remains
   reserved for the ADR-0004 demand container.
2. New optional node fields: `transactability: procurable | must_build`
   (know-how kinds only), `listingStatus` / `ticker` (organizations
   only), `capacityLeadTimeMonths` (reserved, unpopulated).
3. /graph is one persistent radial map with two layers (ADR-0007
   stable identity): the default product layer renders artifact kinds
   only; the know-how layer keeps artifact context visible with low-saturation
   subsystem color and lights know-how nodes as diamonds. User-facing graph
   nodes must not be grey.
4. The canvas tree includes `implemented_by` edges whose target is a
   know-how node, so implemented_by-only know-how attaches to its host.
5. Bottlenecks must survive the split: product-layer hosts carry a
   red-ring count badge for hidden know-how dependencies with
   `bottleneckOf`; the detail panel folds the know-how list (metric
   pattern) with cross-layer jumps.
6. Supply concentration is derived, never stored: holder count =
   distinct non-deprecated orgs via `manufactured_by` /
   `implemented_by`. Zero holders is an explicit red flag.
7. ADR-0005 amendment: mature + holder count ≤ 3 ⇒ still a
   decomposition frontier (the override becomes the rule), scoped to
   decomposable supply-chain kinds.
8. Listing info reads schema fields first, then falls back to the
   ai-chain convention (`public_company` tag + "Public listing"
   metric), so existing data needs no migration to get chips.

## Considered alternatives

- Service-ify all know-how nodes: invents markets that don't exist and
  erases the must_build signal. Rejected.
- Merge know-how into host products as text: demotes 12 flagged
  bottleneck/frontier/key-tech nodes to prose; loses maturity/cost/
  evidence anchoring. Rejected.
- Separate know-how map: breaks spatial memory; a layer over one
  skeleton preserves ADR-0007 stable identity. Rejected.

## Consequences

- Default /graph answers "what do you buy"; one click answers "what
  must be mastered, who holds it, is it listed".
- Mature-but-concentrated nodes re-enter the frontier/task loop.
- ai-chain know-how transactability backfill is a follow-up
  (validate-data warns until then).
- Market attention / expectation gap is deliberately not modelled.

## Amendment — 2026-06-17: display taxonomy and barrier-source UI contract

Schema `kind` is not the same as reader-facing node type. User-facing graph
work must use this display taxonomy:

| Display layer | Schema kinds | Default canvas | Purpose |
|---|---|---|---|
| Artifact / 产业链实体 | `product`, `technical_route`, `module`, `equipment`, key `material` | visible | what is bought, built, integrated, or depended on |
| Know-how / 壁垒来源 | `engineering_method`, `manufacturing_process` | hidden by default; visible in the Barrier Sources layer and detail panels | how the artifact is made or implemented, and why it is hard to replicate |
| Market actor / 公司组织 | `organization` | never visible as a default graph node | supplier, holder, listing, and paid exposure evidence |
| Measurement / evidence | `metric`, `evidence` | never visible as graph nodes | values, source trail, review state, and audit details |
| Context / background | `capability`, principles, standards/regulations | normally detail/gate-only | demand containers, scientific/regulatory context, validation background |

A know-how record should become an independent graph node only when it carries
at least one reader-facing signal:

- it contributes to Barrier (`transactability`, `must_build`, `hard_to_develop`,
  long lead time, qualification/yield/replication difficulty);
- it has modeled holders or organization exposure;
- it is shared by multiple artifacts or explains a route-level chokepoint;
- it carries `bottleneckOf`, `frontierFor`, metrics, or direct evidence;
- it needs its own review status or evidence trail.

Low-signal process/method notes stay inside the host artifact detail instead of
becoming graph nodes.

UI contract:

- The default product/artifact map stays readable and does not render
  know-how, organization, metric, or evidence nodes.
- Artifact nodes may summarize attached know-how as a Barrier signal
  (count, strongest must-build/process barrier, holder scarcity, or evidence
  gap), but the artifact remains the primary map object.
- The secondary layer should read as **Barrier Sources** (or equivalent
  reader-facing wording), not as an internal technical-node dump.
- In that layer, know-how nodes are diamonds; size, outline, saturation, or
  edge weight may encode Barrier contribution, `must_build`, holder scarcity,
  or authored bottleneck state.
- Artifact context in the Barrier Sources layer keeps low-saturation subsystem
  color. Grey user-facing nodes are a hard fail because they make hierarchy and
  routing read as unclassified.
- Organization nodes remain exposure/evidence records in panels and paid
  surfaces; they do not become default canvas nodes.
