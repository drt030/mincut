# Evidence Credibility Audit Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a script-core + agent-judgment audit pipeline that scales machine verification of evidence, lifts a new `machineCheck` credibility axis (max 4/5 gate), and leaves the owner only owner-`reviewed` flips and ≤10 escalations.

**Architecture:** A new `machineCheck` field on evidence (orthogonal to owner-only `reviewStatus`). A deterministic library (`src/lib/evidenceAudit.ts`) does all structural checks + triage with zero LLM tokens; a CLI (`scripts/audit-evidence.ts`) refreshes `sourceStatus` over HTTP, auto-applies safe mechanical changes, and emits a worklist; an Opus 4.8 subagent (driven by a brief in `docs/agents/`) does only online quote-judgment on the high-stakes subset and emits verdicts; an apply step writes machine verdicts and, separately, owner-approved `reviewed` flips. The gate lifts the unreviewed cap from 3/5 to 4/5 when an unreviewed claim's evidence is `machineCheck.status==="verified"`.

**Tech Stack:** TypeScript, Zod (`src/lib/schema.ts`), `tsx --test` (node:test + `assert/strict`), Next.js client components for UI, existing graph loaders (`src/lib/graphLoader.ts`).

**Conventions for every task below:**
- Tests live in `tests/<name>.test.ts`; run a single file with `npx tsx --test tests/<name>.test.ts`.
- Every commit message is imperative, no prefix, and ends with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Local only — **do not push**.

**Spec refinement (note):** the spec said the cost-scoped cap gets the same machine-verified treatment. v1 **defers** that (Task A2 rationale): cost metrics carry node-level `reviewStatus` that an evidence-level signal does not map onto cleanly. The 4/5 lift applies to the global ladder only in v1.

---

## Phase A — Foundation: schema + gate scoring

### Task A1: Add the `machineCheck` field to the evidence schema

**Files:**
- Modify: `src/lib/schema.ts` (after `evidenceSourceStatusSchema`, ~line 348; field into `evidenceSchema` ~line 350-365; export type near `Evidence` ~line 439)
- Test: `tests/machineCheckSchema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/machineCheckSchema.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { evidenceSchema, machineCheckSchema } from "../src/lib/schema";

test("machineCheck accepts a verified record", () => {
  const parsed = machineCheckSchema.parse({
    status: "verified",
    checkedAsOf: "2026-06-14",
    quoteMatch: "exact",
    numberInQuote: true,
  });
  assert.equal(parsed.status, "verified");
});

test("machineCheck rejects a bad checkedAsOf", () => {
  assert.throws(() => machineCheckSchema.parse({ status: "verified", checkedAsOf: "June 2026" }));
});

test("evidence record round-trips with an optional machineCheck", () => {
  const ev = evidenceSchema.parse({
    id: "ev_x",
    type: "paper",
    title: "T",
    machineCheck: { status: "structural_ok", checkedAsOf: "2026-06-14" },
  });
  assert.equal(ev.machineCheck?.status, "structural_ok");
  const evNone = evidenceSchema.parse({ id: "ev_y", type: "paper", title: "T2" });
  assert.equal(evNone.machineCheck, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/machineCheckSchema.test.ts`
Expected: FAIL — `machineCheckSchema` is not exported.

- [ ] **Step 3: Implement** — add after `evidenceSourceStatusSchema` (after line 348):

```ts
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
```

Add to `evidenceSchema` (after the `reviewStatus` line at ~364):

```ts
  machineCheck: machineCheckSchema.optional(),
```

Add the exported type next to `export type Evidence` (~line 439):

```ts
export type MachineCheck = z.infer<typeof machineCheckSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/machineCheckSchema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts tests/machineCheckSchema.test.ts
git commit -m "Add machineCheck evidence field

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: Lift the gate cap to 4/5 for machine-verified unreviewed claims

**Files:**
- Modify: `src/lib/gateRunner.ts` (caps ~line 45-46; `EvidenceFindings` type ~line 520-535; `evidenceFindingsForContext` ~line 537-555; `applyReviewStatusCap` ~line 565-569)
- Test: `tests/gateMachineVerifiedCap.test.ts`

Rationale: cost-scoped cap (`costScopedReviewStatusCap`) is intentionally **left unchanged** in v1 — it keys on metric-node `reviewStatus`, which the evidence-level `machineCheck` does not map onto cleanly.

- [ ] **Step 1: Write the failing test**

```ts
// tests/gateMachineVerifiedCap.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { runGate } from "../src/lib/gateRunner";
import type { GraphData } from "../src/lib/schema";

// Helper: score of the "evidence supports important claims" question.
function evidenceQuestionScore(report: ReturnType<typeof runGate>): number {
  const q = report.questionResults.find((r) => /evidence supports the most important claims/i.test(r.question));
  if (!q) throw new Error("evidence question not found");
  return q.score;
}

test("machine-verified evidence lifts an unreviewed claim's cap from 3 to 4", () => {
  const base: GraphData = loadActiveGraphData();
  const target = "low_cost_parcel_sorting_robot_300k_rmb";

  // Find every unreviewed evidence record scoped to the target and mark them machineCheck=verified.
  const verified: GraphData = {
    ...base,
    evidence: base.evidence.map((ev) =>
      ev.reviewStatus === "reviewed"
        ? ev
        : { ...ev, machineCheck: { status: "verified" as const, checkedAsOf: "2026-06-14", quoteMatch: "exact" as const, numberInQuote: true } },
    ),
  };

  const before = evidenceQuestionScore(runGate(base, target));
  const after = evidenceQuestionScore(runGate(verified, target));

  assert.ok(before <= 3, `baseline unreviewed cap should hold at <=3, got ${before}`);
  assert.ok(after >= 4 && after <= 4, `machine-verified should lift cap to exactly 4, got ${after}`);
});
```

(If `runGate`'s signature differs, open `src/lib/gateRunner.ts` and match the exported runner; the assertion logic stays the same.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/gateMachineVerifiedCap.test.ts`
Expected: FAIL — `after` is still 3 (cap not lifted).

- [ ] **Step 3: Implement**

Add the constant beside `DISPUTED_CAP`/`UNREVIEWED_CAP` (~line 46):

```ts
const MACHINE_VERIFIED_CAP = 4;
```

Add to the `EvidenceFindings` type (~line 520-535), after `disputedEvidence`:

```ts
  /** Ids of unreviewed claims whose non-deprecated evidence includes a machineCheck=verified record. */
  machineVerifiedClaimIds: Set<string>;
```

In `evidenceFindingsForContext` (~line 537-555), add this property to the returned object:

```ts
    machineVerifiedClaimIds: new Set(
      claims
        .filter((claim) => claim.reviewStatus === "unreviewed")
        .filter((claim) =>
          evidenceForClaim(context.graph, claim)
            .filter((item) => item.reviewStatus !== "deprecated")
            .some((item) => item.machineCheck?.status === "verified"),
        )
        .map((claim) => claim.id),
    ),
```

Replace `applyReviewStatusCap` (~line 565-569):

```ts
function applyReviewStatusCap(findings: EvidenceFindings): number | undefined {
  if (findings.disputedClaims.length > 0 || findings.disputedEvidence.length > 0) return DISPUTED_CAP;
  const bareUnreviewed = findings.unreviewedClaims.filter(
    (claim) => !findings.machineVerifiedClaimIds.has(claim.id),
  );
  if (bareUnreviewed.length > 0) return UNREVIEWED_CAP;            // any bare unreviewed → 3
  if (findings.machineVerifiedClaimIds.size > 0) return MACHINE_VERIFIED_CAP; // all remaining machine-verified → 4
  return undefined;                                                // all reviewed → 5
}
```

- [ ] **Step 4: Run tests**

Run: `npx tsx --test tests/gateMachineVerifiedCap.test.ts` → PASS.
Run: `npm test` → all green (no regression in existing gate tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gateRunner.ts tests/gateMachineVerifiedCap.test.ts
git commit -m "Lift gate cap to 4/5 for machine-verified unreviewed claims

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Deterministic audit core

### Task B1: Structural checks + per-record triage (pure functions)

**Files:**
- Create: `src/lib/evidenceAudit.ts`
- Test: `tests/evidenceAudit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/evidenceAudit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { auditRecord, numberInQuote } from "../src/lib/evidenceAudit";
import type { Evidence } from "../src/lib/schema";

const base: Evidence = { id: "ev", type: "paper", title: "T", sourceStatus: "fetch_ok", excerpt: "TSMC holds about 70% foundry share." };

test("numberInQuote ignores commas/spaces", () => {
  assert.equal(numberInQuote("1,500", "throughput is 1500 pph"), true);
  assert.equal(numberInQuote("72", "about 70% share"), false);
});

test("dead source → demote", () => {
  const a = auditRecord({ ...base, sourceStatus: "404" }, []);
  assert.equal(a.bucket, "demote");
});

test("missing excerpt → failed", () => {
  const a = auditRecord({ ...base, excerpt: undefined }, []);
  assert.equal(a.bucket, "failed");
  assert.ok(a.reasons.some((r) => /excerpt/.test(r)));
});

test("claimed number absent from excerpt → failed", () => {
  const a = auditRecord(base, ["72"]);
  assert.equal(a.bucket, "failed");
  assert.ok(a.reasons.some((r) => /number/.test(r)));
});

test("clean record with supported number → structural_ok", () => {
  const a = auditRecord(base, ["70"]);
  assert.equal(a.bucket, "structural_ok");
  assert.deepEqual(a.reasons, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/evidenceAudit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/evidenceAudit.ts
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
 * (Task B2): a `structural_ok` record can be promoted to `needs_fetch`.
 */
export function auditRecord(ev: Evidence, supportedNumbers: string[]): RecordAudit {
  if (DEAD_SOURCE_STATUSES.has(ev.sourceStatus ?? "")) {
    return { id: ev.id, bucket: "demote", reasons: [`dead source: ${ev.sourceStatus}`], hasExcerpt: hasExcerpt(ev), numberSupported: null };
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/evidenceAudit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/evidenceAudit.ts tests/evidenceAudit.test.ts
git commit -m "Add deterministic evidence triage core

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: High-stakes classifier + worklist builder

**Files:**
- Modify: `src/lib/evidenceAudit.ts`
- Test: `tests/evidenceAuditWorklist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/evidenceAuditWorklist.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildWorklist } from "../src/lib/evidenceAudit";
import type { Evidence } from "../src/lib/schema";

const clean = (id: string, over: Partial<Evidence> = {}): Evidence => ({
  id, type: "paper", title: id, sourceStatus: "fetch_ok", excerpt: "share is about 70%", ...over,
});

test("clean high-stakes record becomes needs_fetch; low-stakes stays structural_ok", () => {
  const evidence = [clean("ev_hot"), clean("ev_cold")];
  const wl = buildWorklist({
    evidence,
    supportedNumbersByEvidenceId: { ev_hot: ["70"], ev_cold: ["70"] },
    highStakesEvidenceIds: new Set(["ev_hot"]),
  });
  assert.equal(wl.find((r) => r.id === "ev_hot")?.bucket, "needs_fetch");
  assert.equal(wl.find((r) => r.id === "ev_cold")?.bucket, "structural_ok");
});

test("dead source stays demote even when high-stakes", () => {
  const wl = buildWorklist({
    evidence: [clean("ev", { sourceStatus: "404" })],
    supportedNumbersByEvidenceId: {},
    highStakesEvidenceIds: new Set(["ev"]),
  });
  assert.equal(wl[0].bucket, "demote");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/evidenceAuditWorklist.test.ts`
Expected: FAIL — `buildWorklist` not exported.

- [ ] **Step 3: Implement** — append to `src/lib/evidenceAudit.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/evidenceAuditWorklist.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/evidenceAudit.ts tests/evidenceAuditWorklist.test.ts
git commit -m "Add high-stakes worklist builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: Mechanical change applier (sourceStatus refresh, demote, machineCheck)

**Files:**
- Modify: `src/lib/evidenceAudit.ts`
- Test: `tests/evidenceAuditApply.test.ts`

These functions are pure (no I/O): given a graph and triage results, return a new graph + a record of changes. The CLI (Task B4) supplies HTTP results and writes files.

- [ ] **Step 1: Write the failing test**

```ts
// tests/evidenceAuditApply.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { applyMechanicalChanges } from "../src/lib/evidenceAudit";
import type { GraphData } from "../src/lib/schema";

const graph: GraphData = {
  graphVersion: "t",
  nodes: [{ id: "n1", name: "N1", kind: "module", evidenceIds: ["ev_dead", "ev_ok"] }],
  edges: [],
  evidence: [
    { id: "ev_dead", type: "paper", title: "dead", sourceStatus: "404" },
    { id: "ev_ok", type: "paper", title: "ok", sourceStatus: "fetch_ok", excerpt: "70%" },
  ],
} as unknown as GraphData;

test("demote moves a dead record from evidenceIds to rejectedEvidenceIds and never deletes it", () => {
  const { graph: next, changes } = applyMechanicalChanges(graph, [
    { id: "ev_dead", bucket: "demote", reasons: ["dead source: 404"], hasExcerpt: false, numberSupported: null },
    { id: "ev_ok", bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported: true },
  ], "2026-06-14");

  const n1 = next.nodes[0] as { evidenceIds?: string[]; rejectedEvidenceIds?: string[] };
  assert.deepEqual(n1.evidenceIds, ["ev_ok"]);
  assert.deepEqual(n1.rejectedEvidenceIds, ["ev_dead"]);
  assert.ok(next.evidence.some((e) => e.id === "ev_dead"), "record is preserved, not deleted");

  const ok = next.evidence.find((e) => e.id === "ev_ok");
  assert.equal(ok?.machineCheck?.status, "structural_ok");
  assert.ok(changes.demoted.includes("ev_dead"));
});

test("applier never writes reviewStatus", () => {
  const { graph: next } = applyMechanicalChanges(graph, [
    { id: "ev_ok", bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported: true },
  ], "2026-06-14");
  assert.equal(next.evidence.find((e) => e.id === "ev_ok")?.reviewStatus, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/evidenceAuditApply.test.ts`
Expected: FAIL — `applyMechanicalChanges` not exported.

- [ ] **Step 3: Implement** — append to `src/lib/evidenceAudit.ts`:

```ts
import type { GraphData } from "@/lib/schema";

export type MechanicalChanges = { demoted: string[]; markedStructuralOk: string[]; markedFailed: string[] };

const BUCKET_TO_STATUS: Record<TriageBucket, "structural_ok" | "failed" | "needs_fetch" | null> = {
  demote: null,        // handled via rejectedEvidenceIds, not a machineCheck status
  failed: "failed",
  needs_fetch: "needs_fetch",
  structural_ok: "structural_ok",
};

/**
 * Apply ONLY safe, reversible changes: demote dead records to
 * rejectedEvidenceIds (preserved, never deleted) and stamp machineCheck for
 * non-verified buckets. NEVER writes reviewStatus (red line — see Task B5).
 * The `verified` status is written separately by applyAgentVerdicts (Task C1).
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/evidenceAuditApply.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/evidenceAudit.ts tests/evidenceAuditApply.test.ts
git commit -m "Add mechanical change applier for evidence audit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B4: CLI — `scripts/audit-evidence.ts` + npm script

**Files:**
- Create: `scripts/audit-evidence.ts`
- Modify: `package.json` (scripts)
- Test: manual run (the CLI orchestrates I/O; pure logic is already covered by B1-B3)

- [ ] **Step 1: Implement the CLI**

```ts
// scripts/audit-evidence.ts
// Usage:
//   npx tsx scripts/audit-evidence.ts --domain ai-compute            (offline triage + report)
//   npx tsx scripts/audit-evidence.ts --domain ai-compute --refresh  (also HTTP-refresh sourceStatus)
import { writeFileSync, mkdirSync } from "node:fs";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import { loadActiveGraphData } from "../src/lib/graphLoader";
import { buildWorklist, applyMechanicalChanges, type RecordAudit } from "../src/lib/evidenceAudit";
import type { GraphData, Node } from "../src/lib/schema";

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? "" : undefined;
};
const has = (flag: string) => process.argv.includes(flag);
const today = () => new Date().toISOString().slice(0, 10);

function numericStrings(node: Node): string[] {
  // metric value tokens worth checking against an excerpt (e.g. "70", "1,500").
  const raw = [node.value, ...(node.tags ?? [])].filter(Boolean).join(" ");
  return Array.from(raw.matchAll(/\d[\d,.]*/g)).map((m) => m[0]);
}

async function refreshSourceStatus(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (res.status === 404) return "404";
    if (res.status === 401 || res.status === 403) return "paywalled_snippet";
    if (!res.ok) return "unreachable";
    return "fetch_ok";
  } catch {
    return "unreachable";
  }
}

async function main() {
  const slug = arg("--domain");
  const domain = DOMAIN_ROUTES.find((d) => d.slug === slug);
  if (!domain) {
    console.error(`Unknown --domain. Choices: ${DOMAIN_ROUTES.map((d) => d.slug).join(", ")}`);
    process.exit(1);
  }
  let graph: GraphData = loadActiveGraphData();

  if (has("--refresh")) {
    for (const ev of graph.evidence) {
      if (ev.url) (ev as { sourceStatus?: string }).sourceStatus = await refreshSourceStatus(ev.url);
    }
  }

  // Build supportedNumbers + high-stakes set from the scoped graph.
  const supportedNumbersByEvidenceId: Record<string, string[]> = {};
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const ev of graph.evidence) {
    const nums = (ev.supportsNodeIds ?? []).flatMap((id) => {
      const n = nodeById.get(id);
      return n ? numericStrings(n) : [];
    });
    if (nums.length) supportedNumbersByEvidenceId[ev.id] = nums;
  }
  // High-stakes: evidence supporting a bottleneck node (cheap proxy for gate weight).
  const bottleneckNodeIds = new Set(graph.nodes.filter((n) => (n.bottleneckOf?.length ?? 0) > 0).map((n) => n.id));
  const highStakesEvidenceIds = new Set(
    graph.evidence.filter((ev) => (ev.supportsNodeIds ?? []).some((id) => bottleneckNodeIds.has(id))).map((ev) => ev.id),
  );

  const worklist: RecordAudit[] = buildWorklist({ evidence: graph.evidence, supportedNumbersByEvidenceId, highStakesEvidenceIds });
  const { graph: next, changes } = applyMechanicalChanges(graph, worklist, today());

  const outDir = `.scratch/audit-${slug}-${today()}`;
  mkdirSync(outDir, { recursive: true });
  const counts = worklist.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.bucket]: (acc[r.bucket] ?? 0) + 1 }), {});
  writeFileSync(`${outDir}/worklist.json`, JSON.stringify({ slug, counts, worklist }, null, 2));
  writeFileSync(`${outDir}/report.md`, [
    `# Evidence audit — ${slug} (${today()})`,
    ``,
    `Buckets: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" · ")}`,
    `Auto-applied: demoted=${changes.demoted.length}, structural_ok=${changes.markedStructuralOk.length}, failed=${changes.markedFailed.length}`,
    ``,
    `## needs_fetch (hand to the judgment subagent)`,
    ...worklist.filter((r) => r.bucket === "needs_fetch").map((r) => `- ${r.id}`),
    ``,
    `## failed (fix list)`,
    ...worklist.filter((r) => r.bucket === "failed").map((r) => `- ${r.id}: ${r.reasons.join("; ")}`),
  ].join("\n"));

  console.log(`Wrote ${outDir}/report.md and worklist.json. Buckets:`, counts);
  console.log("NOTE: mechanical changes computed in-memory; persisting to data/ files is a follow-up writer step.");
  void next; // graph with mechanical changes; persistence handled by the writer in a later iteration
}

main();
```

- [ ] **Step 2: Add the npm script** — in `package.json` `scripts`, after `"gate"`:

```json
    "audit:evidence": "tsx scripts/audit-evidence.ts",
```

- [ ] **Step 3: Run it**

Run: `npm run audit:evidence -- --domain ai-compute`
Expected: prints bucket counts (the `404` records appear under demote) and writes `.scratch/audit-ai-compute-<date>/report.md`.

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-evidence.ts package.json
git commit -m "Add audit-evidence CLI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B5: Red-line guard — the audit core never writes `reviewed`

**Files:**
- Test: `tests/auditNeverWritesReviewed.test.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/auditNeverWritesReviewed.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyMechanicalChanges } from "../src/lib/evidenceAudit";
import type { GraphData } from "../src/lib/schema";

test("applyMechanicalChanges never sets reviewStatus on any record", () => {
  const graph = {
    graphVersion: "t", nodes: [], edges: [],
    evidence: [{ id: "ev", type: "paper", title: "t", sourceStatus: "fetch_ok", excerpt: "70%" }],
  } as unknown as GraphData;
  const { graph: next } = applyMechanicalChanges(graph, [
    { id: "ev", bucket: "structural_ok", reasons: [], hasExcerpt: true, numberSupported: true },
  ], "2026-06-14");
  assert.equal(next.evidence[0].reviewStatus, undefined);
});

test("audit core source code contains no reviewStatus assignment", () => {
  const src = readFileSync("src/lib/evidenceAudit.ts", "utf8");
  assert.ok(!/reviewStatus\s*[:=]\s*["']reviewed["']/.test(src), "audit core must never assign reviewStatus: reviewed");
});
```

- [ ] **Step 2: Run** — `npx tsx --test tests/auditNeverWritesReviewed.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/auditNeverWritesReviewed.test.ts
git commit -m "Guard: evidence audit core never writes reviewed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Agent judgment layer

### Task C1: Agent verdict schema + `applyAgentVerdicts` + `--apply-flips`

**Files:**
- Modify: `src/lib/evidenceAudit.ts`
- Modify: `scripts/audit-evidence.ts` (add `--apply-flips <file>` branch)
- Test: `tests/agentVerdicts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/agentVerdicts.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { agentVerdictsSchema, applyAgentVerdicts, applyOwnerFlips } from "../src/lib/evidenceAudit";
import type { GraphData } from "../src/lib/schema";

const graph: GraphData = {
  graphVersion: "t", nodes: [], edges: [],
  evidence: [
    { id: "ev1", type: "paper", title: "t1", sourceStatus: "fetch_ok", excerpt: "70%" },
    { id: "ev2", type: "paper", title: "t2", sourceStatus: "fetch_ok", excerpt: "x" },
  ],
} as unknown as GraphData;

test("verdict schema caps escalations at 10", () => {
  const tooMany = { verified: [], escalations: Array.from({ length: 11 }, (_, i) => ({ id: `e${i}`, question: "q" })) };
  assert.throws(() => agentVerdictsSchema.parse(tooMany));
});

test("applyAgentVerdicts marks verified but never sets reviewStatus", () => {
  const verdicts = agentVerdictsSchema.parse({
    verified: [{ id: "ev1", quoteMatch: "exact", numberInQuote: true }],
    escalations: [{ id: "ev2", question: "quote only says ~70, claim says 72" }],
  });
  const { graph: next } = applyAgentVerdicts(graph, verdicts, "2026-06-14");
  assert.equal(next.evidence.find((e) => e.id === "ev1")?.machineCheck?.status, "verified");
  assert.equal(next.evidence.find((e) => e.id === "ev1")?.reviewStatus, undefined);
});

test("applyOwnerFlips is the ONLY path that sets reviewed", () => {
  const { graph: next } = applyOwnerFlips(graph, ["ev1"]);
  assert.equal(next.evidence.find((e) => e.id === "ev1")?.reviewStatus, "reviewed");
  assert.equal(next.evidence.find((e) => e.id === "ev2")?.reviewStatus, undefined);
});
```

- [ ] **Step 2: Run** — `npx tsx --test tests/agentVerdicts.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement** — append to `src/lib/evidenceAudit.ts`:

```ts
import { z } from "zod";

export const agentVerdictsSchema = z.object({
  verified: z.array(z.object({
    id: z.string(),
    quoteMatch: z.enum(["exact", "partial", "absent", "not_checked"]),
    numberInQuote: z.boolean().optional(),
    notes: z.string().optional(),
  })),
  escalations: z.array(z.object({ id: z.string(), question: z.string() })).max(10),
});
export type AgentVerdicts = z.infer<typeof agentVerdictsSchema>;

/** Marks machineCheck=verified for the agent's confirmed records. NEVER touches reviewStatus. */
export function applyAgentVerdicts(graph: GraphData, verdicts: AgentVerdicts, checkedAsOf: string): { graph: GraphData } {
  const byId = new Map(verdicts.verified.map((v) => [v.id, v]));
  const evidence = graph.evidence.map((item) => {
    const v = byId.get(item.id);
    if (!v) return item;
    return { ...item, machineCheck: { status: "verified" as const, checkedAsOf, quoteMatch: v.quoteMatch, numberInQuote: v.numberInQuote, notes: v.notes } };
  });
  return { graph: { ...graph, evidence } };
}

/** The ONLY function in the codebase that sets reviewStatus: "reviewed". Owner-gated via --apply-flips. */
export function applyOwnerFlips(graph: GraphData, flipIds: string[]): { graph: GraphData } {
  const flips = new Set(flipIds);
  const evidence = graph.evidence.map((item) => (flips.has(item.id) ? { ...item, reviewStatus: "reviewed" as const } : item));
  return { graph: { ...graph, evidence } };
}
```

- [ ] **Step 4: Run** — `npx tsx --test tests/agentVerdicts.test.ts` → PASS.

- [ ] **Step 5: Extend the red-line test** — append to `tests/auditNeverWritesReviewed.test.ts`:

```ts
test("only applyOwnerFlips assigns reviewed in the audit core", () => {
  const src = readFileSync("src/lib/evidenceAudit.ts", "utf8");
  const matches = src.match(/reviewStatus:\s*["']reviewed["']/g) ?? [];
  assert.equal(matches.length, 1, "exactly one reviewed-assignment, inside applyOwnerFlips");
});
```

Run: `npx tsx --test tests/auditNeverWritesReviewed.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/evidenceAudit.ts tests/agentVerdicts.test.ts tests/auditNeverWritesReviewed.test.ts
git commit -m "Add agent verdict apply + owner-only flip path

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: Audit subagent brief (the Sonnet judgment prompt)

**Files:**
- Create: `docs/agents/evidence-audit-brief.md`

This is a documented deliverable (no code test). The orchestrator runs it with the Agent tool (Opus 4.8) over each `needs_fetch` batch from `worklist.json`.

- [ ] **Step 1: Write the brief** with these sections (fill with concrete instructions, not placeholders):
  - **Input:** a batch of `needs_fetch` records (id, url, excerpt, the claim text + supported numbers).
  - **Per record:** WebFetch the url; decide whether the `excerpt` is actually present and whether the page supports the claimed number at the **same basis/scope** (revenue vs unit vs bit share, etc.).
  - **Output (must match `agentVerdictsSchema`):** `verified[]` for confirmed records (with `quoteMatch`, `numberInQuote`); `escalations[]` (≤10) for partial/conflicting/ambiguous-basis/suspicious-precision/paywalled-flip-candidate, each with a one-line specific question.
  - **Red lines:** never output `reviewStatus`; never claim a human reviewed anything; if >10 would escalate, keep the 10 highest-stakes and list the rest as deferred fixes.
  - **Model:** Opus 4.8 (verification judgment, not a simple search — per the 2026-06-14 model policy).

- [ ] **Step 2: Commit**

```bash
git add docs/agents/evidence-audit-brief.md
git commit -m "Add evidence-audit subagent brief

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase D — UI surfacing

### Task D1: Public "source-checked" chip in EvidenceList

**Files:**
- Modify: `src/components/EvidenceList.tsx` (~line 35, beside the confidence pill)
- Modify: `src/components/LanguageProvider.tsx` (add `evidenceSourceChecked` key, EN + zh)
- Test: `tests/evidenceListSourceChecked.test.tsx` (or extend an existing EvidenceList test if present)

- [ ] **Step 1: Write the failing test**

```ts
// tests/evidenceListSourceChecked.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { EvidenceList } from "../src/components/EvidenceList";
import { LanguageProvider } from "../src/components/LanguageProvider";
import type { Evidence } from "../src/lib/schema";

function render(evidence: Evidence[]): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProvider, null, React.createElement(EvidenceList, { evidence })),
  );
}

test("verified machineCheck shows a public source-checked chip", () => {
  const html = render([{ id: "ev", type: "paper", title: "T", machineCheck: { status: "verified", checkedAsOf: "2026-06-14" } }]);
  assert.match(html, /source re-checked|来源已核/i);
});

test("structural_ok does NOT show the chip", () => {
  const html = render([{ id: "ev", type: "paper", title: "T", machineCheck: { status: "structural_ok", checkedAsOf: "2026-06-14" } }]);
  assert.doesNotMatch(html, /source re-checked|来源已核/i);
});
```

- [ ] **Step 2: Run** — `npx tsx --test tests/evidenceListSourceChecked.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — in `EvidenceList.tsx`, after the confidence pill block (~line 37):

```tsx
                  {item.machineCheck?.status === "verified" ? (
                    <span className="pill pill-source-checked" title={t("evidenceSourceCheckedHint")}>
                      ✓ {t("evidenceSourceChecked")}
                    </span>
                  ) : null}
```

In `LanguageProvider.tsx`, add to the EN map and the zh map respectively:

```ts
    evidenceSourceChecked: "source re-checked",
    evidenceSourceCheckedHint: "Source re-fetched; quote and number confirmed. Not yet owner-reviewed.",
```
```ts
    evidenceSourceChecked: "来源已核",
    evidenceSourceCheckedHint: "已重新抓取来源、确认引用与数字。尚未经 owner 人工复核。",
```

- [ ] **Step 4: Run** — `npx tsx --test tests/evidenceListSourceChecked.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/EvidenceList.tsx src/components/LanguageProvider.tsx tests/evidenceListSourceChecked.test.tsx
git commit -m "Show public source-checked chip for verified evidence

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task D2: Add the "Source-checked" rung to the landing honesty ladder

**Files:**
- Modify: `src/components/LandingContent.tsx` (copy keys ~line 44-49 EN and the zh block ~line 95-100; list render ~line 286-298)
- Test: `tests/landingLadder.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/landingLadder.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { LandingContent } from "../src/components/LandingContent";
import { LanguageProvider } from "../src/components/LanguageProvider";

test("landing ladder shows the source-checked rung between strong and thin", () => {
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(LandingContent)));
  assert.match(html, /Source-checked/i);
});
```

(If `LandingContent` needs props, match its real signature when wiring the test.)

- [ ] **Step 2: Run** — `npx tsx --test tests/landingLadder.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — add copy keys in the EN object (after `reviewedBody`, ~line 45):

```ts
    sourceCheckedTitle: "Source-checked",
    sourceCheckedBody: "Source re-fetched; quote and number confirmed. Not yet owner-reviewed.",
```

and in the zh object (after its `reviewedBody`, ~line 96):

```ts
    sourceCheckedTitle: "来源已核",
    sourceCheckedBody: "已重新抓取来源、确认引用与数字；尚未经 owner 人工复核。",
```

Insert a list item between the reviewed and unreviewed `<li>` (after ~line 290):

```tsx
            <li>
              <strong>{copy.sourceCheckedTitle}</strong>
              <span>{copy.sourceCheckedBody}</span>
            </li>
```

- [ ] **Step 4: Run** — `npx tsx --test tests/landingLadder.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LandingContent.tsx tests/landingLadder.test.tsx
git commit -m "Add source-checked rung to landing honesty ladder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task D3: Surface source-checked count in DomainThesisBanner

**Files:**
- Modify: `src/components/DomainThesisBanner.tsx` (`EvidenceReviewSummary` ~line 15-18; `evidenceText` ~line 63-70)
- Modify: `src/components/LanguageProvider.tsx` (add `domainThesisEvidenceSourceChecked` key, EN + zh)
- Modify: the banner's caller (find with `grep -rn "DomainThesisBanner" src/app`) to compute `sourceChecked`
- Test: `tests/domainThesisBannerSourceChecked.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// tests/domainThesisBannerSourceChecked.test.tsx
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { DomainThesisBanner } from "../src/components/DomainThesisBanner";
import { LanguageProvider } from "../src/components/LanguageProvider";

test("banner reports source-checked count when present", () => {
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(DomainThesisBanner, {
      domain: { slug: "humanoid-robotics", rootId: "r", title: "Humanoid", description: "d", portfolioState: "audit-preview" },
      evidence: { reviewed: 0, sourceChecked: 12, total: 27 },
    }),
  ));
  assert.match(html, /12/);
});
```

- [ ] **Step 2: Run** — `npx tsx --test tests/domainThesisBannerSourceChecked.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

Extend the summary type (~line 15-18):

```ts
type EvidenceReviewSummary = {
  reviewed: number;
  sourceChecked?: number;
  total: number;
};
```

Update `evidenceText` (~line 63-70) so the non-candidate branch prefers a source-checked line when reviewed is 0 but sourceChecked > 0:

```ts
  const evidenceText = domain.portfolioState === "paid-candidate"
    ? t("domainThesisEvidenceCandidate")
    : evidence.total > 0 && evidence.reviewed === 0 && (evidence.sourceChecked ?? 0) > 0
      ? formatCopy(t("domainThesisEvidenceSourceChecked"), { checked: evidence.sourceChecked ?? 0, total: evidence.total })
      : evidence.total > 0 && evidence.reviewed === 0
        ? formatCopy(t("domainThesisEvidenceUnreviewed"), { total: evidence.total })
        : formatCopy(t("domainThesisEvidenceReviewed"), { reviewed: evidence.reviewed, total: evidence.total });
```

Add the i18n key in `LanguageProvider.tsx` (EN, then zh):

```ts
    domainThesisEvidenceSourceChecked: "{checked} of {total} claims source-checked; owner review in progress.",
```
```ts
    domainThesisEvidenceSourceChecked: "{total} 条声明中 {checked} 条来源已核；owner 复核进行中。",
```

In the caller (e.g. `src/app/d/[slug]/page.tsx` — confirm via grep), compute `sourceChecked` alongside `reviewed`:

```ts
const sourceChecked = evidence.filter((e) => e.machineCheck?.status === "verified").length;
// pass evidence={{ reviewed, sourceChecked, total }}
```

- [ ] **Step 4: Run** — `npx tsx --test tests/domainThesisBannerSourceChecked.test.tsx` → PASS. Then `npm test` (no regressions in existing banner tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DomainThesisBanner.tsx src/components/LanguageProvider.tsx src/app tests/domainThesisBannerSourceChecked.test.tsx
git commit -m "Surface source-checked count in domain thesis banner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase E — Doctrine

### Task E1: Update ADR-0001 and CONTEXT.md for the five-rung ladder

**Files:**
- Modify: `docs/adr/0001-review-status-ladder.md`
- Modify: `CONTEXT.md` (the "Review status ladder" section)

- [ ] **Step 1:** In ADR-0001, add a "2026-06-14 amendment" subsection documenting: a new orthogonal `machineCheck` axis (agent-granted, never human judgment); `machineCheck=verified` lifts an unreviewed claim's gate cap from 3/5 to 4/5; `reviewed` (owner-only) remains the sole path to 5/5; `disputed`/`deprecated` are not rescued; cost-scoped cap deferred in v1. Cross-reference ADR-0009 and the design spec.

- [ ] **Step 2:** In `CONTEXT.md`, extend the review-status ladder table with the source-checked rung (2 < 3 < 4 machine-verified < 5 reviewed).

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0001-review-status-ladder.md CONTEXT.md
git commit -m "Document machine-verified rung in review-status ladder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase F — First run (execution, not TDD)

### Task F1: Run the audit on the flagship and triage results

- [ ] `npm run verify` → green (lint + graph-ux + all tests).
- [ ] `npm run audit:evidence -- --domain ai-compute --refresh` → review `.scratch/audit-ai-compute-<date>/report.md`.
- [ ] Hand the `needs_fetch` batch to the Opus 4.8 audit subagent (Task C2 brief) via the Agent tool; collect verdicts JSON.
- [ ] Apply verdicts (`applyAgentVerdicts`) + persist; present the owner the flip-ready queue and the ≤10 escalations.
- [ ] Owner confirms flips → `applyOwnerFlips`; re-run `npm run check:commercial-readiness` to confirm reviewed/source-checked counts moved.

---

## Self-Review

- **Spec coverage:** two-axis model → A1/A2/E1; schema → A1; deterministic core + triage → B1/B2/B3; HTTP refresh + CLI → B4; ≤10 escalation + verdicts → C1/C2; safety boundary / agent-never-reviewed → B5/C1; gate 4/5 → A2; UI (chip/ladder/banner) → D1/D2/D3; outputs → B4; invocation → B4/C1; testing → every task; first-run target → F1. Cost-scoped cap deferral is documented (A2 + spec-refinement note). All spec sections covered.
- **Placeholder scan:** no TBD/TODO; every code step shows real code; C2 and E1 are documentation tasks with explicit required sections (acceptable — they produce prose deliverables, and their content is enumerated).
- **Type consistency:** `RecordAudit`, `TriageBucket`, `WorklistInput`, `MechanicalChanges`, `AgentVerdicts`, `EvidenceReviewSummary`, `machineCheckSchema`/`MachineCheck` are defined once and reused with consistent shapes; `applyMechanicalChanges` / `applyAgentVerdicts` / `applyOwnerFlips` signatures match their tests; gate `machineVerifiedClaimIds: Set<string>` is consistent between the type, the collector, and `applyReviewStatusCap`.
