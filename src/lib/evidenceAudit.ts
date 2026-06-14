import type { Evidence } from "@/lib/schema";

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
