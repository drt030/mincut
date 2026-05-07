---
status: accepted
---

# Time-stamped maturity: scalar plus reserved history

## Context

A product's maturity changes over time. The roadmap envisions a future time-slider UI that scrubs from year *X* (where the product was 0% mature) to the current day, visualizing how a Product (and its dependencies) climbed toward "mature / widely_adopted". The current schema (`src/lib/schema.ts`) treats `maturityScore` and `maturityLabel` as scalars without any time stamp — so today's data has no anchor for *when* an assessment was made, and there's no path to historical maturity at all.

We need to record maturity *as a function of time* without doing a full schema migration in v0. Each maturity assessment must carry the date at which it was valid, and the data shape must extend cleanly to a per-node history list when the time slider is built.

## Decision

Maturity is a **time-stamped assertion**, recorded at v0 as a scalar with a required `maturityAsOf` date and an optional reserved `maturityHistory` array:

- **`maturityScore` (0–100, optional)** and **`maturityLabel` (enum, optional)** — the current best estimate (unchanged).
- **`maturityAsOf` (ISO date string, e.g. `"2026-04"`, `"2026-04-15"`)** — **required** whenever any maturity field is set. Marks the date the assessment is valid as of. v0 uses month precision; finer precision is allowed if known.
- **`maturityHistory: [{asOf, score?, label?, source?}]` (optional array)** — reserved for the time-slider feature. v0 leaves this empty. Re-assessments in v0 overwrite the scalar trio rather than appending.

When the time slider is built (Phase 7), the current scalar becomes the latest entry in `maturityHistory`, and earlier assessments populate prior entries. No data migration is needed — only an additive use of the reserved field.

Operational rules:

- `validate:data` rejects records with any maturity field set and `maturityAsOf` missing, and rejects `maturityHistory` entries whose `asOf` is later than the scalar's `maturityAsOf`.
- `import:candidates` defaults `maturityAsOf` to the current date when the candidate file omits it (the agent is assessing *now*).
- Existing data is backfilled with `maturityAsOf: "2026-04"` (the month the v0 corpus was authored).
- Agents must set `maturityAsOf` whenever they touch maturity; not setting it is a `validate:data` error.

## Considered alternatives

- **(a) Single `assessedAt` scalar without history**. Rejected: doesn't preserve any time-series, so the time slider would have no data to replay even after it ships. Forces a second migration when the slider lands.
- **(b) Replace scalars with a required time-series array** `[{asOf, score, label}]`. Rejected: every read site (`gateRunner.ts`, UI, `productMaturity`) would need to pick "the latest" at query time, a non-trivial v0 change. We don't gain anything in v0 because no historical data exists yet.
- **(d) Make each maturity assessment a separate `maturity_assessment` node connected by edges**. Rejected: most graph-native, but every maturity read becomes a neighbor traversal, polluting the gate runner's hot path. Also bloats the graph in the v0 case where each node has at most one assessment.

## Consequences

- `Node` schema gains `maturityAsOf: string` and `maturityHistory?: array(...)` fields.
- `validate:data` gains a paired-presence check (any maturity field implies `maturityAsOf`) and a temporal-ordering check on `maturityHistory`.
- All current node files require a one-time backfill of `maturityAsOf: "2026-04"`.
- Agent expansion and `NODE_EXPANSION.md` must document that `maturityAsOf` is mandatory whenever maturity is set.
- Gate runner reads remain unchanged (still reads scalars).
- The **Decomposition stop condition** (commodified-leaf rule) is implicitly time-relative — `maturityLabel ∈ {mature, widely_adopted}` is read as "as of `maturityAsOf`". Once the time slider lands, the stop condition must read maturity *at the slider's date*, not the latest. Deferred to Phase 7.

## Revisit when

- The time slider is being built — at that point, scalar fields are folded into `maturityHistory[last]` and read paths are updated.
- Re-assessment cadence becomes high enough that v0's "overwrite scalar" pattern loses important historical context (in which case migrate `maturityHistory` adoption forward).
- A use case appears for assessments scoped to a region or counterfactual (`maturityAsOf` may need to extend to `{asOf, region?, scenario?}`).
