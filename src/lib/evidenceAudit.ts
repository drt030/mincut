import { z } from "zod";
import type { Evidence, GraphData } from "@/lib/schema";

export type TriageBucket = "demote" | "failed" | "needs_fetch" | "structural_ok";

const DEAD_SOURCE_STATUSES = new Set(["404", "unreachable", "wrong_topic", "generic_homepage"]);

export type RecordAudit = {
  id: string;
  bucket: TriageBucket;
  reasons: string[];
  hasExcerpt: boolean;
  numberSupported: boolean | null; // null = no number to check
};

export function hasExcerpt(ev: Evidence): boolean {
  return typeof ev.excerpt === "string" && ev.excerpt.trim().length > 0;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[,\s]/g, "");
}

export function numberInQuote(numberText: string, excerpt: string): boolean {
  const n = normalize(numberText);
  return n.length > 0 && normalize(excerpt).includes(n);
}

/**
 * Pure per-record triage. `supportedNumbers` are numeric strings drawn from the
 * metrics this evidence supports (may be empty). Stakes are applied later
 * (buildWorklist): a `structural_ok` record can be promoted to `needs_fetch`.
 */
export function auditRecord(ev: Evidence, supportedNumbers: string[]): RecordAudit {
  if (DEAD_SOURCE_STATUSES.has(ev.sourceStatus ?? "")) {
    return {
      id: ev.id,
      bucket: "demote",
      reasons: [`dead source: ${ev.sourceStatus}`],
      hasExcerpt: hasExcerpt(ev),
      numberSupported: null,
    };
  }
  const reasons: string[] = [];
  const excerptOk = hasExcerpt(ev);
  if (!excerptOk) reasons.push("missing excerpt");
  let numberSupported: boolean | null = null;
  if (supportedNumbers.length > 0) {
    numberSupported = excerptOk && supportedNumbers.every((n) => numberInQuote(n, ev.excerpt as string));
    if (!numberSupported) reasons.push("claimed number not found in excerpt");
  }
  if (reasons.length > 0) {
    return { id: ev.id, bucket: "failed", reasons, hasExcerpt: excerptOk, numberSupported };
  }
  return { id: ev.id, bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported };
}

export type WorklistInput = {
  evidence: Evidence[];
  supportedNumbersByEvidenceId: Record<string, string[]>;
  highStakesEvidenceIds: Set<string>;
};

/** Run per-record triage, then promote clean high-stakes records to needs_fetch. */
export function buildWorklist(input: WorklistInput): RecordAudit[] {
  return input.evidence.map((ev) => {
    const audit = auditRecord(ev, input.supportedNumbersByEvidenceId[ev.id] ?? []);
    if (audit.bucket === "structural_ok" && input.highStakesEvidenceIds.has(ev.id)) {
      return { ...audit, bucket: "needs_fetch" };
    }
    return audit;
  });
}

export type MechanicalChanges = { demoted: string[]; markedStructuralOk: string[]; markedFailed: string[] };

const BUCKET_TO_STATUS: Record<TriageBucket, "structural_ok" | "failed" | "needs_fetch" | null> = {
  demote: null, // handled via rejectedEvidenceIds, not a machineCheck status
  failed: "failed",
  needs_fetch: "needs_fetch",
  structural_ok: "structural_ok",
};

/**
 * Apply ONLY safe, reversible changes: demote dead records to
 * rejectedEvidenceIds (preserved, never deleted) and stamp machineCheck for
 * non-verified buckets. NEVER writes reviewStatus (red line — see
 * tests/auditNeverWritesReviewed.test.ts). The `verified` status is written
 * separately by applyAgentVerdicts.
 */
export function applyMechanicalChanges(
  graph: GraphData,
  audits: RecordAudit[],
  checkedAsOf: string,
): { graph: GraphData; changes: MechanicalChanges } {
  const byId = new Map(audits.map((a) => [a.id, a]));
  const demoted = new Set(audits.filter((a) => a.bucket === "demote").map((a) => a.id));
  const changes: MechanicalChanges = { demoted: [...demoted], markedStructuralOk: [], markedFailed: [] };

  const nodes = graph.nodes.map((node) => {
    const ev = (node as { evidenceIds?: string[] }).evidenceIds ?? [];
    const toDemote = ev.filter((id) => demoted.has(id));
    if (toDemote.length === 0) return node;
    const rejected = (node as { rejectedEvidenceIds?: string[] }).rejectedEvidenceIds ?? [];
    return {
      ...node,
      evidenceIds: ev.filter((id) => !demoted.has(id)),
      rejectedEvidenceIds: [...rejected, ...toDemote.filter((id) => !rejected.includes(id))],
    };
  });

  const evidence = graph.evidence.map((item) => {
    const audit = byId.get(item.id);
    if (!audit || audit.bucket === "demote") return item;
    const status = BUCKET_TO_STATUS[audit.bucket];
    if (!status) return item;
    if (status === "structural_ok") changes.markedStructuralOk.push(item.id);
    if (status === "failed") changes.markedFailed.push(item.id);
    return {
      ...item,
      machineCheck: { status, checkedAsOf, notes: audit.reasons.join("; ") || undefined },
    };
  });

  return { graph: { ...graph, nodes, evidence }, changes };
}

export const agentVerdictsSchema = z.object({
  verified: z.array(
    z.object({
      id: z.string(),
      quoteMatch: z.enum(["exact", "partial", "absent", "not_checked"]),
      numberInQuote: z.boolean().optional(),
      notes: z.string().optional(),
    }),
  ),
  escalations: z.array(z.object({ id: z.string(), question: z.string() })).max(10),
});
export type AgentVerdicts = z.infer<typeof agentVerdictsSchema>;

/** Marks machineCheck=verified for the agent's confirmed records. NEVER touches reviewStatus. */
export function applyAgentVerdicts(graph: GraphData, verdicts: AgentVerdicts, checkedAsOf: string): { graph: GraphData } {
  const byId = new Map(verdicts.verified.map((v) => [v.id, v]));
  const evidence = graph.evidence.map((item) => {
    const v = byId.get(item.id);
    if (!v) return item;
    return {
      ...item,
      machineCheck: {
        status: "verified" as const,
        checkedAsOf,
        quoteMatch: v.quoteMatch,
        numberInQuote: v.numberInQuote,
        notes: v.notes,
      },
    };
  });
  return { graph: { ...graph, evidence } };
}

/** The ONLY function in the audit core that promotes a record to the reviewed review-status. Owner-gated via --apply-flips. */
export function applyOwnerFlips(graph: GraphData, flipIds: string[]): { graph: GraphData } {
  const flips = new Set(flipIds);
  const evidence = graph.evidence.map((item) =>
    flips.has(item.id) ? { ...item, reviewStatus: "reviewed" as const } : item,
  );
  return { graph: { ...graph, evidence } };
}
