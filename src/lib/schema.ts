import { z } from "zod";

export const nodeKindSchema = z.enum([
  "product",
  "capability",
  "module",
  "technical_route",
  "scientific_principle",
  "empirical_principle",
  "engineering_method",
  "manufacturing_process",
  "equipment",
  "material",
  "metric",
  "bottleneck",
  "placeholder_breakthrough",
  "standard_or_regulation",
  "organization",
  "evidence",
]);

export const confidenceSchema = z.enum(["low", "medium", "high"]);

export const maturityLabelSchema = z.enum([
  "unknown",
  "hypothesis",
  "lab_proven",
  "prototype",
  "early_deployment",
  "commercially_available",
  "widely_adopted",
  "mature",
  "blocked",
]);

/**
 * Per ADR-0003, metric values extend from `number | string` to a union that
 * additionally accepts a `{min, typical, max}` range. Cost-bearing metrics
 * carry ranges on `currentValue` to capture supplier variance honestly;
 * `targetValue` is typically scalar (the design target) but is allowed to be
 * range-valued too. Existing scalar entries remain valid — the schema is
 * forward-compatible.
 */
export const metricRangeSchema = z.object({
  min: z.number(),
  typical: z.number(),
  max: z.number(),
});

export const metricValueSchema = z.union([z.number(), z.string(), metricRangeSchema]);

/**
 * Per ADR-0003, the supported leaf-cost currencies. `currency` defaults to
 * `"RMB"` when missing on a cost-bearing metric — see `scripts/fx-constants.ts`
 * for the FX→RMB conversion table consumed by the rollup walker.
 */
export const metricCurrencySchema = z.enum(["RMB", "USD", "EUR", "JPY"]);

/**
 * Per ADR-0002, `maturityAsOf` is required whenever any maturity field is
 * set so a maturity claim is never undated. Zod can't easily express
 * "required when X is set", so we keep `maturityAsOf` `.optional()` at the
 * shape level and enforce the conditional via `.refine()` below. The
 * `maturityLabel: "unknown"` value escapes the rule (per ADR-0002 it
 * encodes "we don't know yet" — there is nothing to date).
 *
 * Returned as a function so callers can apply it after `.strict()` (which
 * is not available on `ZodEffects`). Both `nodeSchema` and the strict
 * variant used by `scripts/import-candidates.ts` chain this on top.
 */
type NodeShape = {
  maturityScore?: number;
  maturityLabel?: string;
  maturityAsOf?: string;
};

export const maturityAsOfRequiredWhenSet = (node: NodeShape): boolean => {
  const hasMaturityClaim =
    node.maturityScore !== undefined ||
    (node.maturityLabel !== undefined && node.maturityLabel !== "unknown");
  if (!hasMaturityClaim) return true;
  return Boolean(node.maturityAsOf);
};

export const maturityAsOfRequiredMessage =
  "maturityAsOf is required when any maturity field is set (per ADR-0002)";

/**
 * Per ADR-0002, `maturityHistory` is the reserved time-series field for the
 * future time-slider. Each entry carries an `asOf` ISO date (YYYY-MM or
 * YYYY-MM-DD) plus optional `score`, `label`, and `source` (provenance tag,
 * e.g. agent run id or `"ralph_iter34_stub"` for stub data). v0 leaves this
 * empty on most nodes; iter-34 populated it on a handful of representative
 * nodes to demonstrate the time dimension in stub form.
 */
export const maturityHistoryEntrySchema = z.object({
  asOf: z
    .string()
    .regex(/^\d{4}-\d{2}(?:-\d{2})?$/, "maturityHistory[].asOf must be ISO YYYY-MM or YYYY-MM-DD"),
  score: z.number().min(0).max(100).optional(),
  label: maturityLabelSchema.optional(),
  source: z.string().optional(),
});

const nodeBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: nodeKindSchema,
  domain: z.array(z.string().min(1)).min(1),
  description: z.string().optional(),
  maturityScore: z.number().min(0).max(100).optional(),
  maturityLabel: maturityLabelSchema.optional(),
  maturityAsOf: z
    .string()
    .regex(/^\d{4}-\d{2}(?:-\d{2})?$/, "maturityAsOf must be ISO YYYY-MM or YYYY-MM-DD")
    .optional(),
  /**
   * Per ADR-0002, reserved time-series of historical maturity assessments.
   * v0 leaves this empty on most nodes; populated on a handful of
   * representative nodes to demonstrate the time dimension. The latest
   * entry, when present, should match the current scalar
   * `maturityAsOf`/`maturityScore`/`maturityLabel` triple.
   */
  maturityHistory: z.array(maturityHistoryEntrySchema).optional(),
  confidence: confidenceSchema.optional(),
  targetContext: z
    .object({
      targetCost: z.string().optional(),
      targetScale: z.string().optional(),
      targetPerformance: z.string().optional(),
      targetUseCase: z.string().optional(),
      targetEnvironment: z.string().optional(),
      targetDate: z.string().optional(),
      targetEndEffector: z.string().optional(),
      /**
       * Per CONTEXT.md "Capability node" L8, a Capability's `targetContext`
       * captures the total scenario (facility size, daily throughput,
       * parcel-spec range, environment, region, shift pattern) that future
       * capability-level scoring will need as input. These fields are
       * free-form strings, optional everywhere, and are populated on
       * Capability nodes now even though scoring is deferred.
       */
      facilitySize: z.string().optional(),
      dailyThroughput: z.string().optional(),
      parcelSpecRange: z.string().optional(),
      environment: z.string().optional(),
      region: z.string().optional(),
      shiftPattern: z.string().optional(),
    })
    .optional(),
  metrics: z
    .array(
      z.object({
        name: z.string().min(1),
        unit: z.string().optional(),
        currentValue: metricValueSchema.optional(),
        targetValue: metricValueSchema.optional(),
        /**
         * Per ADR-0003, the year a cost (or other time-sensitive) metric is
         * stated in. Year precision (e.g. `"2025"`); mirrors `maturityAsOf`
         * but coarser. Required by `validate:data` on cost-bearing metrics.
         */
        costAsOf: z
          .string()
          .regex(/^\d{4}$/, "costAsOf must be a 4-digit year string, e.g. \"2025\"")
          .optional(),
        currency: metricCurrencySchema.optional(),
        description: z.string().optional(),
      }),
    )
    .optional(),
  evidenceIds: z.array(z.string()).optional(),
  /**
   * Per the 2026-06-11 owner audit: evidence demoted from claim support
   * (404 / generic_homepage / wrong_topic / market_report_seo / unreachable)
   * moves here instead of being deleted — the audit trail survives without
   * counting as support. The demoted record's `limitations` field carries
   * the rejection reason. UI must never render these as citations.
   */
  rejectedEvidenceIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  reviewStatus: z.enum(["unreviewed", "reviewed", "disputed", "deprecated"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  /**
   * Per ADR-0006, the dedicated `kind: "bottleneck"` and
   * `kind: "placeholder_breakthrough"` nodes are deprecated. Structural
   * nodes (module / material / etc.) now carry these two optional
   * attributes that fold the former separate-node form into the affected
   * module itself:
   *
   *   - `bottleneckOf`: ids of capabilities / products this node currently
   *     bottlenecks. Populated by the A1 migration from former
   *     `bottlenecked_by` edges whose target was a `bottleneck`-kind node.
   *   - `frontierFor`: ids of capabilities / products this node is a
   *     decomposition frontier for. Populated by the A1 migration from
   *     former `bottlenecked_by` edges whose target was a
   *     `placeholder_breakthrough`-kind node.
   *
   * Both stay optional and undefined for the vast majority of nodes.
   */
  bottleneckOf: z.array(z.string()).optional(),
  frontierFor: z.array(z.string()).optional(),
  /**
   * Per ADR-0008 (product/know-how layer split): the transactional form
   * of a know-how node. `procurable` = a real market sells this as a
   * service / dataset / license (conceptually a service product);
   * `must_build` = no one sells it separately — it exists embodied in
   * firms' products or vertical integration (moat / bottleneck
   * candidate). Only meaningful on `engineering_method` /
   * `manufacturing_process` nodes (enforced by refinement below).
   */
  transactability: z.enum(["procurable", "must_build"]).optional(),
  /**
   * Per ADR-0008 + investor-operator scenario Q3: public-market
   * visibility of an organization. `subsidiary` = belongs to a listed
   * parent, and the parent's ticker goes in `ticker` when that public
   * exposure is relevant. Delisted or private subsidiaries can omit
   * `ticker`. Only meaningful on `organization` nodes (enforced by
   * refinement below).
   */
  listingStatus: z.enum(["public", "private", "subsidiary", "unknown"]).optional(),
  /** Exchange ticker (e.g. "6954.T", "NVDA"). Organization nodes only. */
  ticker: z.string().min(1).optional(),
  /**
   * Reserved per ADR-0008 (maturityHistory pattern: field first,
   * population deferred): months of lead time to expand supply
   * capacity for this node — the shiso-leaf criterion with no other
   * graph counterpart. Not populated in v0.
   */
  capacityLeadTimeMonths: z.number().positive().optional(),
  /**
   * Reserved (population deferred, `unreviewed` by default), per ADR-0010 and
   * the maturityHistory/​capacityLeadTimeMonths reserved-field pattern: a
   * `product` node's capex / demand scale, used to weight downstream
   * Criticality. Within a single product it is a constant multiplier; it
   * only re-orders nodes across multiple products (the deferred cross-product
   * view). Unset ⇒ Criticality weight defaults to 1.
   */
  demandScale: z.number().positive().optional(),
});

const NODE_KNOW_HOW_KINDS = new Set(["engineering_method", "manufacturing_process"]);

export const nodeSchema = nodeBaseSchema
  .refine(maturityAsOfRequiredWhenSet, {
    message: maturityAsOfRequiredMessage,
    path: ["maturityAsOf"],
  })
  .refine(
    (node) => node.transactability === undefined || NODE_KNOW_HOW_KINDS.has(node.kind),
    { message: "transactability is only valid on engineering_method / manufacturing_process nodes" },
  )
  .refine(
    (node) =>
      (node.listingStatus === undefined && node.ticker === undefined) ||
      node.kind === "organization",
    { message: "listingStatus / ticker are only valid on organization nodes" },
  );

/**
 * Strict variants for `scripts/import-candidates.ts`. The "loose" form (no
 * refine) is used for the initial read so the import script can default
 * `maturityAsOf` to the current YYYY-MM on agent imports before the
 * required-when-set rule is enforced. The "checked" form re-applies the
 * rule after defaults are filled in. `.strict()` lives on `ZodObject` not
 * `ZodEffects`, so we apply it before chaining the refine.
 */
export const strictNodeSchemaLoose = nodeBaseSchema.strict();

export const strictNodeSchema = strictNodeSchemaLoose.refine(
  maturityAsOfRequiredWhenSet,
  {
    message: maturityAsOfRequiredMessage,
    path: ["maturityAsOf"],
  },
);

export const edgeRelationSchema = z.enum([
  "requires",
  "enables",
  "improves",
  "substitutes",
  "bottlenecked_by",
  "measured_by",
  "validated_by",
  "manufactured_by",
  "regulated_by",
  "part_of",
  "has_route",
  "implemented_by",
  "depends_on_metric",
  /**
   * Per ADR-0009 (2026-06-11): `manufactured_by` was being overloaded to
   * express qualification, ownership, outsourcing, and strategic-supply
   * semantics. These relations split those meanings; `manufactured_by`
   * keeps meaning "actually manufactures this today". Renderers that only
   * understand `manufactured_by` simply do not display the weaker
   * relations — the correct conservative behavior for unverified links.
   */
  "qualified_supplier",
  "reported_capable_supplier",
  "strategic_supplier_to",
  "owned_by",
  "capacity_provider",
  "second_source_candidate",
  "allocation_locked_by",
]);

export const edgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  relation: edgeRelationSchema,
  claim: z.string().optional(),
  context: z.string().optional(),
  confidence: confidenceSchema.optional(),
  evidenceIds: z.array(z.string()).optional(),
  routeId: z.string().optional(),
  weight: z.number().min(0).optional(),
  reviewStatus: z.enum(["unreviewed", "reviewed", "disputed", "deprecated"]).optional(),
});

export const evidenceTypeSchema = z.enum([
  "paper",
  "patent",
  "product_page",
  "standard",
  "field_case",
  "benchmark",
  "clinical_trial",
  "regulatory_approval",
  "expert_review",
  "vendor_claim",
  "news",
  "internal_note",
  "historical_source",
]);

/**
 * Per the 2026-06-11 owner audit: a citation's existence is not its validity.
 * `sourceStatus` records the latest verification outcome of the evidence URL.
 * Set mechanically by the URL-audit pass; upgraded to `ok_exact` only after a
 * human or strong-model reviewer confirmed the page supports the claim
 * (quote-level match).
 */
export const evidenceSourceStatusSchema = z.enum([
  "ok_exact",          // fetched + claim-level match confirmed by reviewer
  "fetch_ok",          // URL resolves (200); content not yet claim-checked
  "paywalled_snippet", // 403/401/paywall; verified only via snippet/secondary
  "generic_homepage",  // resolves but points at a homepage/section, not the claim
  "shared_url_suspect",// one URL recycled across many records; needs splitting
  "404",               // dead link
  "unreachable",       // DNS/timeout
  "wrong_topic",       // resolves to unrelated content
  "vendor_marketing",  // resolves but is the vendor's own marketing page
  "market_report_seo", // SEO-grade market-report page; numbers need a better source
]);

/**
 * Orthogonal to reviewStatus. Granted by the audit agent, NEVER implies human
 * judgment (see ADR-0001). Only `verified` (source re-fetched, excerpt found,
 * number supported) earns the public "source re-checked" signal and the 4/5
 * gate cap lift. See docs/superpowers/specs/2026-06-14-evidence-credibility-audit-agent-design.md.
 */
export const machineCheckSchema = z.object({
  status: z.enum(["verified", "structural_ok", "needs_fetch", "failed"]),
  checkedAsOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "machineCheck.checkedAsOf must be ISO YYYY-MM-DD"),
  quoteMatch: z.enum(["exact", "partial", "absent", "not_checked"]).optional(),
  numberInQuote: z.boolean().optional(),
  notes: z.string().optional(),
});

export const evidenceSchema = z.object({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  title: z.string().min(1),
  url: z.string().url().optional(),
  sourceStatus: evidenceSourceStatusSchema.optional(),
  sourceName: z.string().optional(),
  date: z.string().optional(),
  summary: z.string().optional(),
  excerpt: z.string().optional(),
  supportsNodeIds: z.array(z.string()).optional(),
  supportsEdgeIds: z.array(z.string()).optional(),
  limitations: z.string().optional(),
  confidence: confidenceSchema.optional(),
  reviewStatus: z.enum(["unreviewed", "reviewed", "disputed", "deprecated"]).optional(),
  machineCheck: machineCheckSchema.optional(),
});

export const gateQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
});

export const gateReportSchema = z.object({
  graphVersion: z.string(),
  targetNodeId: z.string(),
  generatedAt: z.string(),
  questionResults: z.array(
    z.object({
      /**
       * Per iter-15 review (P0 #2), `questionId` persists the GateQuestion
       * id alongside the rendered text so UI consumers (e.g. cost-question
       * coverage-gap collapsible) can identify the question without
       * matching against the localizable English question string. Optional
       * for backwards compat with reports generated before the schema bump
       * — readers fall back to text-equality on those.
       */
      questionId: z.string().optional(),
      question: z.string(),
      answer: z.string(),
      score: z.number().min(0).max(5),
      missingNodeIds: z.array(z.string()).optional(),
      missingEdgeDescriptions: z.array(z.string()).optional(),
      missingEvidenceDescriptions: z.array(z.string()).optional(),
      safetyNotes: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }),
  ),
  overallScore: z.number().min(0).max(5),
  passed: z.boolean(),
  recommendedNextTasks: z.array(
    z.object({
      title: z.string(),
      reason: z.string(),
      targetNodeId: z.string().optional(),
      suggestedNodeKind: nodeKindSchema.optional(),
      priority: z.enum(["low", "medium", "high"]),
      /**
       * Discriminator for surfacing distinct task families in the UI per
       * ADR-0001. `resolve_dispute` tasks come from `disputed`-status records
       * and need separate styling so a learner can see at a glance that a
       * human is needed to break the tie. `human_review` tasks come from
       * `unreviewed`-status records. Other tasks (missing modules / metrics /
       * evidence backfill) are kindless.
       */
      kind: z.enum(["resolve_dispute", "human_review"]).optional(),
    }),
  ),
});

export const researchTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  reason: z.string().min(1),
  targetNodeId: z.string().optional(),
  suggestedNodeKind: nodeKindSchema.optional(),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "in_progress", "done", "wont_do"]),
  createdAt: z.string(),
  sourceGateReportId: z.string().optional(),
});

export type NodeKind = z.infer<typeof nodeKindSchema>;
export type MaturityHistoryEntry = z.infer<typeof maturityHistoryEntrySchema>;
export type MetricRange = z.infer<typeof metricRangeSchema>;
export type MetricCurrency = z.infer<typeof metricCurrencySchema>;
export type MetricValue = z.infer<typeof metricValueSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type EdgeRelation = z.infer<typeof edgeRelationSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type MachineCheck = z.infer<typeof machineCheckSchema>;
export type GateQuestion = z.infer<typeof gateQuestionSchema>;
export type GateReport = z.infer<typeof gateReportSchema>;
export type ResearchTask = z.infer<typeof researchTaskSchema>;
export type Transactability = "procurable" | "must_build";
export type ListingStatus = "public" | "private" | "subsidiary" | "unknown";

export type GraphData = {
  graphVersion: string;
  nodes: Node[];
  edges: Edge[];
  evidence: Evidence[];
};
