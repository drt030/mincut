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
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  reviewStatus: z.enum(["unreviewed", "reviewed", "disputed", "deprecated"]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const nodeSchema = nodeBaseSchema.refine(maturityAsOfRequiredWhenSet, {
  message: maturityAsOfRequiredMessage,
  path: ["maturityAsOf"],
});

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

export const evidenceSchema = z.object({
  id: z.string().min(1),
  type: evidenceTypeSchema,
  title: z.string().min(1),
  url: z.string().url().optional(),
  sourceName: z.string().optional(),
  date: z.string().optional(),
  summary: z.string().optional(),
  excerpt: z.string().optional(),
  supportsNodeIds: z.array(z.string()).optional(),
  supportsEdgeIds: z.array(z.string()).optional(),
  limitations: z.string().optional(),
  confidence: confidenceSchema.optional(),
  reviewStatus: z.enum(["unreviewed", "reviewed", "disputed", "deprecated"]).optional(),
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
export type MetricRange = z.infer<typeof metricRangeSchema>;
export type MetricCurrency = z.infer<typeof metricCurrencySchema>;
export type MetricValue = z.infer<typeof metricValueSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type EdgeRelation = z.infer<typeof edgeRelationSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type GateQuestion = z.infer<typeof gateQuestionSchema>;
export type GateReport = z.infer<typeof gateReportSchema>;
export type ResearchTask = z.infer<typeof researchTaskSchema>;

export type GraphData = {
  graphVersion: string;
  nodes: Node[];
  edges: Edge[];
  evidence: Evidence[];
};
