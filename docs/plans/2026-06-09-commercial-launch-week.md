# Commercial Launch Week Implementation Plan (rev 3, 2026-06-10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch a retail-focused chokepoint-map product with the GPU/AI-compute chain as the **full-free flagship/trust demo** (Fri 6/12). AI compute should expose the whole map, evidence ladder, and supplier exposure for free because the obvious AI-compute exposure set is already externally over-disclosed. Paid/waitlist demand now shifts to less over-disclosed emerging domains such as humanoid robotics, world models, controlled fusion, and later domains; do not present humanoid/power/fusion as live unless the data, route, review state, and Stripe target actually support it.

**Architecture:** Unchanged app + flat-JSON data. AI compute and parcel sorting are full-free demos: full decomposition, bottlenecks, evidence/review states, gate reports, `organization` nodes, `manufactured_by` edges, and Investor-panel exposure are visible. Paywall plumbing remains useful for future paid emerging domains: when a paid domain is intentionally live, server-side stripping can hide org/exposure bytes from non-entitled viewers, with entitlements granted by signed JWT cookie after Stripe-session verification on redirect (no DB, no webhooks).

**Tech Stack:** Next.js 15 on Vercel, Stripe Payment Links + `stripe` SDK, `jose`, Buttondown, Vercel Analytics, existing pipeline (`import:candidates`, `validate:data`, `gate`).

**Verified ground truth (2026-06-10 exploration):**
- `npm run build` passes. Parcel domain: 312 nodes / 604 edges / 188 evidence (96% with URLs), 18 ⚠ bottleneck nodes, 53 frontier, **0 🔑 key-tech**, review status 100% unreviewed.
- The retail core ALREADY EXISTS in the UI: Bottleneck-risk lens with ranked **KEY RISK NODES** panel; node detail with Risk/Maturity/rolled-up cost; **Investor answer panel** with top risk bottleneck, cost gap, throughput constraints, and **Candidate exposure incl. tickers + market share** (FANUC 6954.T, Estun 002747.SZ, Inovance 300124.SZ). It is buried 4 clicks deep (default lens = Cost drivers → switch lens → click node → Detail tab → scroll).
- Mobile: canvas unusable, but rail content (ranked list + detail cards) stacks readably; lens panel needs collapsing.
- Edge relations available: requires 128 / measured_by 108 / manufactured_by 259 / implemented_by 95 / enables 6 / regulated_by 1. Org-to-component mapping with listings renders end-to-end already.
- Bottlenecks live on nodes as `bottleneckOf: string[]` (ADR-0006); nodes carry `domain: string[]` tags; risk = (1 − maturityScore/100) × cost_share (`src/lib/nodeRisk.ts`) — a relative heat signal, NOT a probability.

**Decisions locked (owner can override):**
1. **Free/paid line:** AI compute is full-free flagship; parcel sorting remains the secondary full-free demo. Future paid domains can charge for verified living maps, freshness, and curated exposure, but AI compute is not the paid unit.
2. **Domain drumbeat:** Fri = AI-compute chain as a free trust drop (wafer → CoWoS → HBM → ABF substrate → InP photonics → cooling/power-delivery). Sat/Tue beats become waitlist or research-drop beats for emerging domains unless their data/routes/review state are actually ready. Candidate paid areas: humanoid robotics, world models, controlled fusion; AI-datacenter power is no longer promised as a live paid drop by default.
3. **Positioning:** we map chains ourselves from supply-chain facts; exposure falls out of the data. NOT a Serenity tracker, no copying his picks, no buy/sell language. Disclaimer site-wide.
4. **MVP fixes from exploration ship before launch:** default lens = bottleneck-risk + URL deep links; Investor panel promoted to first screen after node click; "Risk 46%" relabeled to heat score with plain-language tooltip.
5. **Referral** ("invite 3 signups → priority/future unlock") ships only when there is a real paid emerging-domain target; before then it collects waitlist/referral demand.
6. **RESOLVED 2026-06-10:** domain = **drt030.com** (purchased). Display brand stays "Capability Graph Explorer" for launch (rename is a one-line metadata change later if desired).
7. **Information architecture (2026-06-10, strategy-migrated):** one site, one route per ready domain — `/d/ai-compute` and `/d/parcel-robot` are full-free; `/d/humanoid-actuators` or other emerging-domain routes should only be promoted when backed by real data. Header switcher, per-domain OG/metadata/gate, and `/unlock` remain, but `/unlock` redirects only for an actually live paid domain or founding target.
8. **Teaser rule ("tuna free, perilla paid") for future paid domains only:** a famous supplier can remain free as a trust builder; obscure/single-source suppliers may stay locked. AI compute does not use teaser gating because the entire flagship is free.
9. **Stripe hardening (per stripe-best-practices):** the `/unlock` route uses a **Restricted API Key** (Checkout Sessions read-only), not the full secret key; separate test/live keys; keys only in `.env.local`/Vercel env vars. Do not switch AI-compute checkout live; owner-only live Stripe targets the next paid emerging-domain/founding stream.

**Non-goals this week:** depth gating, AI-compute paid gating, B2B, accounts/DB, CN mirror, Substack, guided tours, canvas mobile optimization, key-tech 🔑 backfill beyond the flagship handful (or drop the glyph from marketing if not backfilled).

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
- [ ] **Step 2:** Agent research brief — for each module: maturity (`maturityAsOf: "2026-06"`), capacity-expansion lead time, top-3 chokepoints with `bottleneckOf`, **org nodes with `manufactured_by` edges carrying listing + market-share metrics** as part of the free flagship trust demo (e.g. TSMC 2330.TW/TSM, SK hynix 000660.KS, Ibiden 4062.T, Unimicron 3037.TW, ASMPT 0522.HK, AXT AXTI, Coherent COHR…), every claim → evidence record with URL + accessed date, review status `unreviewed`.
- [ ] **Step 3:** Run overnight; import/review is Fri morning (Task 14). Tag all nodes `domain: ["ai_compute_chain"]`.

---

## Day 2 — Thu 2026-06-11: payments + exposure paywall + retail MVP fixes + landing

### Task 8: Stripe products + entitlement library for future paid domains

**Files:** Create `src/lib/entitlements.ts` · Test `tests/entitlements.test.ts`

- [ ] **Step 1 (owner, dashboard):** Do **not** create or switch live an AI-compute paid product. Create live products only for an actually ready emerging-domain paid drop or a founding stream, for example "Founding living-map stream" and a named next-domain product once data/route/review are ready. Payment Links each redirect to `https://<DOMAIN>/unlock?session_id={CHECKOUT_SESSION_ID}`. Enable Stripe Tax + Alipay when the live paid stream exists.
- [ ] **Step 2:** `npm install stripe jose`; `openssl rand -hex 32` → `ENTITLEMENT_SECRET`.

Env (`.env.local` + Vercel): `STRIPE_SECRET_KEY`, `ENTITLEMENT_SECRET`, `STRIPE_PRICE_EMERGING_DOMAIN`, `STRIPE_PRICE_FOUNDING`, `NEXT_PUBLIC_STRIPE_LINK_EMERGING_DOMAIN`, `NEXT_PUBLIC_STRIPE_LINK_FOUNDING`. Add domain-specific price/link env vars only when a paid domain is live.

- [ ] **Step 3: Failing test**

```ts
// tests/entitlements.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { grantCookieValue, readEntitlements } from "../src/lib/entitlements";

test("entitlement cookie round-trips and merges", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  const v1 = await grantCookieValue("emerging_domain", []);
  assert.deepEqual(await readEntitlements(v1), ["emerging_domain"]);
  const v2 = await grantCookieValue("all", await readEntitlements(v1));
  assert.deepEqual((await readEntitlements(v2)).sort(), ["all", "emerging_domain"]);
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
  ["STRIPE_PRICE_EMERGING_DOMAIN", "emerging_domain"],
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
  const res = NextResponse.redirect(new URL("/?founding=1", url.origin));
  res.headers.append(
    "Set-Cookie",
    `${ENTITLEMENT_COOKIE}=${value}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
```

- [ ] **Step 2:** Stripe test mode end-to-end (test card → redirect → cookie set → future paid-domain/founding entitlement visible in diagnostics). Switch to live keys only for the next paid emerging-domain/founding stream, not for AI compute. Commit `"feat: stripe session verification unlock route"`.

### Task 10: Exposure-layer gating for future paid domains

AI compute and parcel sorting are deliberately full-free. For future paid domains only, free viewers get full structure while `organization` nodes, `manufactured_by` edges, and org-only evidence can be stripped server-side until entitlement is present.

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
    { id: "joint", name: "Humanoid joint module", kind: "module", domain: ["future_emerging_chain"] },
    { id: "supplier", name: "Specialist Supplier", kind: "organization", domain: ["future_emerging_chain"] },
    { id: "fanuc", name: "FANUC", kind: "organization", domain: ["parcel_sorting_robot"] },
  ] as GraphData["nodes"],
  edges: [
    { id: "e1", source: "joint", target: "supplier", relation: "manufactured_by", evidenceIds: ["ev_org"] },
  ] as GraphData["edges"],
  evidence: [
    { id: "ev_org", type: "industry_report", title: "Specialist supply", supportsNodeIds: ["supplier"] },
    { id: "ev_keep", type: "industry_report", title: "Module process" },
  ] as GraphData["evidence"],
};

test("strips org nodes, manufactured_by edges, org-only evidence for locked domains", () => {
  const { graph, locked } = stripExposureLayer(fixture, [], [
    { domainTag: "future_emerging_chain", entitlement: "emerging_domain" },
  ]);
  assert.ok(!graph.nodes.some((n) => n.id === "supplier"));
  assert.ok(graph.nodes.some((n) => n.id === "fanuc"));          // other-domain org untouched
  assert.equal(graph.edges.length, 0);
  assert.ok(!graph.evidence.some((ev) => ev.id === "ev_org"));
  assert.ok(graph.evidence.some((ev) => ev.id === "ev_keep"));   // non-org evidence stays free
  assert.equal(locked[0].hiddenOrgCount, 1);
});

test("entitled viewer keeps everything", () => {
  const { graph } = stripExposureLayer(fixture, ["emerging_domain"], [
    { domainTag: "future_emerging_chain", entitlement: "emerging_domain" },
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
  // Add future emerging paid domains here only after data, route, review state, and Stripe target are ready.
  // ai_compute_chain and parcel_sorting_robot are deliberately absent — full-free demos.
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

> 🔒 **Who makes this — and who's listed?** {hiddenOrgCount} suppliers with tickers, market share, and capacity signals. Unlock this emerging-domain drop or join founding access. zh: 「🔒 谁在造它？{n} 家供应商（含上市代码与市场份额）· 解锁这个新兴领域或加入创始订阅」

`track("unlock_click", { domain })` on CTA click (`import { track } from "@vercel/analytics"`).

- [ ] **Step 7: Leak check.** No cookie: `curl -s <preview>/<paid-domain-route> | grep -ci "<locked-supplier-name>"` → 0 on gated domain views; with cookie → present. AI compute and parcel pages still show their exposure layers free.
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
  1. **Hero:** H1 "Find the chokepoint before the market does." Sub "Free interactive bottleneck maps of real supply chains — every claim cited. The AI compute flagship is fully open so you can judge the method." CTA "See the free AI compute chain →" (`/d/ai-compute?lens=bottleneck`).
  2. **Domain cards:** AI compute chain — FULL FREE flagship incl. supplier exposure | Parcel-sorting robot — FULL FREE depth demo | Humanoid robotics — next emerging-domain waitlist | World models — waitlist | Controlled fusion — waitlist. Do not label humanoid/power/fusion as live unless their routes/data are actually ready.
  3. **Founding offer:** founding interest for the verified living-map stream across future emerging domains; no AI-compute unlock promise.
  4. **Trust:** glyph legend + "claims carry unreviewed/reviewed/disputed status; disputed ranks below unreviewed. Gate reports public →" `/gate`.
  5. **Email capture** (Buttondown embed): "Get the next under-disclosed domain drop."
- [ ] **Step 3:** Mobile pass at 380px (cards stack, buy buttons thumb-reachable). `/graph` <768px: collapse the MAP/LENS panel to a toggle button; notice "Best on desktop — the ranked list below works great on mobile".
- [ ] **Step 4:** OG images 1200×630 (bottleneck-lens beauty shot + wordmark) → `public/og/`; per-page metadata; validate X card.
- [ ] **Step 5:** Fix tests assuming `/` is research home (`grep -rn 'href="/"' src/ tests/`); `npm run verify`; deploy; commit `"feat: retail landing, mobile lens collapse, OG cards"`.

---

## Day 3 — Fri 2026-06-12: flagship content + reviewed batch + LAUNCH

### Task 13: Import + finalize AI-compute chain (morning)

- [ ] Import overnight batch: `npm run import:candidates -- <batch>`; `npm run validate:data && npm run check:active-graph-scope`.
- [ ] Verify free exposure layer: AI-compute org nodes carry listing + share metrics; investor panel renders them with no entitlement; no lock CTA appears on AI compute.
- [ ] **Review pass (the credibility move):** personally verify the 10–15 core chokepoint claims (CoWoS capacity, HBM booking, ABF, InP) → flip those to `reviewed`. The ladder needs real rungs before we market it.
- [ ] 🔑 backfill on 3–5 true key techs (CoWoS, HBM TSV, InP epitaxy) — or remove 🔑 from landing legend.
- [ ] zh names for new visible roots (`nodeTextZh`; languageCoverage test enforces). `npm run gate -- --target ai_accelerator_module_hbm_cowos --dry-run`.
- [ ] `npm run verify`; commit `"data: AI compute chain v1 (cited, partially reviewed, full-free flagship)"`; `npx vercel deploy --prod`.

### Task 14: Launch (target 10:00 ET; floor Sat 09:00)

- [ ] **Smoke:** AI compute full-free route, parcel full-free route, OG card, email/founding-interest forms, 403 guard, mobile landing. If a future paid domain is already ready, run a real-card checkout + self-refund there; otherwise keep paid checkout in test mode and do not block the AI-compute launch on it.
- [ ] **EN thread** (final draft):

> **1/** Everyone's hunting AI-supply-chain chokepoints. Almost nobody can show you the map. I built one — interactive, cited, free: the full AI compute chain from wafer to rack. [screenshot + deep link `/graph?lens=bottleneck`]
> **2/** Every ⚠ node = currently gating the buildout. CoWoS capacity. HBM booked out. ABF substrates. InP lasers. Click any of them: evidence, maturity, lead times. All free. [zoom screenshot]
> **3/** The graph is honest about what it doesn't know — every claim is labeled reviewed/unreviewed, disputed ranks *below* unreviewed, and the validation gate report is public. [evidence panel screenshot]
> **4/** Why free? AI compute exposure has been talked to death. I'm using the whole thing as a trust demo: decomposition, evidence, suppliers, review states, all visible.
> **5/** The paid work moves to domains that are earlier and less mapped: humanoid robotics, world models, controlled fusion. Join the waitlist/founding stream for those drops. Free full demo also exists for a 300k-RMB parcel-sorting robot. Research tool, not investment advice.

- [ ] **zh channels:** same structure, 「这周大家都在聊 AI 算力链。我把 GPU 算力链拆成了可交互的瓶颈图谱：结构、证据、谁在造、上市信息都免费看。付费/创始订阅会转向更早期、没被充分披露的新兴领域，比如人形机器人、世界模型、可控核聚变。研究工具，不荐股。」 No tickers in the post itself.
- [ ] All-day engagement: answer with graph screenshots; quote-RT into chokepoint conversations; do NOT reply-spam Serenity.

---

## Sat 6/13: emerging-domain waitlist/research beat

- [ ] **Task 15:** Humanoid robotics candidate: only promote a live route if the graph is actually ready. Target boundary can start at Capability `humanoid_robot_actuator_joint` → Products `rotary_actuator_harmonic` / `linear_actuator_roller_screw` / `dexterous_hand_actuator`; **link into existing** `precision_reducer_gearbox`/servo subtrees (no duplication); deltas researched by agent (roller screws + grinding capacity, frameless torque motors, 六维力/力矩传感器, encoders, tendons); org/listing exposure belongs to the future paid/waitlist layer; tag `domain: ["humanoid_actuator"]`; 10+ core claims personally `reviewed`; zh names; validate + gate dry-run before deploy.
- [ ] **Task 16:** If route/data are ready, publish "Chain #2: humanoid robot actuators" as a research drop with clear review status. If not ready, publish a waitlist post: "AI compute is free; the next paid living-map candidates are humanoid robotics, world models, and controlled fusion. Vote/join waitlist." Label-truncation polish (LOD width bump) if time.

## Sun 6/14: iterate + next paid-domain selection

- [ ] Fix top friction from analytics; founding/waitlist-count post if honest; choose the next paid-domain candidate from actual demand and strategic fit (humanoid robotics, world models, controlled fusion, or another under-disclosed domain). Kick off agent research only after the product boundary is clarified.

## Tue 6/16: referral/waitlist + Show HN (third beat)

- [ ] **Task 17:** Import/finalize the selected next paid-domain candidate only if it meets the same DoD as Task 15; create Stripe price/link only after the route/data/review target are ready. Landing card flips from waitlist to live only then.
- [ ] **Task 18:** Referral: "invite 3 confirmed signups → priority or future unlock" — ref code → Buttondown attribution → at threshold, email a signed unlock/priority link once a paid domain exists (reuse `grantCookieValue`; Upstash free tier for counters). Own announcement post.
- [ ] **Task 19:** Show HN ~14:00 UTC: `Show HN: Interactive bottleneck maps of supply chains`. First comment: architecture + the review-status honesty ladder + public gate reports + ADRs + why AI compute is full-free and paid work moves to under-disclosed domains. Epistemics first, investing second.

---

## Risks

| Risk | Mitigation |
|---|---|
| AI-compute content thin by Fri | Research started Wed night; flagship needs top-8 chokepoints with evidence, not commodity-leaf depth; parcel demo carries the depth story; floor = Sat launch |
| Future paid-domain exposure leaks | Server-side strip + curl leak check (Task 10 Step 7) before any paid-domain deploy; gate/tasks pages checked for org enumeration |
| "Risk %" misread as probability | Heat relabel + tooltip ships before launch (Task 11 Step 3) |
| Reads as stock-tip site | We map chains, exposure = factual supply data; disclaimers; no tickers in zh posts; no buy/sell language anywhere |
| Stripe verification delay | No longer blocks AI-compute free launch; it blocks only the next paid emerging-domain/founding stream |
| Payment flow breaks | Real-card test + self-refund before any paid-domain thread goes out |
| 100% unreviewed undermines trust story | Fri/Sat review passes put real rungs on the ladder before we market it |
| Wave decays | AI-compute free flagship captures the current wave; follow-up beats collect demand for less over-disclosed domains |

## Metrics (review Sun + post-HN)

AI-compute sessions · email/waitlist signups · founding-interest clicks · future paid-domain unlocks once live · deep-link CTR from threads · `/graph` median session · X saves.

## Week-2 preview

Next paid-domain choice by launch-thread vote/waitlist signal · first emerging-domain price test · Substack deep-dives · verified living-map API teaser for quant-ish users · CN mirror decision on zh funnel data.
