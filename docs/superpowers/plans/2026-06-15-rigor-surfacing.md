# Rigor Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MinCut's existing (and already-superior) verification rigor legible — one derived credibility badge per evidence row, plus a pre-registered falsifier block on domains that make a headline bottleneck call.

**Architecture:** Two independent, mostly-derived changes. Feature 1 is a pure function (`credibilityTier`) over existing `Evidence` fields, rendered as a consolidated badge in `EvidenceList`. Feature 2 adds two optional string fields to the domain registry, rendered as a new section in `DomainThesisBanner`. No graph-data (zod) schema migration. Design spec: [docs/superpowers/specs/2026-06-15-rigor-surfacing-design.md](../specs/2026-06-15-rigor-surfacing-design.md).

**Tech Stack:** TypeScript, React 19, Next 15, zod (schema only — untouched here), `node:test` via `tsx --test`, `renderToStaticMarkup` for component tests.

**Execution note:** We are on the `master` branch. Create a `rigor-surfacing` branch before the first commit. Run the full suite with `npm test`; run a single file with `npx tsx --test tests/<file>.test.ts`.

---

## File Structure

- **Create** `src/lib/evidenceCredibility.ts` — pure `credibilityTier(evidence)`; one responsibility (derive a credibility tier).
- **Create** `tests/evidenceCredibility.test.ts` — the derivation matrix.
- **Create** `tests/domainFalsifiers.test.ts` — registry guard that the authored domains carry falsifiers.
- **Modify** `src/components/EvidenceList.tsx` — render the consolidated badge.
- **Modify** `tests/evidenceList.test.ts` — update assertions for the consolidated rendering.
- **Modify** `src/components/LanguageProvider.tsx` — add EN + zh i18n keys.
- **Modify** `src/app/globals.css` — add `.pill-cred-*` and `.domain-thesis-falsifiers` rules.
- **Modify** `src/lib/domains.ts` — add `weakestAssumption?` / `thesisBreaker?` to the config type + author copy for ai-compute & humanoid.
- **Modify** `src/components/DomainThesisBanner.tsx` — add the falsifier section (both branches) + prop-type fields.
- **Modify** `tests/domainThesisBanner.test.ts` — falsifier render/omit tests.

---

## Task 1: `credibilityTier` pure function

**Files:**
- Create: `src/lib/evidenceCredibility.ts`
- Test: `tests/evidenceCredibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/evidenceCredibility.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { credibilityTier } from "../src/lib/evidenceCredibility";
import type { Evidence } from "../src/lib/schema";

function ev(partial: Partial<Evidence>): Evidence {
  return { id: "ev", type: "paper", title: "t", ...partial };
}

test("disputed is tier disputed (2), not rescued by machineCheck", () => {
  const t = credibilityTier(ev({ reviewStatus: "disputed", machineCheck: { status: "verified", checkedAsOf: "2026-06-14" } }));
  assert.equal(t.key, "disputed");
  assert.equal(t.rank, 2);
});

test("reviewed + high confidence + non-vendor is reviewed (5)", () => {
  const t = credibilityTier(ev({ reviewStatus: "reviewed", confidence: "high", type: "paper" }));
  assert.equal(t.key, "reviewed");
  assert.equal(t.rank, 5);
});

test("reviewed but vendor_claim caps at source_checked (4)", () => {
  const t = credibilityTier(ev({ reviewStatus: "reviewed", confidence: "high", type: "vendor_claim" }));
  assert.equal(t.key, "source_checked");
  assert.equal(t.rank, 4);
});

test("reviewed but medium confidence caps at source_checked (4)", () => {
  const t = credibilityTier(ev({ reviewStatus: "reviewed", confidence: "medium", type: "paper" }));
  assert.equal(t.key, "source_checked");
});

test("unreviewed + machineCheck verified is source_checked (4)", () => {
  const t = credibilityTier(ev({ reviewStatus: "unreviewed", machineCheck: { status: "verified", checkedAsOf: "2026-06-14" } }));
  assert.equal(t.key, "source_checked");
  assert.equal(t.rank, 4);
});

test("unreviewed + sourceStatus ok_exact is source_checked (4)", () => {
  const t = credibilityTier(ev({ reviewStatus: "unreviewed", sourceStatus: "ok_exact" }));
  assert.equal(t.key, "source_checked");
});

test("unreviewed + structural_ok stays unverified (3)", () => {
  const t = credibilityTier(ev({ reviewStatus: "unreviewed", machineCheck: { status: "structural_ok", checkedAsOf: "2026-06-14" } }));
  assert.equal(t.key, "unverified");
  assert.equal(t.rank, 3);
});

test("plain unreviewed is unverified (3)", () => {
  assert.equal(credibilityTier(ev({ reviewStatus: "unreviewed" })).key, "unverified");
});

test("machine-verified but broken link drops to unverified, flags linkBroken", () => {
  const t = credibilityTier(ev({ reviewStatus: "unreviewed", machineCheck: { status: "verified", checkedAsOf: "2026-06-14" }, sourceStatus: "404" }));
  assert.equal(t.key, "unverified");
  assert.equal(t.linkBroken, true);
});

test("human reviewed verdict survives a broken link but flags linkBroken", () => {
  const t = credibilityTier(ev({ reviewStatus: "reviewed", confidence: "high", type: "paper", sourceStatus: "404" }));
  assert.equal(t.key, "reviewed");
  assert.equal(t.linkBroken, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/evidenceCredibility.test.ts`
Expected: FAIL — cannot find module `../src/lib/evidenceCredibility`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/evidenceCredibility.ts`:

```ts
import type { Evidence } from "@/lib/schema";

export type CredibilityTierKey = "reviewed" | "source_checked" | "unverified" | "disputed";

export type CredibilityTier = {
  key: CredibilityTierKey;
  rank: 2 | 3 | 4 | 5;
  /** Citation URL is dead/unrelated; surfaced in the tooltip. */
  linkBroken: boolean;
};

const BROKEN_SOURCE_STATUSES = new Set(["404", "unreachable", "wrong_topic"]);
const WEAK_REVIEWED_TYPES = new Set(["vendor_claim", "internal_note"]);

/**
 * Surfaces (does not re-decide) the CONTEXT.md gate ladder:
 *   disputed 2 < unreviewed 3 < unreviewed+verified 4 < reviewed 5.
 * `deprecated` evidence is hidden by the UI and out of this contract.
 */
export function credibilityTier(e: Evidence): CredibilityTier {
  const linkBroken = e.sourceStatus !== undefined && BROKEN_SOURCE_STATUSES.has(e.sourceStatus);

  if (e.reviewStatus === "disputed") {
    return { key: "disputed", rank: 2, linkBroken };
  }

  if (e.reviewStatus === "reviewed") {
    const strong =
      e.confidence === "high" && !(e.type !== undefined && WEAK_REVIEWED_TYPES.has(e.type));
    return strong
      ? { key: "reviewed", rank: 5, linkBroken }
      : { key: "source_checked", rank: 4, linkBroken };
  }

  // unreviewed / undefined: a live machine signal can lift to source_checked,
  // but a dead link removes the only support a machine-only item had.
  const machineVerified = e.machineCheck?.status === "verified" || e.sourceStatus === "ok_exact";
  if (machineVerified && !linkBroken) {
    return { key: "source_checked", rank: 4, linkBroken };
  }

  return { key: "unverified", rank: 3, linkBroken };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/evidenceCredibility.test.ts`
Expected: PASS — 10 tests, 0 fail.

- [ ] **Step 5: Commit**

```bash
git checkout -b rigor-surfacing
git add src/lib/evidenceCredibility.ts tests/evidenceCredibility.test.ts
git commit -m "feat: derive a credibility tier from existing evidence fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Render the consolidated credibility badge in `EvidenceList`

**Files:**
- Modify: `src/components/LanguageProvider.tsx` (add i18n keys)
- Modify: `src/app/globals.css:3730` (add badge colors)
- Modify: `tests/evidenceList.test.ts` (update assertions for consolidation)
- Modify: `tests/productView.test.ts` (ProductView renders EvidenceList — same consolidation)
- Modify: `src/components/EvidenceList.tsx` (render badge)

- [ ] **Step 1: Add i18n keys (English + Chinese)**

In `src/components/LanguageProvider.tsx`, add to the **English** translations object (near the other `evidence*` keys, ~line 31-90):

```ts
evidenceCredReviewed: "Reviewed",
evidenceCredSourceChecked: "Source-checked",
evidenceCredUnverified: "Not yet validated",
evidenceCredDisputed: "Disputed",
evidenceCredLinkBroken: "link needs refresh",
evidenceCredHintReviewed: "Human-reviewed for plausibility.",
evidenceCredHintUnverified: "Not independently validated yet.",
evidenceCredHintDisputed: "A reviewer logged counter-evidence.",
evidenceCredHintLinkBroken: "Citation link is dead; needs refresh.",
```

Add the same keys to the **Chinese** translations object (~line 597+):

```ts
evidenceCredReviewed: "已审核",
evidenceCredSourceChecked: "已核源",
evidenceCredUnverified: "待独立验证",
evidenceCredDisputed: "有争议",
evidenceCredLinkBroken: "链接待更新",
evidenceCredHintReviewed: "已由人工审核可信度。",
evidenceCredHintUnverified: "尚未独立验证。",
evidenceCredHintDisputed: "审核者已记录反证。",
evidenceCredHintLinkBroken: "引用链接已失效，待更新。",
```

- [ ] **Step 2: Add badge colors to CSS**

In `src/app/globals.css`, immediately after the `.pill { ... }` rule (ends line 3730), add:

```css
.pill-cred-reviewed { background: #dcfce7; color: #166534; }
.pill-cred-source-checked { background: #dbeafe; color: #1e40af; }
.pill-cred-unverified { background: #e2e8f0; color: #475569; }
.pill-cred-disputed { background: #fef3c7; color: #92400e; }
```

- [ ] **Step 3: Update the existing `EvidenceList` tests to expect the badge (failing)**

In `tests/evidenceList.test.ts`, the consolidation removes the standalone confidence pill and the `✓ source re-checked` chip, replacing both with one tier badge. Replace the **first** test body's caveat assertions and the **third** test entirely.

Replace this assertion in the first test ("public mode preserves caveats..."):

```ts
  assert.match(html, /confidence.*medium/i);
```

with:

```ts
  assert.match(html, /Not yet validated/);
```

Replace the entire third test ("shows a public source-checked chip only for verified machineCheck") with:

```ts
test("EvidenceList badge reads Source-checked only for a live verified machineCheck", () => {
  const verified: Evidence[] = [
    { id: "ev_v", type: "paper", title: "Verified note", machineCheck: { status: "verified", checkedAsOf: "2026-06-14" } },
  ];
  const structuralOnly: Evidence[] = [
    { id: "ev_s", type: "paper", title: "Structural note", machineCheck: { status: "structural_ok", checkedAsOf: "2026-06-14" } },
  ];

  const verifiedHtml = renderToStaticMarkup(React.createElement(EvidenceList, { evidence: verified }));
  assert.match(verifiedHtml, /Source-checked/);

  const structuralHtml = renderToStaticMarkup(React.createElement(EvidenceList, { evidence: structuralOnly }));
  assert.doesNotMatch(structuralHtml, /Source-checked/);
  assert.match(structuralHtml, /Not yet validated/);
});
```

Also update `tests/productView.test.ts` — `ProductView` renders `EvidenceList`, so its evidence-card test asserts the old confidence pill. Replace (~line 131):

```ts
  assert.match(evidenceHtml, /confidence.*medium/);
```

with:

```ts
  assert.match(evidenceHtml, /Not yet validated/);
```

(That evidence — `internal_note`, medium confidence, unreviewed — derives to the `unverified` tier. The neighboring `/Type.*internal note/` and `doesNotMatch(/Status.*(reviewed|unreviewed)/i)` assertions still hold: the type pill stays and the badge label contains no "reviewed"/"unreviewed"/"Status".)

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx tsx --test tests/evidenceList.test.ts tests/productView.test.ts`
Expected: FAIL — the new `/Not yet validated/` and `/Source-checked/` assertions do not match the current scattered-pill output.

- [ ] **Step 5: Render the badge in `EvidenceList`**

In `src/components/EvidenceList.tsx`, add imports near the top (after the existing `Evidence` import):

```ts
import { credibilityTier, type CredibilityTier, type CredibilityTierKey } from "@/lib/evidenceCredibility";

const TIER_LABEL_KEY: Record<CredibilityTierKey, string> = {
  reviewed: "evidenceCredReviewed",
  source_checked: "evidenceCredSourceChecked",
  unverified: "evidenceCredUnverified",
  disputed: "evidenceCredDisputed",
};

const TIER_CLASS: Record<CredibilityTierKey, string> = {
  reviewed: "pill-cred-reviewed",
  source_checked: "pill-cred-source-checked",
  unverified: "pill-cred-unverified",
  disputed: "pill-cred-disputed",
};

function credibilityHint(item: Evidence, tier: CredibilityTier, t: (k: string) => string): string {
  if (tier.linkBroken) return t("evidenceCredHintLinkBroken");
  if (tier.key === "source_checked" && item.machineCheck?.status === "verified") {
    return `${t("evidenceSourceCheckedHint")} (${item.machineCheck.checkedAsOf})`;
  }
  if (tier.key === "reviewed") return t("evidenceCredHintReviewed");
  if (tier.key === "disputed") return t("evidenceCredHintDisputed");
  return t("evidenceCredHintUnverified");
}
```

Then, inside the `.map((item) => { ... })` callback, compute the tier at the top:

```ts
          {evidence.map((item) => {
            const tier = credibilityTier(item);
            return (
```

And in the `metric-detail-row-head` div, **delete** the confidence pill (lines that render `{t("confidence")}: {item.confidence}`) and the `machineCheck?.status === "verified"` chip, and add the badge after the type pill (and after the internal reviewStatus pill):

```tsx
                  <span className="pill">{t("evidenceTypeLabel")}: {humanizeEvidenceToken(item.type)}</span>
                  {showInternalReviewState ? (
                    <span className="pill">{t("reviewStatusLabel")}: {item.reviewStatus ?? "unreviewed"}</span>
                  ) : null}
                  <span className={`pill ${TIER_CLASS[tier.key]}`} title={credibilityHint(item, tier, t)}>
                    {t(TIER_LABEL_KEY[tier.key])}
                    {tier.linkBroken ? ` · ${t("evidenceCredLinkBroken")}` : ""}
                  </span>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx tsx --test tests/evidenceList.test.ts tests/productView.test.ts`
Expected: PASS — including the internal-mode test (the gated `reviewStatus` pill is unchanged) and the ProductView evidence-card test.

- [ ] **Step 7: Run lint + full suite**

Run: `npm run lint && npm test`
Expected: lint clean; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/EvidenceList.tsx tests/evidenceList.test.ts tests/productView.test.ts src/components/LanguageProvider.tsx src/app/globals.css
git commit -m "feat: show one derived credibility badge per evidence row

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Add falsifier fields + authored copy to the domain registry

**Files:**
- Modify: `src/lib/domains.ts`
- Test: `tests/domainFalsifiers.test.ts`

- [ ] **Step 1: Write the failing registry-guard test**

Create `tests/domainFalsifiers.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { DOMAIN_PORTFOLIO_ENTRIES } from "../src/lib/domains";

test("ai-compute and humanoid carry pre-registered falsifiers", () => {
  const bySlug = Object.fromEntries(DOMAIN_PORTFOLIO_ENTRIES.map((e) => [e.slug, e]));
  assert.ok(bySlug["ai-compute"].weakestAssumption);
  assert.ok(bySlug["ai-compute"].thesisBreaker);
  assert.ok(bySlug["humanoid-robotics"].weakestAssumption);
  assert.ok(bySlug["humanoid-robotics"].thesisBreaker);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/domainFalsifiers.test.ts`
Expected: FAIL — `weakestAssumption` is `undefined` (and a TS error: property does not exist on the entry type).

- [ ] **Step 3: Add the fields to the config type**

In `src/lib/domains.ts`, add to the `DomainPortfolioBase` type (after `entitlement?: string;`):

```ts
  /**
   * Pre-registered weakest load-bearing assumption of this domain's headline
   * bottleneck thesis. Omit on pure-decomposition maps with no directional call.
   * English prose (consistent with `description`); section labels localized via t().
   */
  weakestAssumption?: string;
  /** The future observation that would overturn the headline bottleneck call. */
  thesisBreaker?: string;
```

- [ ] **Step 4: Author the copy on the two directional domains**

In the `ai-compute` entry, add:

```ts
    weakestAssumption:
      "AI-accelerator demand keeps converting into sustained CoWoS / HBM / advanced-packaging capacity expansion, rather than a short inventory cycle that normalizes.",
    thesisBreaker:
      "If CoWoS/HBM capacity catches up — lead times compress and allocation language drops out of earnings — while accelerator shipments keep growing, then packaging/test was not the binding constraint and the bottleneck call is wrong.",
```

In the `humanoid-robotics` entry, add:

```ts
    weakestAssumption:
      "Humanoid viability is gated by physical component maturity (actuators, hands, thermal) rather than by the learned control policy, so the bottleneck sits in the component stack.",
    thesisBreaker:
      "If a humanoid reaches reliable commercial deployment on today's off-the-shelf actuators and the clear differentiator is the control/data stack, the component-stack framing is wrong and the gate is software.",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/domainFalsifiers.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domains.ts tests/domainFalsifiers.test.ts
git commit -m "feat: pre-register thesis falsifiers on ai-compute and humanoid domains

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Render the falsifier section in `DomainThesisBanner`

**Files:**
- Modify: `src/components/LanguageProvider.tsx` (2 i18n keys)
- Modify: `src/app/globals.css` (section style)
- Modify: `tests/domainThesisBanner.test.ts` (render/omit tests)
- Modify: `src/components/DomainThesisBanner.tsx`

- [ ] **Step 1: Add i18n keys (English + Chinese)**

In `src/components/LanguageProvider.tsx`, add to the **English** object (near the other `domainThesis*` keys):

```ts
domainThesisWeakestAssumption: "Weakest assumption",
domainThesisBreaker: "What would overturn this",
```

and to the **Chinese** object:

```ts
domainThesisWeakestAssumption: "最弱假设",
domainThesisBreaker: "什么会推翻它",
```

- [ ] **Step 2: Add the failing render/omit tests**

Append to `tests/domainThesisBanner.test.ts`:

```ts
test("domain thesis renders pre-registered falsifiers on the flagship (direct branch)", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "ai-compute",
        rootId: "ai_accelerator_module_hbm_cowos",
        title: "AI compute chain",
        description: "Reference map.",
        portfolioState: "full-free-flagship",
        weakestAssumption: "Demand keeps converting into packaging capex.",
        thesisBreaker: "If CoWoS/HBM capacity catches up while shipments grow, the call is wrong.",
      },
      evidence: { reviewed: 5, total: 21 },
    }),
  );
  assert.match(html, /domain-thesis-falsifiers/);
  assert.match(html, /Weakest assumption/);
  assert.match(html, /Demand keeps converting into packaging capex/);
  assert.match(html, /What would overturn this/);
  assert.match(html, /the call is wrong/);
});

test("domain thesis omits the falsifier block when fields are absent", () => {
  const html = renderToStaticMarkup(
    React.createElement(DomainThesisBanner, {
      domain: {
        slug: "parcel-robot",
        rootId: "low_cost_parcel_sorting_robot_300k_rmb",
        title: "Parcel-sorting robot",
        description: "Depth demo.",
        portfolioState: "full-free-depth-demo",
      },
      evidence: { reviewed: 0, total: 10 },
    }),
  );
  assert.doesNotMatch(html, /domain-thesis-falsifiers/);
  assert.doesNotMatch(html, /Weakest assumption/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx tsx --test tests/domainThesisBanner.test.ts`
Expected: FAIL — `domain-thesis-falsifiers` not present (and a TS error: `weakestAssumption` not on the prop type).

- [ ] **Step 4: Add the prop-type fields**

In `src/components/DomainThesisBanner.tsx`, add to the `DomainThesisBannerDomain` type (after `portfolioState`):

```ts
  weakestAssumption?: string;
  thesisBreaker?: string;
```

- [ ] **Step 5: Render the section in both branches**

In `src/components/DomainThesisBanner.tsx`, immediately after the closing `</div>` of `domain-thesis-copy` (the block with the `<h1>` and description, ~line 90) and **before** the `{explainsAccess ? (` block, insert:

```tsx
      {domain.weakestAssumption || domain.thesisBreaker ? (
        <div className="domain-thesis-falsifiers" data-testid="domain-thesis-falsifiers">
          {domain.weakestAssumption ? (
            <p>
              <strong>{t("domainThesisWeakestAssumption")}:</strong> {domain.weakestAssumption}
            </p>
          ) : null}
          {domain.thesisBreaker ? (
            <p>
              <strong>{t("domainThesisBreaker")}:</strong> {domain.thesisBreaker}
            </p>
          ) : null}
        </div>
      ) : null}
```

- [ ] **Step 6: Add the section style**

In `src/app/globals.css`, after the `.pill-cred-disputed` rule from Task 2, add:

```css
.domain-thesis-falsifiers {
  border-left: 3px solid #cbd5e1;
  margin-top: 12px;
  padding-left: 12px;
}
.domain-thesis-falsifiers p {
  color: #475569;
  font-size: 14px;
  margin: 4px 0 0;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx tsx --test tests/domainThesisBanner.test.ts`
Expected: PASS — both new tests, and all pre-existing banner tests (they pass domains without the new fields, so the block is omitted).

- [ ] **Step 8: Run the full verify suite**

Run: `npm run verify`
Expected: lint clean, graph-ux checks pass, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/DomainThesisBanner.tsx tests/domainThesisBanner.test.ts src/components/LanguageProvider.tsx src/app/globals.css
git commit -m "feat: surface pre-registered thesis falsifiers in the domain banner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual verification (after all tasks)

1. `npm run dev`, open `/d/ai-compute`:
   - banner shows "Weakest assumption" + "What would overturn this".
   - open a node's detail rail → evidence rows show one colored credibility badge (Reviewed / Source-checked / Not yet validated / Disputed); hover shows the "why" tooltip.
2. Open `/d/parcel-robot`: no falsifier block (no directional call authored).
3. Toggle language to 中文: badge labels and falsifier section labels are localized; falsifier prose stays English (consistent with `description`).
