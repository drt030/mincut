"use client";

import Link from "next/link";
import { DOMAIN_PORTFOLIO_ENTRIES } from "@/lib/domains";
import { useLanguage } from "./LanguageProvider";

const buttondownEndpoint = "https://buttondown.com/api/emails/embed-subscribe/drt030";

const landingCopy = {
  en: {
    eyebrow: "Capability Graph Explorer · drt030.com",
    title: "Find the chokepoint before the market does.",
    lede:
      "AI compute is the full free demo. Humanoid robotics and controlled fusion are paid-candidate previews: the map, bottleneck thesis, and evidence trail are visible, while supplier/ticker exposure stays locked until audit and access gates pass. SpaceX reusable launch and orbital data centers are research previews only.",
    disclaimer: "Industrial research only. Company and ticker context supports diligence; it is not investment advice.",
    primaryCta: "Open the AI compute map",
    secondaryCta: "Preview fusion routes",
    previewLabel: "Launch map",
    previewTitle: "AI compute chain",
    previewNodes: ["Wafer", "CoWoS", "HBM", "ABF", "Power + cooling"],
    previewHotEyebrow: "Heat 91/100",
    previewHotTitle: "Advanced packaging",
    previewEvidenceEyebrow: "Review states visible",
    previewEvidenceTitle: "Cited evidence",
    previewExposureEyebrow: "Reviewed only when human-checked",
    previewExposureTitle: "Tickers + evidence visible",
    currentDropsEyebrow: "Current drops",
    currentDropsTitle: "One route per chain, one map you can inspect.",
    currentDropsBody:
      "Free demos show the full method. Paid candidates show the research map before the exposure layer is promoted. SpaceX maps stay in research preview until evidence quality and access gates pass.",
    offerEyebrow: "Private beta",
    offerTitle: "Paid domains open only after audit and access gates pass.",
    offerBody:
      "Join the waitlist for future paid access. No checkout is live in this preview; supplier identities, tickers, updates, and curated exposure stay locked until the commercial gate is verified.",
    offerCta: "Join the waitlist",
    betaEmailLabel: "Work email",
    betaEmailPlaceholder: "you@fund.com",
    betaSubmit: "Request beta access",
    trustEyebrow: "Trust model",
    trustTitle: "Generation is cheap now. Verification is not.",
    trustBody:
      "Claims carry review states. Disputed ranks below unreviewed. The graph is a research substrate, not a stock tip sheet.",
    statusTitle: "Review status ladder",
    reviewedTitle: "Reviewed",
    reviewedBody: "Human-checked claim with supporting evidence.",
    unreviewedTitle: "Unreviewed",
    unreviewedBody: "Agent or placeholder material pending review.",
    disputedTitle: "Disputed",
    disputedBody: "Visible, downgraded, and treated more cautiously than unreviewed.",
    glyphTitle: "Glyph legend",
    bottleneck: "Bottleneck",
    keyTech: "Key technology",
    frontier: "Frontier to research",
    gateCta: "View public gate reports",
    emailEyebrow: "Weekly map",
    emailTitle: "One new chain map per week.",
    emailBody: "Get the next drop, review notes, and the public validation trail. No account is required.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    emailSubmit: "Subscribe",
  },
  zh: {
    eyebrow: "能力图谱探索器 · drt030.com",
    title: "在市场之前找到卡点。",
    lede:
      "AI compute 是完整免费的样板图谱。人形机器人和可控核聚变是付费候选预览：产品图谱、瓶颈判断和证据链可见，供应商/股票 exposure 会在审计和访问 gate 通过前保持锁定。SpaceX 可回收发射和太空数据中心目前只作为研究预览。",
    disclaimer: "仅用于产业研究。公司和股票代码是尽调线索，不构成投资建议。",
    primaryCta: "打开 AI compute 图谱",
    secondaryCta: "预览核聚变路线",
    previewLabel: "上线样板",
    previewTitle: "AI compute 链",
    previewNodes: ["晶圆", "CoWoS", "HBM", "ABF", "电源 + 散热"],
    previewHotEyebrow: "热度 91/100",
    previewHotTitle: "先进封装",
    previewEvidenceEyebrow: "证据状态可见",
    previewEvidenceTitle: "引用证据",
    previewExposureEyebrow: "人工复审后才展示",
    previewExposureTitle: "股票代码 + 证据可见",
    currentDropsEyebrow: "当前图谱",
    currentDropsTitle: "每条产业链一张可检查的路线图。",
    currentDropsBody:
      "免费样板展示完整方法。付费候选先展示研究图谱，exposure 层通过商业 gate 后再开放。SpaceX 图谱在证据质量和访问 gate 通过前保持研究预览。",
    offerEyebrow: "私测候补",
    offerTitle: "付费领域必须通过审计和访问 gate 后再开放。",
    offerBody:
      "加入未来付费访问候补。本地预览不提供 checkout；供应商身份、股票代码、更新和 curated exposure 会保持锁定，直到商业 gate 验证完成。",
    offerCta: "加入候补名单",
    betaEmailLabel: "工作邮箱",
    betaEmailPlaceholder: "you@fund.com",
    betaSubmit: "申请私测访问",
    trustEyebrow: "可信机制",
    trustTitle: "生成很便宜，验证不便宜。",
    trustBody: "每条 claim 都带复审状态。disputed 低于 unreviewed。图谱是研究底座，不是荐股清单。",
    statusTitle: "复审状态",
    reviewedTitle: "已复审",
    reviewedBody: "人工检查过，并带支持证据。",
    unreviewedTitle: "未复审",
    unreviewedBody: "Agent 或占位材料，等待复审。",
    disputedTitle: "有争议",
    disputedBody: "继续可见，但降权，并比未复审内容更谨慎处理。",
    glyphTitle: "图标图例",
    bottleneck: "瓶颈",
    keyTech: "技术诀窍",
    frontier: "待继续研究",
    gateCta: "查看公开 gate 报告",
    emailEyebrow: "每周图谱",
    emailTitle: "每周一条新的产业链图谱。",
    emailBody: "接收下一次更新、复审备注和公开验证记录。不需要账号。",
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
    "parcel-robot": {
      status: "Depth reference",
      detail: "Second free reference for inspecting a deeper product chain and validation workflow.",
      cta: "Open parcel map",
    },
    "humanoid-robotics": {
      status: "Paid candidate preview",
      detail: "Map, bottlenecks, and evidence are visible. Supplier/ticker exposure waits for private beta access.",
      cta: "Open candidate map",
    },
    "controlled-fusion": {
      status: "Paid candidate preview",
      detail: "Route logic and evidence are visible. Organization exposure stays locked until audit and access gates pass.",
      cta: "Open route portfolio",
    },
    "spacex-reusable-launch": {
      status: "Research preview",
      detail: "SpaceX-centered reuse map. Exposure is not sold or scored for paid use yet.",
      cta: "Open SpaceX reuse map",
    },
    "spacex-orbital-data-center": {
      status: "Research preview",
      detail: "Future-product research map. Exposure stays locked until evidence review passes.",
      cta: "Open orbital compute map",
    },
  },
  zh: {
    "ai-compute": {
      status: "参考图谱",
      detail: "完整免费样板，包含供应商 exposure、股票代码和引用证据。",
      cta: "打开 AI compute 图谱",
    },
    "parcel-robot": {
      status: "深度参考",
      detail: "第二个免费参考图谱，用来检查更深的产品链和验证流程。",
      cta: "打开包裹分拣图谱",
    },
    "humanoid-robotics": {
      status: "付费候选预览",
      detail: "图谱、瓶颈和证据可见；供应商/股票 exposure 等待私测访问开放。",
      cta: "打开候选图谱",
    },
    "controlled-fusion": {
      status: "付费候选预览",
      detail: "路线逻辑和证据可见；组织 exposure 在审计和访问 gate 通过前保持锁定。",
      cta: "打开路线组合",
    },
    "spacex-reusable-launch": {
      status: "研究预览",
      detail: "围绕 SpaceX 的复用发射图谱；目前不销售 exposure，也不进入付费评分。",
      cta: "打开 SpaceX 复用图谱",
    },
    "spacex-orbital-data-center": {
      status: "研究预览",
      detail: "未来产品研究图谱；exposure 在证据复审通过前保持锁定。",
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
