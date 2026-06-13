import Link from "next/link";
import { DOMAIN_PORTFOLIO_ENTRIES } from "@/lib/domains";

const buttondownEndpoint = "https://buttondown.com/api/emails/embed-subscribe/drt030";

export function LandingContent() {
  return (
    <div className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">Capability Graph Explorer · drt030.com</p>
          <h1 id="landing-title">Find the chokepoint before the market does.</h1>
          <p className="landing-lede">
            AI compute and parcel robot are reference maps for judging the method. Humanoid robotics and controlled
            fusion are paid-candidate previews. SpaceX reusable launch and orbital data centers add the space vertical:
            route logic and evidence are visible, while organization exposure stays locked until checkout and entitlement
            gates are verified.
          </p>
          <p className="landing-zh">
            AI compute 和 parcel robot 是用于判断方法的参考图谱。Humanoid robotics 与 controlled fusion 现在是
            paid-candidate preview；SpaceX reusable launch 与 orbital data center 是太空方向候选图谱。部件路线和证据可见，
            组织与股票 exposure 仍在付费层锁定，直到 checkout 与 entitlement gate 验证完成。本工具用于产业研究，不构成投资建议。
          </p>
          <div className="button-row landing-cta-row">
            <Link href="/d/ai-compute" className="button">
              Open the AI compute map
            </Link>
            <Link href="/d/controlled-fusion" className="button secondary">
              Preview fusion routes
            </Link>
          </div>
        </div>
        <div className="landing-map-preview" aria-label="Bottleneck map preview">
          <div className="map-preview-header">
            <span>Launch map</span>
            <strong>AI compute chain</strong>
          </div>
          <div className="map-preview-rail">
            <span>Wafer</span>
            <i />
            <span>CoWoS</span>
            <i />
            <span>HBM</span>
            <i />
            <span>ABF</span>
            <i />
            <span>Power + cooling</span>
          </div>
          <div className="map-preview-grid">
            <div className="map-node hot">
              <span>Heat 91/100</span>
              <strong>Advanced packaging</strong>
            </div>
            <div className="map-node">
              <span>Review states visible</span>
              <strong>Cited evidence</strong>
            </div>
            <div className="map-node included">
              <span>Reviewed only when human-checked</span>
              <strong>Tickers + evidence visible</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="domains-title">
        <div className="landing-section-head">
          <p className="landing-eyebrow">Current drops</p>
          <h2 id="domains-title">One route per chain, one map you can inspect.</h2>
          <p className="muted">
            AI compute and parcel-sorting robot are reference maps. Humanoid robotics, controlled fusion, and SpaceX
            space maps are visible as paid-candidate previews while their exposure layer, checkout, and update model
            remain under review.
          </p>
        </div>
        <div className="landing-domain-grid">
          {DOMAIN_PORTFOLIO_ENTRIES.map((domain) => (
            <article className="landing-domain-card" key={domain.slug}>
              <span>{domain.statusLabel}</span>
              <h3>{domain.title}</h3>
              <p>{domain.detail}</p>
              <Link href={domain.href} className="landing-card-link">
                {domain.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-offer-band" aria-labelledby="offer-title">
        <div>
          <p className="landing-eyebrow">Founding offer</p>
          <h2 id="offer-title">Founding interest for future paid domains.</h2>
          <p>
            Paid-candidate domains expose the decomposition and evidence trail first. Supplier identities, tickers,
            updates, and curated exposure remain locked until the checkout and entitlement path is verified.
          </p>
        </div>
        <Link href="#weekly-map" className="button">
          Join the waitlist
        </Link>
      </section>

      <section className="landing-trust-grid" aria-labelledby="trust-title">
        <div className="landing-section-head">
          <p className="landing-eyebrow">Trust model</p>
          <h2 id="trust-title">Generation is cheap now. Verification is not.</h2>
          <p className="muted">
            Claims carry review states. Disputed ranks below unreviewed. The graph is a research substrate, not a stock
            tip sheet.
          </p>
        </div>
        <div className="landing-trust-panel">
          <h3>Review status ladder</h3>
          <ul className="landing-status-list">
            <li>
              <strong>Reviewed</strong>
              <span>Human-checked claim with supporting evidence.</span>
            </li>
            <li>
              <strong>Unreviewed</strong>
              <span>Agent or placeholder material pending review.</span>
            </li>
            <li>
              <strong>Disputed</strong>
              <span>Visible, downgraded, and treated more cautiously than unreviewed.</span>
            </li>
          </ul>
        </div>
        <div className="landing-trust-panel">
          <h3>Glyph legend</h3>
          <ul className="landing-glyph-list">
            <li>
              <span className="signal-glyph signal-glyph-bottleneck" aria-hidden="true">
                ⚠
              </span>
              <strong>Bottleneck</strong>
            </li>
            <li>
              <span className="signal-glyph signal-glyph-keytech" aria-hidden="true">
                🔑
              </span>
              <strong>Key technology</strong>
            </li>
            <li>
              <span className="signal-glyph signal-glyph-frontier" aria-hidden="true">
                🔭
              </span>
              <strong>Frontier to research</strong>
            </li>
          </ul>
          <Link href="/gate" className="landing-card-link">
            View public gate reports
          </Link>
        </div>
      </section>

      <section className="landing-email-band" id="weekly-map" aria-labelledby="email-title">
        <div>
          <p className="landing-eyebrow">Weekly map</p>
          <h2 id="email-title">One new chain map per week.</h2>
          <p className="muted">
            Get the next drop, review notes, and the public validation trail. No account is required.
          </p>
        </div>
        <form action={buttondownEndpoint} method="post" target="_blank" className="buttondown-form">
          <label htmlFor="bd-email">Email</label>
          <div>
            <input id="bd-email" name="email" type="email" placeholder="you@example.com" required />
            <input type="hidden" name="embed" value="1" />
            <button type="submit">Subscribe</button>
          </div>
        </form>
      </section>
    </div>
  );
}
