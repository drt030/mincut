# Commercial Launch Week Implementation Plan (rev 3, 2026-06-10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a retail-focused chokepoint-map product: GPU/AI-compute chain as flagship (Fri 6/12), humanoid actuator chain (Sat 6/13), AI-datacenter power chain (Tue 6/16) — free decomposition graphs, paid "exposure layer" (which listed companies make each bottleneck), Stripe $9/domain · $29 founding all-access.

**Architecture:** Unchanged app + flat-JSON data. **Paywall = exposure-layer gating, NOT depth gating**: full decomposition/bottleneck/evidence structure is free (shareable, viral); `organization` nodes, `manufactured_by` edges, and the Investor-panel "Candidate exposure" block are stripped server-side for non-entitled viewers. Entitlements = signed JWT cookie granted by Stripe-session verification on redirect (no DB, no webhooks). Parcel-sorting domain stays FULLY free as the "see what paid looks like" demo.

**Tech Stack:** Next.js 15 on Vercel, Stripe Payment Links + `stripe` SDK, `jose`, Buttondown, Vercel Analytics, existing pipeline (`import:candidates`, `validate:data`, `gate`).

**Verified ground truth (2026-06-10 exploration):**
- `npm run build` passes. Parcel domain: 312 nodes / 604 edges / 188 evidence (96% with URLs), 18 ⚠ bottleneck nodes, 53 frontier, **0 🔑 key-tech**, review status 100% unreviewed.
- The retail core ALREADY EXISTS in the UI: Bottleneck-risk lens with ranked **KEY RISK NODES** panel; node detail with Risk/Maturity/rolled-up cost; **Investor answer panel** with top risk bottleneck, cost gap, throughput constraints, and **Candidate exposure incl. tickers + market share** (FANUC 6954.T, Estun 002747.SZ, Inovance 300124.SZ). It is buried 4 clicks deep (default lens = Cost drivers → switch lens → click node → Detail tab → scroll).
- Mobile: canvas unusable, but rail content (ranked list + detail cards) stacks readably; lens panel needs collapsing.
- Edge relations available: requires 128 / measured_by 108 / manufactured_by 259 / implemented_by 95 / enables 6 / regulated_by 1. Org-to-component mapping with listings renders end-to-end already.
- Bottlenecks live on nodes as `bottleneckOf: string[]` (ADR-0006); nodes carry `domain: string[]` tags; risk = (1 − maturityScore/100) × cost_share (`src/lib/nodeRisk.ts`) — a relative heat signal, NOT a probability.

**Decisions locked (owner can override):**
1. **Free/paid line:** decomposition + bottlenecks + evidence free for ALL domains; exposure layer (orgs/tickers/share) paid per domain ($9) or founding all-access ($29, cap ~200). Parcel demo: everything free including exposure.
2. **Domain drumbeat:** Fri = AI-compute chain (flagship: wafer → CoWoS → HBM → ABF substrate → InP photonics → cooling/power-delivery). Sat = humanoid actuator chain (max reuse of existing reducer/servo subtrees). Tue = AI-datacenter power chain (gas turbines, large transformers, HVDC — framed as "the power wall gating AI buildout", not generic 发电站). Each drop is its own X post.
3. **Positioning:** we map chains ourselves from supply-chain facts; exposure falls out of the data. NOT a Serenity tracker, no copying his picks, no buy/sell language. Disclaimer site-wide.
4. **MVP fixes from exploration ship before launch:** default lens = bottleneck-risk + URL deep links; Investor panel promoted to first screen after node click; "Risk 46%" relabeled to heat score with plain-language tooltip.
5. **Referral** ("invite 3 signups → unlock 1 domain") ships Tue 6/16 with the power-chain drop + Show HN.
6. **RESOLVED 2026-06-10:** domain = **drt030.com** (purchased). Display brand stays "Capability Graph Explorer" for launch (rename is a one-line metadata change later if desired).

**Non-goals this week:** depth gating (replaced by exposure gating), B2B, accounts/DB, CN mirror, Substack, guided tours, canvas mobile optimization, key-tech 🔑 backfill beyond the flagship handful (or drop the glyph from marketing if not backfilled).

---

## Day 1 — Wed 2026-06-10 (today): infra + safety + flagship research kickoff

### Task 1: Land current WIP

- [ ] `npm run verify` → green; then `git add -A && git commit -m "feat: graph expansion feedback polish (pre-launch WIP landing)"`. If red, fix or stash; nothing below depends on it.

### Task 2: Guard the mutating API route

**Files:** Modify `src/app/api/research-tasks/route.ts` · Create `tests/researchTasksRouteGuard.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/researchTasksRouteGuard.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/research-tasks/route";

test("research-tasks POST returns 403 when OPERATOR_WRITES is not set", async () => {
  delete process.env.OPERATOR_WRITES;
  const res = await POST(
    new Request("http://localhost/api/research-tasks", {
      method: "POST",
      body: JSON.stringify({ targetNodeId: "anything" }),
    }),
  );
  assert.equal(res.status, 403);
});
```

- [ ] **Step 2:** `npx tsx --test tests/researchTasksRouteGuard.test.ts` → FAIL.
- [ ] **Step 3:** At the top of `POST`:

```ts
  if (process.env.OPERATOR_WRITES !== "1") {
    return NextResponse.json({ error: "This deployment is read-only" }, { status: 403 });
  }
```

- [ ] **Step 4:** Re-run → PASS. **Step 5:** `echo 'OPERATOR_WRITES=1' >> .env.local` (gitignored; NOT set on Vercel). **Step 6:** Commit `"feat: guard research-task writes behind OPERATOR_WRITES"`.

### Task 3: Feature-flag operator-only UI ("Agent expand" button)

**Files:** Modify `src/components/GraphExplorer.tsx` (`grep -n "research-tasks\|Agent expand" src/components/GraphExplorer.tsx`)

- [ ] Wrap the expansion affordance: `const operatorMode = process.env.NEXT_PUBLIC_OPERATOR_MODE === "1";` → `{operatorMode ? (...existing JSX...) : null}`. Add `NEXT_PUBLIC_OPERATOR_MODE=1` to `.env.local`. Verify both states in `npm run dev`. `npm run verify`, commit `"feat: hide operator expansion UI outside operator mode"`.

### Task 4: Vercel deploy with data tracing

**Files:** Modify `next.config.ts`

- [ ] Merge `outputFileTracingIncludes: { "/**": ["./data/**/*.json"] }` into existing config. `npx vercel link && npx vercel deploy`. Smoke preview: `/`, `/graph`, `/product/low_cost_parcel_sorting_robot_300k_rmb`, `/gate`, `/tasks`; POST guard → 403. Commit `"chore: trace data files into serverless bundle"`.

### Task 5: Owner actions (external latency — start NOW)

- [ ] Buy domain (Decision 6); attach to Vercel; HTTPS up.
- [ ] Create Stripe account (US individual), submit identity verification today.
- [ ] Create Buttondown account; note embed handle.

### Task 6: Analytics, SEO, disclaimer

**Files:** Modify `src/app/layout.tsx`, `src/app/globals.css` · Create `src/app/robots.ts`, `src/app/sitemap.ts`

- [ ] `npm install @vercel/analytics`; `<Analytics />` in body.
- [ ] Site `metadata` (title "<BRAND> — interactive bottleneck maps of real supply chains", description, OG default image, twitter `summary_large_image`).
- [ ] `robots.ts` allow-all + sitemap; `sitemap.ts` for `""`, `/graph`, `/explore`, `/gate`, product pages.
- [ ] Footer: `Research and educational tool. Nothing here is investment advice. · 本站为产业研究工具，不构成任何投资建议。`
- [ ] `npm run verify && npx vercel deploy`; commit `"feat: analytics, SEO metadata, sitemap, disclaimer footer"`.

### Task 7: Kick off AI-compute-chain agent research TONIGHT (longest pole)

- [ ] **Step 1:** Define roots per ADR-0004: Capability `leading_edge_ai_compute` → Product `ai_accelerator_module_hbm_cowos` (flagship). Modules: leading-edge logic die (N4/N3) · CoWoS advanced packaging · HBM3E stack · ABF substrate · interposer · optical interconnect (InP lasers / photonics) · power delivery · liquid cooling.
- [ ] **Step 2:** Agent research brief — for each module: maturity (`maturityAsOf: "2026-06"`), capacity-expansion lead time, top-3 chokepoints with `bottleneckOf`, **org nodes with `manufactured_by` edges carrying listing + market-share metrics** (the paid layer: e.g. TSMC 2330.TW/TSM, SK hynix 000660.KS, Ibiden 4062.T, Unimicron 3037.TW, ASMPT 0522.HK, AXT AXTI, Coherent COHR…), every claim → evidence record with URL + accessed date, review status `unreviewed`.
- [ ] **Step 3:** Run overnight; import/review is Fri morning (Task 14). Tag all nodes `domain: ["ai_compute_chain"]`.

---

## Day 2 — Thu 2026-06-11: payments + exposure paywall + retail MVP fixes + landing

### Task 8: Stripe products + entitlement library

**Files:** Create `src/lib/entitlements.ts` · Test `tests/entitlements.test.ts`

- [ ] **Step 1 (owner, dashboard):** Products/prices: "AI compute chain — exposure layer" $9 · "Humanoid actuator chain — exposure layer" $9 · "Founding all-access" $29. Payment Links each with redirect `https://<DOMAIN>/unlock?session_id={CHECKOUT_SESSION_ID}`. Enable Stripe Tax + Alipay.
- [ ] **Step 2:** `npm install stripe jose`; `openssl rand -hex 32` → `ENTITLEMENT_SECRET`.

Env (`.env.local` + Vercel): `STRIPE_SECRET_KEY`, `ENTITLEMENT_SECRET`, `STRIPE_PRICE_AI_COMPUTE`, `STRIPE_PRICE_HUMANOID`, `STRIPE_PRICE_FOUNDING`, `NEXT_PUBLIC_STRIPE_LINK_AI_COMPUTE`, `NEXT_PUBLIC_STRIPE_LINK_HUMANOID`, `NEXT_PUBLIC_STRIPE_LINK_FOUNDING`.

- [ ] **Step 3: Failing test**

```ts
// tests/entitlements.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { grantCookieValue, readEntitlements } from "../src/lib/entitlements";

test("entitlement cookie round-trips and merges", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  const v1 = await grantCookieValue("ai_compute", []);
  assert.deepEqual(await readEntitlements(v1), ["ai_compute"]);
  const v2 = await grantCookieValue("all", await readEntitlements(v1));
  assert.deepEqual((await readEntitlements(v2)).sort(), ["ai_compute", "all"]);
});

test("tampered cookie reads as empty", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  assert.deepEqual(await readEntitlements("garbage.token.here"), []);
});
```

- [ ] **Step 4:** Run → FAIL. **Step 5: Implement**

```ts
// src/lib/entitlements.ts
import { SignJWT, jwtVerify } from "jose";

export const ENTITLEMENT_COOKIE = "cge_ent";
const secret = () => new TextEncoder().encode(process.env.ENTITLEMENT_SECRET ?? "");

export async function grantCookieValue(entitlement: string, existing: string[]): Promise<string> {
  const list = [...new Set([...existing, entitlement])];
  return new SignJWT({ e: list })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("400d")
    .sign(secret());
}

export async function readEntitlements(cookieValue: string | undefined): Promise<string[]> {
  if (!cookieValue) return [];
  try {
    const { payload } = await jwtVerify(cookieValue, secret());
    return Array.isArray(payload.e) ? (payload.e as string[]) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 6:** PASS → commit `"feat: signed entitlement cookie library"`.

### Task 9: Unlock route (Stripe session → cookie)

**Files:** Create `src/app/unlock/route.ts`

- [ ] **Step 1:**

```ts
// src/app/unlock/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ENTITLEMENT_COOKIE, grantCookieValue, readEntitlements } from "@/lib/entitlements";

const PRICE_ENV_TO_ENTITLEMENT: [string, string][] = [
  ["STRIPE_PRICE_AI_COMPUTE", "ai_compute"],
  ["STRIPE_PRICE_HUMANOID", "humanoid"],
  ["STRIPE_PRICE_POWER", "power"],
  ["STRIPE_PRICE_FOUNDING", "all"],
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return NextResponse.redirect(new URL("/", url.origin));

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  if (session.payment_status !== "paid") {
    return NextResponse.redirect(new URL("/?purchase=incomplete", url.origin));
  }

  const priceId = session.line_items?.data[0]?.price?.id ?? "";
  const entitlement = PRICE_ENV_TO_ENTITLEMENT.find(([env]) => process.env[env] === priceId)?.[1];
  if (!entitlement) return NextResponse.redirect(new URL("/?purchase=unknown", url.origin));

  const existing = request.headers.get("cookie")?.match(new RegExp(`${ENTITLEMENT_COOKIE}=([^;]+)`))?.[1];
  const value = await grantCookieValue(entitlement, await readEntitlements(existing));
  const res = NextResponse.redirect(new URL("/graph?unlocked=1", url.origin));
  res.headers.append(
    "Set-Cookie",
    `${ENTITLEMENT_COOKIE}=${value}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
```

- [ ] **Step 2:** Stripe test mode end-to-end (test card → redirect → cookie set → exposure visible). Switch to live keys. Commit `"feat: stripe session verification unlock route"`.

### Task 10: Exposure-layer gating (the paywall — replaces depth trimming)

Free viewers get full structure; `organization` nodes, `manufactured_by` edges, and org-only evidence are stripped server-side for gated domains.

**Files:** Create `src/lib/exposureGate.ts` · Test `tests/exposureGate.test.ts` · Modify `src/app/graph/page.tsx`, `src/app/product/[id]/page.tsx` · Create `src/components/ExposureLockCta.tsx`

- [ ] **Step 1: Failing test**

```ts
// tests/exposureGate.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import type { GraphData } from "../src/lib/schema";
import { stripExposureLayer } from "../src/lib/exposureGate";

const fixture: GraphData = {
  graphVersion: "test",
  nodes: [
    { id: "cowos", name: "CoWoS", kind: "module", domain: ["ai_compute_chain"] },
    { id: "tsmc", name: "TSMC", kind: "organization", domain: ["ai_compute_chain"] },
    { id: "fanuc", name: "FANUC", kind: "organization", domain: ["parcel_sorting_robot"] },
  ] as GraphData["nodes"],
  edges: [
    { id: "e1", source: "cowos", target: "tsmc", relation: "manufactured_by", evidenceIds: ["ev_org"] },
  ] as GraphData["edges"],
  evidence: [
    { id: "ev_org", type: "industry_report", title: "CoWoS supply", supportsNodeIds: ["tsmc"] },
    { id: "ev_keep", type: "industry_report", title: "CoWoS process" },
  ] as GraphData["evidence"],
};

test("strips org nodes, manufactured_by edges, org-only evidence for locked domains", () => {
  const { graph, locked } = stripExposureLayer(fixture, [], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.ok(!graph.nodes.some((n) => n.id === "tsmc"));
  assert.ok(graph.nodes.some((n) => n.id === "fanuc"));          // other-domain org untouched
  assert.equal(graph.edges.length, 0);
  assert.ok(!graph.evidence.some((ev) => ev.id === "ev_org"));
  assert.ok(graph.evidence.some((ev) => ev.id === "ev_keep"));   // non-org evidence stays free
  assert.equal(locked[0].hiddenOrgCount, 1);
});

test("entitled viewer keeps everything", () => {
  const { graph } = stripExposureLayer(fixture, ["ai_compute"], [
    { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  ]);
  assert.equal(graph.nodes.length, fixture.nodes.length);
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3: Implement**

```ts
// src/lib/exposureGate.ts
import type { GraphData } from "@/lib/schema";

export type GatedDomain = { domainTag: string; entitlement: string };

export const GATED_DOMAINS: GatedDomain[] = [
  { domainTag: "ai_compute_chain", entitlement: "ai_compute" },
  { domainTag: "humanoid_actuator", entitlement: "humanoid" },
  { domainTag: "ai_dc_power_chain", entitlement: "power" },
  // parcel_sorting_robot is deliberately absent — full free demo.
];

export function stripExposureLayer(
  graph: GraphData,
  entitlements: string[],
  gatedDomains: GatedDomain[] = GATED_DOMAINS,
) {
  const lockedTags = gatedDomains.filter(
    (d) => !entitlements.includes("all") && !entitlements.includes(d.entitlement),
  );
  const locked: { domainTag: string; entitlement: string; hiddenOrgCount: number }[] = [];
  const hiddenNodeIds = new Set<string>();

  for (const d of lockedTags) {
    let count = 0;
    for (const n of graph.nodes) {
      const tags = (n as { domain?: string[] }).domain ?? [];
      const tagsLockedOnly = tags.length > 0 && tags.every((t) =>
        lockedTags.some((lt) => lt.domainTag === t),
      );
      if (n.kind === "organization" && tags.includes(d.domainTag) && tagsLockedOnly) {
        hiddenNodeIds.add(n.id);
        count += 1;
      }
    }
    locked.push({ domainTag: d.domainTag, entitlement: d.entitlement, hiddenOrgCount: count });
  }

  if (hiddenNodeIds.size === 0) return { graph, locked };

  const nodes = graph.nodes.filter((n) => !hiddenNodeIds.has(n.id));
  const edges = graph.edges.filter((e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target));
  const referenced = new Set([
    ...nodes.flatMap((n) => n.evidenceIds ?? []),
    ...edges.flatMap((e) => e.evidenceIds ?? []),
  ]);
  const evidence = graph.evidence.filter((ev) => {
    const supports = (ev as { supportsNodeIds?: string[] }).supportsNodeIds ?? [];
    if (supports.some((id) => hiddenNodeIds.has(id)) && !supports.some((id) => !hiddenNodeIds.has(id))) {
      return false;
    }
    return referenced.size === 0 || referenced.has(ev.id) || supports.length > 0;
  });
  return { graph: { ...graph, nodes, edges, evidence }, locked };
}
```

(Org shared with a free domain — e.g. Inovance in both parcel and humanoid — stays visible because its tags are not locked-only; its `manufactured_by` edges into locked components disappear with nothing else leaking.)

- [ ] **Step 4:** PASS. **Step 5: Apply in pages** (`/graph`, `/product/[id]`):

```tsx
import { cookies } from "next/headers";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { stripExposureLayer } from "@/lib/exposureGate";

const full = loadActiveGraphData();
const ents = await readEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
const { graph, locked } = stripExposureLayer(full, ents);
// pass `graph` down; pass `locked` to the rail/investor panel
```

- [ ] **Step 6: `ExposureLockCta.tsx`** — rendered in the Investor answer panel's "Candidate exposure" slot and node detail when the selected node's domain is locked:

> 🔒 **Who makes this — and who's listed?** {hiddenOrgCount} suppliers with tickers, market share, and capacity signals. Unlock this chain **$9** · founding all-access **$29**. zh: 「🔒 谁在造它？{n} 家供应商（含上市代码与市场份额）· 解锁本链 $9 · 创始会员 $29（支持支付宝）」

`track("unlock_click", { domain })` on CTA click (`import { track } from "@vercel/analytics"`).

- [ ] **Step 7: Leak check.** No cookie: `curl -s <preview>/graph | grep -ci "tsmc"` → 0 on gated domain views; with cookie → present. Parcel page still shows FANUC/Estun free.
- [ ] **Step 8:** `npm run verify`; commit `"feat: exposure-layer paywall for gated domains"`.

### Task 11: Retail MVP fixes (from 2026-06-10 exploration)

**Files:** Modify `src/components/GraphExplorer.tsx`, rail components (locate via `grep -rn "KEY RISK NODES\|Investor answer" src/components`), `src/components/LanguageProvider.tsx`

- [ ] **Step 1: Default lens = Bottleneck risk** + ranked panel expanded on load. Support `?lens=bottleneck&focus=<nodeId>` URL params (read in `/graph` page, pass initial state) so launch posts deep-link to the answer screen. Keep current default for `/explore` users via `?lens=cost`.
- [ ] **Step 2: Promote the Investor answer panel** to the first screen after node click (Risk tab shows it above the fold, or merge into the ranked list row expansion). The Detail tab keeps full metrics.
- [ ] **Step 3: Relabel risk.** "Risk 46%" → "Heat 46/100" (zh 「热度 46/100」) everywhere it renders; tooltip: "Relative pressure signal: (1 − maturity) × cost share. Not a probability." (zh: 「相对压力信号：(1−成熟度)×成本占比，不是概率」). Update `tests/topNGlyph.test.ts` / rail tests if they assert the old label.
- [ ] **Step 4:** `npm run verify`; commit `"feat: retail-first graph entry (default bottleneck lens, promoted investor panel, heat relabel)"`.

### Task 12: Landing + email + OG

**Files:** Create `src/app/explore/page.tsx`, `src/components/LandingContent.tsx` · Modify `src/app/page.tsx`, `LanguageProvider.tsx`, `globals.css`

- [ ] **Step 1:** Move current home → `/explore` (verbatim `HomeContent` page). `/` renders `LandingContent`.
- [ ] **Step 2: Landing copy (final; zh keys added for every string):**
  1. **Hero:** H1 "Find the chokepoint before the market does." Sub "Free interactive bottleneck maps of real supply chains — every claim cited. The exposure layer (who makes it, who's listed) is what you pay for." CTA "See the AI compute chain →" (`/graph?lens=bottleneck`).
  2. **Domain cards (4):** AI compute chain — map FREE · exposure $9 | Humanoid actuators — "drops Saturday" → email | AI datacenter power — "drops Tuesday" → email | Parcel-sorting robot — FULL DEMO incl. exposure, free ("this is what unlocked looks like").
  3. **Founding offer:** $29 once · exposure layer on every domain ever · first 200.
  4. **Trust:** glyph legend + "claims carry unreviewed/reviewed/disputed status; disputed ranks below unreviewed. Gate reports public →" `/gate`.
  5. **Email capture** (Buttondown embed): "One new chain map per week."
- [ ] **Step 3:** Mobile pass at 380px (cards stack, buy buttons thumb-reachable). `/graph` <768px: collapse the MAP/LENS panel to a toggle button; notice "Best on desktop — the ranked list below works great on mobile".
- [ ] **Step 4:** OG images 1200×630 (bottleneck-lens beauty shot + wordmark) → `public/og/`; per-page metadata; validate X card.
- [ ] **Step 5:** Fix tests assuming `/` is research home (`grep -rn 'href="/"' src/ tests/`); `npm run verify`; deploy; commit `"feat: retail landing, mobile lens collapse, OG cards"`.

---

## Day 3 — Fri 2026-06-12: flagship content + reviewed batch + LAUNCH

### Task 13: Import + finalize AI-compute chain (morning)

- [ ] Import overnight batch: `npm run import:candidates -- <batch>`; `npm run validate:data && npm run check:active-graph-scope`.
- [ ] Verify exposure layer: org nodes carry listing + share metrics; investor panel renders them when entitled; lock CTA when not.
- [ ] **Review pass (the credibility move):** personally verify the 10–15 core chokepoint claims (CoWoS capacity, HBM booking, ABF, InP) → flip those to `reviewed`. The ladder needs real rungs before we market it.
- [ ] 🔑 backfill on 3–5 true key techs (CoWoS, HBM TSV, InP epitaxy) — or remove 🔑 from landing legend.
- [ ] zh names for new visible roots (`nodeTextZh`; languageCoverage test enforces). `npm run gate -- --target ai_accelerator_module_hbm_cowos --dry-run`.
- [ ] `npm run verify`; commit `"data: AI compute chain v1 (cited, partially reviewed, exposure layer)"`; `npx vercel deploy --prod`.

### Task 14: Launch (target 10:00 ET; floor Sat 09:00)

- [ ] **Smoke:** real $9 purchase with own card → exposure unlocks → self-refund. All routes, OG card, forms, 403 guard, mobile landing.
- [ ] **EN thread** (final draft):

> **1/** Everyone's hunting AI-supply-chain chokepoints. Almost nobody can show you the map. I built one — interactive, cited, free: the full AI compute chain from wafer to rack. [screenshot + deep link `/graph?lens=bottleneck`]
> **2/** Every ⚠ node = currently gating the buildout. CoWoS capacity. HBM booked out. ABF substrates. InP lasers. Click any of them: evidence, maturity, lead times. All free. [zoom screenshot]
> **3/** The graph is honest about what it doesn't know — every claim is labeled reviewed/unreviewed, disputed ranks *below* unreviewed, and the validation gate report is public. [evidence panel screenshot]
> **4/** The one thing behind a paywall: the **exposure layer** — who actually makes each bottleneck, market share, and who's listed. $9 per chain. Founding members: $29 once, every chain we ever map (first 200). [lock CTA screenshot]
> **5/** Free full demo (exposure included) on a 300k-RMB parcel-sorting robot — 312 nodes to commodity leaves, so you can judge the method before paying. Humanoid actuators drop tomorrow; AI datacenter power Tuesday. One new chain per week → [email]. Research tool, not investment advice.

- [ ] **zh channels:** same structure, 「这周大家都在聊卡脖子。我把 GPU 算力链拆成了可交互的瓶颈图谱，免费看；谁在造+上市代码是付费层（$9，支持支付宝）。研究工具，不荐股。」 No tickers in the post itself.
- [ ] All-day engagement: answer with graph screenshots; quote-RT into chokepoint conversations; do NOT reply-spam Serenity.

---

## Sat 6/13: humanoid drop (second beat)

- [ ] **Task 15:** Humanoid actuator chain: Capability `humanoid_robot_actuator_joint` → Products `rotary_actuator_harmonic` / `linear_actuator_roller_screw` / `dexterous_hand_actuator`; **link into existing** `precision_reducer_gearbox`/servo subtrees (no duplication); deltas researched Fri night by agent (roller screws + grinding capacity, frameless torque motors, 六维力/力矩传感器, encoders, tendons); orgs with listings on the paid layer (Harmonic Drive 6324.T, 绿的谐波 688017.SH, THK 6481.T, NSK 6471.T…); tag `domain: ["humanoid_actuator"]`; 10+ core claims personally `reviewed`; zh names; validate + gate dry-run; deploy.
- [ ] **Task 16:** Drop post EN+zh: "Chain #2: humanoid robot actuators. The market learned last week a harmonic reducer can gate a $40B narrative. Here's the whole joint, mapped. Map free; who-makes-it $9." Label-truncation polish (LOD width bump) if time.

## Sun 6/14: iterate + power-chain research kickoff

- [ ] Fix top friction from analytics; founding-count post if honest; kick off AI-DC power-chain agent batch overnight (gas turbines GE Vernova GEV / Siemens Energy ENR.DE / MHI 7011.T, large power transformers + lead times, HVDC, switchgear, grid interconnect queues; tag `ai_dc_power_chain`).

## Tue 6/16: power drop + referral + Show HN (third beat)

- [ ] **Task 17:** Import + finalize power chain (same DoD as Task 15); Stripe price/link for `power`; landing card flips live.
- [ ] **Task 18:** Referral: "invite 3 confirmed signups → unlock 1 chain" — ref code → Buttondown attribution → at 3, email a signed unlock link (reuse `grantCookieValue`; Upstash free tier for counters). Own announcement post.
- [ ] **Task 19:** Show HN ~14:00 UTC: `Show HN: Interactive bottleneck maps of supply chains (AI compute, humanoid robots, datacenter power)`. First comment: architecture + the review-status honesty ladder + public gate reports + ADRs. Epistemics first, investing second.

---

## Risks

| Risk | Mitigation |
|---|---|
| AI-compute content thin by Fri | Research started Wed night; flagship needs top-8 chokepoints with evidence, not commodity-leaf depth; parcel demo carries the depth story; floor = Sat launch |
| Exposure layer leaks | Server-side strip + curl leak check (Task 10 Step 7); gate/tasks pages checked for org enumeration |
| "Risk %" misread as probability | Heat relabel + tooltip ships before launch (Task 11 Step 3) |
| Reads as stock-tip site | We map chains, exposure = factual supply data; disclaimers; no tickers in zh posts; no buy/sell language anywhere |
| Stripe verification delay | Account created today; Payment Links need no extra approval |
| Payment flow breaks | Real-card test + self-refund before the thread goes out |
| 100% unreviewed undermines trust story | Fri/Sat review passes put real rungs on the ladder before we market it |
| Wave decays | Drumbeat structure (Fri/Sat/Tue drops) creates three news moments instead of one |

## Metrics (review Sun + post-HN)

Unlocks per domain + founding take-rate (Stripe) · `unlock_click` per domain (orders week-2 production) · email signups · deep-link CTR from threads · `/graph` median session · X saves.

## Week-2 preview

Domain #4 by launch-thread vote · price test $9 vs $12 · Substack deep-dives · exposure-layer API teaser for quant-ish users · CN mirror decision on zh funnel data.
