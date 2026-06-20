# Commercial Readiness Audit - 2026-06-13

Scope: public launch readiness for a US-first paid research product, including the landing page, free demo route, paid-candidate routes, and SpaceX research-preview routes.

Screenshots:
- `en_home.png`
- `en_ai_compute.png`
- `en_humanoid.png`
- `en_fusion.png`
- `en_spacex_reuse.png`
- `en_spacex_odc.png`
- `zh_home.png`
- `zh_ai_compute.png`
- `zh_humanoid.png`
- `zh_fusion.png`
- `zh_spacex_reuse.png`
- `zh_spacex_odc.png`

Verdict: not yet full commercial-grade for paid public launch. The route-reader core is close to commercial preview quality, but the overall launch surface still has P1 blockers.

P1 blockers:
- English landing page mixes in a full Chinese paragraph in the first viewport. For a US-first paid audience, this is a credibility and localization blocker.
- Paid-candidate pages are honest about locked exposure, but the product is not purchase-ready: checkout, entitlement, and subscription flow are still not configured. The current state is waitlist/preview, not commercial paid launch.
- Paid route first-screen value is still too low on the page. In English mode, the graph canvas starts around y=409 on Humanoid, Fusion, and SpaceX research routes because the thesis and control chrome are tall. This weakens the "see the bottleneck immediately" promise.

P2 issues:
- Chinese mode still contains substantial English route titles, descriptions, and bottleneck statements.
- Some badge and rail copy is dense and operational rather than buyer-facing.
- Route pages are usable, but right-rail evidence/action hierarchy still feels crowded for first-time users.

Commercial positives:
- SpaceX reusable launch and orbital data center are now correctly marked as research previews, not paid-scored products.
- SpaceX routes no longer expose supplier/ticker actions as if reviewed.
- Free versus paid states are visible without a promotional "free demo" card.
- Core graph labels, edge-weight differentiation, and route tabs are substantially improved versus the earlier state.

Recommended next gate:
1. Fix English landing page localization and disclaimer consistency.
2. Decide and implement launch conversion model: real checkout/subscription, or explicitly position paid domains as waitlist-only private preview.
3. Compress paid/research route thesis area so the graph and bottleneck thesis are visible earlier.
4. Add a conversion-ready paid state above the fold without blocking the graph's first-read value.
5. Defer full Chinese commercial readiness unless bilingual launch is a real target for v1.
