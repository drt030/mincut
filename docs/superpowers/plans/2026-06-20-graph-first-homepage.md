# Graph-First Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the root marketing landing page with a graph-first AI compute workspace that matches the saved approved preview.

**Architecture:** Reuse the existing domain graph data path from `/d/[slug]` rather than forking graph behavior. Root `/` loads the `ai-compute` domain on the server, wraps `GraphExplorer` with the same exposure/holder providers, and adds a homepage-only collapsed map dock outside the graph canvas.

**Tech Stack:** Next.js App Router, React server/client components, TypeScript, existing local JSON graph loader, existing `GraphExplorer`, CSS in `src/app/globals.css`, Node test runner.

---

## File Structure

- Modify `src/app/page.tsx`: server-load `ai-compute`, apply entitlement filtering, render graph-first shell.
- Create `src/components/HomeMapDock.tsx`: client/domain dock links and popover.
- Modify `src/app/globals.css`: graph-first homepage shell, collapsed dock, popover, responsive behavior.
- Modify `tests/landingContent.test.ts`: replace old landing assertions with root graph-first assertions.
- Keep `src/components/LandingContent.tsx`: retained for reference or future secondary marketing surface, but no longer used by `/`.
- Use saved reference: `docs/plans/assets/homepage-graph-first-preview.png`.

## Task 1: Root Page Data Path

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write failing test**

Replace the root landing test body in `tests/landingContent.test.ts` with an assertion that root page source imports graph-first dependencies, not `LandingContent`:

```ts
test("root page renders the graph-first ai compute workspace", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /domainBySlug\("ai-compute"\)/);
  assert.match(source, /GraphExplorer/);
  assert.match(source, /HomeMapDock/);
  assert.doesNotMatch(source, /LandingContent/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/landingContent.test.ts`

Expected: FAIL because `src/app/page.tsx` still imports `LandingContent`.

- [ ] **Step 3: Implement root server page**

Make `src/app/page.tsx` follow the existing `/d/[slug]` server flow for the `ai-compute` domain:

```tsx
import { Suspense } from "react";
import { cookies } from "next/headers";
import { ExposureLockProvider } from "@/components/ExposureLockCta";
import { GraphExplorer } from "@/components/GraphExplorer";
import { HolderTeaserProvider } from "@/components/HolderTeaserProvider";
import { HomeMapDock } from "@/components/HomeMapDock";
import { ENTITLEMENT_COOKIE, readEntitlements } from "@/lib/entitlements";
import { domainBySlug } from "@/lib/domains";
import { stripExposureLayer } from "@/lib/exposureGate";
import { loadActiveGraphData } from "@/lib/graphLoader";
import { computeHolderTeasers } from "@/lib/holderTeasers";
import { resolveRouteExposureAccess } from "@/lib/routeAccess";

export default async function HomePage() {
  const domain = domainBySlug("ai-compute");
  if (!domain) throw new Error("Missing ai-compute domain route");

  const full = loadActiveGraphData(domain.rootId);
  const entitlements = await readEntitlements((await cookies()).get(ENTITLEMENT_COOKIE)?.value);
  const holderTeasers = computeHolderTeasers(full);
  const { graph, locked } = stripExposureLayer(full, entitlements);
  const exposureAccess = resolveRouteExposureAccess(domain, locked);

  return (
    <div className="graph-first-home">
      <HomeMapDock activeSlug={domain.slug} />
      <div className="graph-first-home-main">
        <section className="graph-first-home-thesis" aria-labelledby="home-map-title">
          <div>
            <p className="graph-first-eyebrow">Research workspace</p>
            <h1 id="home-map-title">{domain.title}</h1>
            <p>{domain.description}</p>
          </div>
          <span>Full-free flagship</span>
        </section>
        <Suspense fallback={<div className="panel">Loading graph...</div>}>
          <ExposureLockProvider locked={locked}>
            <HolderTeaserProvider teasers={holderTeasers}>
              <GraphExplorer graph={graph} initialRootId={domain.rootId} exposureAccess={exposureAccess} operatorMode={false} />
            </HolderTeaserProvider>
          </ExposureLockProvider>
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/landingContent.test.ts`

Expected: PASS for the root source test.

## Task 2: Collapsed Map Dock

**Files:**
- Create: `src/components/HomeMapDock.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/landingContent.test.ts`

- [ ] **Step 1: Add failing dock test**

Append:

```ts
test("home map dock keeps collapsed shortcuts quiet", async () => {
  const { HomeMapDock } = await import("../src/components/HomeMapDock");
  const html = renderToStaticMarkup(React.createElement(HomeMapDock, { activeSlug: "ai-compute" }));

  assert.match(html, /Maps/);
  assert.match(html, /AI/);
  assert.match(html, /PR/);
  assert.match(html, /SX/);
  assert.match(html, /HR/);
  assert.match(html, /CF/);
  assert.match(html, /AI compute chain/);
  assert.match(html, /Full-free flagship demo/);
  assert.doesNotMatch(html, /green dot/i);
  assert.doesNotMatch(html, /red dot/i);
  assert.doesNotMatch(html, /琥珀点/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/landingContent.test.ts`

Expected: FAIL because `HomeMapDock` does not exist.

- [ ] **Step 3: Implement `HomeMapDock`**

Create `src/components/HomeMapDock.tsx`:

```tsx
"use client";

import Link from "next/link";
import { DOMAIN_ROUTES } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

const abbreviations: Record<string, string> = {
  "ai-compute": "AI",
  "parcel-robot": "PR",
  "spacex-reusable-launch": "SX",
  "humanoid-robotics": "HR",
  "controlled-fusion": "CF",
  "spacex-orbital-data-center": "OD",
};

function statusLabel(portfolioState: string): string {
  if (portfolioState === "full-free-flagship") return "Full-free flagship demo";
  if (portfolioState === "full-free-depth-demo") return "Full-free depth demo";
  if (portfolioState === "audit-preview") return "Preview; exposure locked";
  if (portfolioState === "paid-candidate") return "Paid-candidate preview";
  return "Preview domain";
}

export function HomeMapDock({ activeSlug }: { activeSlug: string }) {
  const { nodeName } = useLanguage();
  return (
    <aside className="home-map-dock" aria-label="Map portfolio">
      <div className="home-map-dock-stack">
        <button className="home-map-trigger" type="button" aria-label="Open map portfolio">
          Maps
        </button>
        {DOMAIN_ROUTES.map((domain) => {
          const active = domain.slug === activeSlug;
          return (
            <Link
              key={domain.slug}
              href={`/d/${domain.slug}`}
              className={["home-map-shortcut", active ? "active" : ""].filter(Boolean).join(" ")}
              aria-current={active ? "page" : undefined}
              title={nodeName(domain.rootId, domain.title)}
            >
              {abbreviations[domain.slug] ?? domain.title.slice(0, 2).toUpperCase()}
            </Link>
          );
        })}
      </div>
      <div className="home-map-popover">
        <div>
          <h2>Domains</h2>
          <p>Switch maps without leaving the graph workspace.</p>
        </div>
        <div className="home-map-popover-list">
          {DOMAIN_ROUTES.map((domain) => {
            const active = domain.slug === activeSlug;
            return (
              <Link
                key={domain.slug}
                href={`/d/${domain.slug}`}
                className={["home-map-popover-item", active ? "active" : ""].filter(Boolean).join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <strong>{nodeName(domain.rootId, domain.title)}</strong>
                <span>{statusLabel(domain.portfolioState)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Add CSS**

Add CSS matching the approved preview: 64px dock, quiet shortcuts, hover/focus popover, mobile hidden.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/landingContent.test.ts`

Expected: PASS.

## Task 3: Browser Verification

**Files:**
- Use saved reference: `docs/plans/assets/homepage-graph-first-preview.png`

- [ ] **Step 1: Run app**

Run: `npm run dev`

Expected: local Next server URL.

- [ ] **Step 2: Open `/` in browser**

Verify:
- Root page shows the real AI compute graph, not marketing hero.
- Left dock is 64px and has no colored status dots.
- Dock popover expands on hover/focus.
- Header domain selector still works for mobile/standard switching.
- Footer disclaimer remains visible.

- [ ] **Step 3: Compare against saved preview**

Use `docs/plans/assets/homepage-graph-first-preview.png` as the reference. Any intentional divergence must be stated in the final handoff.

## Task 4: Validation

**Files:**
- All modified source/tests/docs.

- [ ] **Step 1: Run focused test**

Run: `npx tsx --test tests/landingContent.test.ts`

Expected: PASS.

- [ ] **Step 2: Run UI validation**

Run: `npm run verify:ui`

Expected: PASS.

- [ ] **Step 3: Report saved preview paths**

Final handoff must include:
- `docs/plans/assets/homepage-graph-first-preview.html`
- `docs/plans/assets/homepage-graph-first-preview.png`
- `docs/plans/assets/homepage-graph-first-ai-compute-map-preview.png`

