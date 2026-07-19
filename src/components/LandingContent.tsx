"use client";

import Link from "next/link";
import { DOMAIN_PORTFOLIO_ENTRIES } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

const buttondownEndpoint = "https://buttondown.com/api/emails/embed-subscribe/drt030";

const landingCopy = {
  en: {
    eyebrow: "MinCut · drt030.com",
    title: "Find the bottlenecks in how things get made.",
    lede:
      "AI compute is the full free demo. Humanoid robotics, controlled fusion, and the SpaceX maps show the map, bottleneck thesis, and evidence trail; founding access unlocks supplier/ticker exposure.",
    disclaimer: "Industrial research only. Company and ticker context supports diligence; it is not investment advice.",
    primaryCta: "Open the AI compute map",
    secondaryCta: "Preview fusion routes",
    previewLabel: "Launch map",
    previewTitle: "AI compute chain",
    previewNodes: ["Wafer", "CoWoS", "HBM", "ABF", "Power + cooling"],
    previewHotEyebrow: "Heat 91/100",
    previewHotTitle: "Advanced packaging",
    previewEvidenceEyebrow: "Evidence trail visible",
    previewEvidenceTitle: "Cited evidence",
    previewExposureEyebrow: "Ticker exposure when ready",
    previewExposureTitle: "Tickers + evidence visible",
    currentDropsEyebrow: "Current drops",
    currentDropsTitle: "One route per chain, one map you can inspect.",
    currentDropsBody:
      "Free demos show the full method. Paid-preview maps show the thesis and evidence while founding access unlocks supplier/ticker exposure.",
    offerEyebrow: "Founding access",
    offerTitle: "Founding access opens the paid exposure layer.",
    offerBody:
      "Buy access when checkout is available, or leave an email for the next access batch. Supplier identities, tickers, updates, and curated exposure stay gated until entitlement is verified.",
    offerCta: "Join the access list",
    betaEmailLabel: "Work email",
    betaEmailPlaceholder: "you@fund.com",
    betaSubmit: "Request beta access",
    trustEyebrow: "Trust model",
    trustTitle: "Generation is cheap now. Verification is not.",
    trustBody:
      "Claims carry source-strength signals. Weak or conflicting evidence is kept out of first-order recommendations. The graph is a research substrate, not a stock tip sheet.",
    statusTitle: "Evidence strength ladder",
    reviewedTitle: "Strong",
    reviewedBody: "Claim backed by a direct source and clear scope.",
    sourceCheckedTitle: "Source-checked",
    sourceCheckedBody: "Source re-fetched; quote and number confirmed. Not yet owner-reviewed.",
    unreviewedTitle: "Thin",
    unreviewedBody: "Useful direction, but needs stronger sourcing before exposure is opened.",
    disputedTitle: "Conflicting",
    disputedBody: "Visible as a caution signal and kept out of first-order recommendations.",
    glyphTitle: "Glyph legend",
    bottleneck: "Bottleneck",
    keyTech: "Key technology",
    frontier: "Frontier to research",
    gateCta: "View public gate reports",
    emailEyebrow: "Weekly map",
    emailTitle: "One new chain map per week.",
    emailBody: "Get the next drop, source notes, and the public validation trail. No account is required.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    emailSubmit: "Subscribe",
  },
  zh: {
    eyebrow: "MinCut · drt030.com",
    title: "找到东西如何被制造出来时的关键瓶颈。",
    lede:
      "AI compute 是完整免费的样板图谱。人形机器人、可控核聚变和 SpaceX 图谱开放结构、瓶颈判断和证据链；购买创始访问后可解锁供应商 / 股票 exposure。",
    disclaimer: "仅用于产业研究。公司和股票代码是尽调线索，不构成投资建议。",
    primaryCta: "打开 AI compute 图谱",
    secondaryCta: "预览核聚变路线",
    previewLabel: "上线样板",
    previewTitle: "AI compute 链",
    previewNodes: ["晶圆", "CoWoS", "HBM", "ABF", "电源 + 散热"],
    previewHotEyebrow: "热度 91/100",
    previewHotTitle: "先进封装",
    previewEvidenceEyebrow: "证据链可见",
    previewEvidenceTitle: "引用证据",
    previewExposureEyebrow: "准备好后开放股票 exposure",
    previewExposureTitle: "股票代码 + 证据可见",
    currentDropsEyebrow: "当前图谱",
    currentDropsTitle: "每条产业链一张可检查的路线图。",
    currentDropsBody:
      "免费样板展示完整方法。付费预览图谱展示判断和证据，创始访问解锁供应商 / 股票 exposure。",
    offerEyebrow: "创始访问",
    offerTitle: "创始访问开放付费 exposure 层。",
    offerBody:
      "购买入口可用时直接购买；也可以留下邮箱进入下一批访问名单。供应商身份、股票代码、更新和 curated exposure 会保持 gated，直到 entitlement 验证通过。",
    offerCta: "加入访问名单",
    betaEmailLabel: "工作邮箱",
    betaEmailPlaceholder: "you@fund.com",
    betaSubmit: "申请私测访问",
    trustEyebrow: "可信机制",
    trustTitle: "生成很便宜，验证不便宜。",
    trustBody: "每条 claim 都带来源强度信号。证据薄或互相冲突的内容不会进入第一优先级推荐。图谱是研究底座，不是荐股清单。",
    statusTitle: "证据强度",
    reviewedTitle: "强",
    reviewedBody: "有直接来源，并且适用范围清楚。",
    sourceCheckedTitle: "来源已核",
    sourceCheckedBody: "已重新抓取来源、确认引用与数字；尚未经 owner 人工复核。",
    unreviewedTitle: "薄",
    unreviewedBody: "可以作为研究方向，但需要更强来源后才开放 exposure。",
    disputedTitle: "冲突",
    disputedBody: "作为风险提示保留，不进入第一优先级推荐。",
    glyphTitle: "图标图例",
    bottleneck: "瓶颈",
    keyTech: "技术诀窍",
    frontier: "待继续研究",
    gateCta: "查看公开 gate 报告",
    emailEyebrow: "每周图谱",
    emailTitle: "每周一条新的产业链图谱。",
    emailBody: "接收下一次更新、来源备注和公开验证记录。不需要账号。",
    emailLabel: "邮箱",
    emailPlaceholder: "you@example.com",
    emailSubmit: "订阅",
  },
} as const;

const domainLandingCopy = {
  en: {
    "ai-compute": {
      status: "Reference map",
      detail: "Complete free demo with supplier exposure, tickers, and cited evidence.",
      cta: "Open AI compute map",
    },
    "humanoid-robotics": {
      status: "Paid exposure preview",
      detail: "Map, bottlenecks, and evidence are visible. Founding access unlocks supplier/ticker exposure.",
      cta: "Review candidate map",
    },
    "controlled-fusion": {
      status: "Paid exposure preview",
      detail: "Route logic and evidence are visible. Founding access unlocks organization exposure.",
      cta: "Review route portfolio",
    },
    "spacex-reusable-launch": {
      status: "Paid exposure preview",
      detail: "SpaceX-centered reuse map. Founding access unlocks exposure.",
      cta: "Open SpaceX reuse map",
    },
    "spacex-orbital-data-center": {
      status: "Paid exposure preview",
      detail: "Future-product map. Founding access unlocks exposure.",
      cta: "Open orbital compute map",
    },
  },
  zh: {
    "ai-compute": {
      status: "参考图谱",
      detail: "完整免费样板，包含供应商 exposure、股票代码和引用证据。",
      cta: "打开 AI compute 图谱",
    },
    "humanoid-robotics": {
      status: "付费 exposure 预览",
      detail: "图谱、瓶颈和证据可见；创始访问解锁供应商 / 股票 exposure。",
      cta: "复核候选图谱",
    },
    "controlled-fusion": {
      status: "付费 exposure 预览",
      detail: "路线逻辑和证据可见；创始访问解锁组织 exposure。",
      cta: "复核路线组合",
    },
    "spacex-reusable-launch": {
      status: "付费 exposure 预览",
      detail: "围绕 SpaceX 的复用发射图谱；创始访问解锁 exposure。",
      cta: "打开 SpaceX 复用图谱",
    },
    "spacex-orbital-data-center": {
      status: "付费 exposure 预览",
      detail: "未来产品图谱；创始访问解锁 exposure。",
      cta: "打开轨道计算图谱",
    },
  },
} as const;

export function LandingContent() {
  const { language, nodeName } = useLanguage();
  const copy = landingCopy[language];
  const domainCopy = domainLandingCopy[language];

  return (
    <div className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">{copy.eyebrow}</p>
          <h1 id="landing-title">{copy.title}</h1>
          <p className="landing-lede">{copy.lede}</p>
          <p className="landing-disclaimer">{copy.disclaimer}</p>
          <div className="button-row landing-cta-row">
            <Link href="/d/ai-compute" className="button">
              {copy.primaryCta}
            </Link>
            <Link href="/d/controlled-fusion" className="button secondary">
              {copy.secondaryCta}
            </Link>
          </div>
        </div>
        <div className="landing-map-preview" aria-label="Bottleneck map preview">
          <div className="map-preview-header">
            <span>{copy.previewLabel}</span>
            <strong>{copy.previewTitle}</strong>
          </div>
          <div className="map-preview-rail">
            <span>{copy.previewNodes[0]}</span>
            <i />
            <span>{copy.previewNodes[1]}</span>
            <i />
            <span>{copy.previewNodes[2]}</span>
            <i />
            <span>{copy.previewNodes[3]}</span>
            <i />
            <span>{copy.previewNodes[4]}</span>
          </div>
          <div className="map-preview-grid">
            <div className="map-node hot">
              <span>{copy.previewHotEyebrow}</span>
              <strong>{copy.previewHotTitle}</strong>
            </div>
            <div className="map-node">
              <span>{copy.previewEvidenceEyebrow}</span>
              <strong>{copy.previewEvidenceTitle}</strong>
            </div>
            <div className="map-node included">
              <span>{copy.previewExposureEyebrow}</span>
              <strong>{copy.previewExposureTitle}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="domains-title">
        <div className="landing-section-head">
          <p className="landing-eyebrow">{copy.currentDropsEyebrow}</p>
          <h2 id="domains-title">{copy.currentDropsTitle}</h2>
          <p className="muted">{copy.currentDropsBody}</p>
        </div>
        <div className="landing-domain-grid">
          {DOMAIN_PORTFOLIO_ENTRIES.map((domain) => {
            const localized = domainCopy[domain.slug as keyof typeof domainCopy];
            const title = domain.liveGraphRoute ? nodeName(domain.rootId, domain.title) : domain.title;
            return (
              <article className="landing-domain-card" key={domain.slug}>
                <span>{localized?.status ?? domain.statusLabel}</span>
                <h3>{title}</h3>
                <p>{localized?.detail ?? domain.detail}</p>
                <Link href={domain.href} className="landing-card-link">
                  {localized?.cta ?? domain.cta}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-offer-band" id="private-beta" aria-labelledby="offer-title">
        <div>
          <p className="landing-eyebrow">{copy.offerEyebrow}</p>
          <h2 id="offer-title">{copy.offerTitle}</h2>
          <p>{copy.offerBody}</p>
        </div>
        <form action={buttondownEndpoint} method="post" target="_blank" className="buttondown-form landing-beta-form">
          <label htmlFor="beta-email">{copy.betaEmailLabel}</label>
          <div>
            <input id="beta-email" name="email" type="email" placeholder={copy.betaEmailPlaceholder} required />
            <input type="hidden" name="embed" value="1" />
            <input type="hidden" name="metadata__source" value="private-beta" />
            <button type="submit">{copy.betaSubmit}</button>
          </div>
        </form>
      </section>

      <section className="landing-trust-grid" aria-labelledby="trust-title">
        <div className="landing-section-head">
          <p className="landing-eyebrow">{copy.trustEyebrow}</p>
          <h2 id="trust-title">{copy.trustTitle}</h2>
          <p className="muted">{copy.trustBody}</p>
        </div>
        <div className="landing-trust-panel">
          <h3>{copy.statusTitle}</h3>
          <ul className="landing-status-list">
            <li>
              <strong>{copy.reviewedTitle}</strong>
              <span>{copy.reviewedBody}</span>
            </li>
            <li>
              <strong>{copy.sourceCheckedTitle}</strong>
              <span>{copy.sourceCheckedBody}</span>
            </li>
            <li>
              <strong>{copy.unreviewedTitle}</strong>
              <span>{copy.unreviewedBody}</span>
            </li>
            <li>
              <strong>{copy.disputedTitle}</strong>
              <span>{copy.disputedBody}</span>
            </li>
          </ul>
        </div>
        <div className="landing-trust-panel">
          <h3>{copy.glyphTitle}</h3>
          <ul className="landing-glyph-list">
            <li>
              <span className="signal-glyph signal-glyph-bottleneck" aria-hidden="true">
                ⚠
              </span>
              <strong>{copy.bottleneck}</strong>
            </li>
            <li>
              <span className="signal-glyph signal-glyph-keytech" aria-hidden="true">
                🔑
              </span>
              <strong>{copy.keyTech}</strong>
            </li>
            <li>
              <span className="signal-glyph signal-glyph-frontier" aria-hidden="true">
                🔭
              </span>
              <strong>{copy.frontier}</strong>
            </li>
          </ul>
          <Link href="/gate" className="landing-card-link">
            {copy.gateCta}
          </Link>
        </div>
      </section>

      <section className="landing-email-band" id="weekly-map" aria-labelledby="email-title">
        <div>
          <p className="landing-eyebrow">{copy.emailEyebrow}</p>
          <h2 id="email-title">{copy.emailTitle}</h2>
          <p className="muted">{copy.emailBody}</p>
        </div>
        <form action={buttondownEndpoint} method="post" target="_blank" className="buttondown-form">
          <label htmlFor="bd-email">{copy.emailLabel}</label>
          <div>
            <input id="bd-email" name="email" type="email" placeholder={copy.emailPlaceholder} required />
            <input type="hidden" name="embed" value="1" />
            <button type="submit">{copy.emailSubmit}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
