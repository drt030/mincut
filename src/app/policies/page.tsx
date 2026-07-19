import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { activeSupportEmail } from "@/lib/supportContact";

const supportEmail = activeSupportEmail();

export const metadata: Metadata = {
  title: "Purchase, refund, and privacy policy",
  description: "MinCut purchase terms, refund policy, access recovery, privacy summary, and research disclaimer.",
  alternates: {
    canonical: "/policies",
  },
};

export default function PoliciesPage() {
  return (
    <div className="page">
      <article className="panel" style={{ margin: "0 auto", maxWidth: 860 }}>
        <header>
          <p className="muted">Last updated July 18, 2026 · 更新于 2026 年 7 月 18 日</p>
          <h1>Purchase, refund, support, and privacy</h1>
          <p>购买、退款、访问支持与隐私说明</p>
        </header>

        <section lang="en">
          <h2>The $9 purchase</h2>
          <p>
            USD $9 is a one-time payment for the current company/ticker diligence layer in the collection below. It
            is not a subscription and does not renew automatically. Future maps, additions, and a fixed update
            schedule are not promised.
          </p>
          <ul>
            <li>Humanoid robotics — core map.</li>
            <li>SpaceX reusable launch — core map.</li>
            <li>Controlled fusion — early-research add-on with three currently modeled public-market candidates.</li>
            <li>
              SpaceX orbital data center — hypothesis-map add-on; companies are capability candidates, not confirmed
              suppliers.
            </li>
          </ul>
          <p>AI compute remains fully free and is not something this purchase charges for.</p>

          <h2>Seven-day refund</h2>
          <p>
            You may request a refund within seven calendar days of payment. Contact us from the address used at
            checkout and include the Stripe receipt or payment reference. We process approved refunds through the
            original payment method.
          </p>

          <h2>Access and recovery</h2>
          <p>
            Access is stored in a signed cookie in your browser. Clearing cookies or changing browsers or devices may
            remove that local access. Send us the Stripe receipt or payment reference and we will restore access
            manually.
          </p>

          <h2>Contact</h2>
          {supportEmail ? (
            <p>
              Refund and access support: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          ) : (
            <p>Paid checkout remains closed until a verified support address is published here.</p>
          )}

          <h2>Privacy</h2>
          <p>
            Stripe processes card details under its own privacy terms; MinCut does not store raw card numbers. We may
            receive the checkout email, payment reference, payment status, and refund status needed to deliver and
            support access. The site also uses basic page and product-event analytics to understand which research is
            useful. We do not sell personal information. Contact us to ask about or request deletion of support data,
            subject to payment, fraud-prevention, tax, and legal retention requirements.
          </p>

          <h2>Research disclaimer</h2>
          <p>
            MinCut is an educational and analytical research tool, not investment advice. Company and ticker entries
            are diligence leads, not recommendations to buy, sell, or hold a security. Research can be incomplete,
            uncertain, or out of date. Verify claims and sources independently before making a decision.
          </p>
        </section>

        <hr />

        <section lang="zh-CN">
          <h2>9 美元一次性购买</h2>
          <p>
            9 美元为一次性付款，解锁下列当前合集中的公司／股票尽调线索层。这不是订阅，不会自动续费；
            我们不承诺未来新增地图或固定更新频率。
          </p>
          <ul>
            <li>人形机器人——核心地图。</li>
            <li>SpaceX 可复用发射——核心地图。</li>
            <li>可控核聚变——早期研究附加地图，当前建模了三个公开市场候选。</li>
            <li>SpaceX 轨道数据中心——假设性附加地图；公司是能力候选，不是已确认供应商。</li>
          </ul>
          <p>AI 算力地图继续完整免费，本次购买不对这张免费地图收费。</p>

          <h2>七天退款</h2>
          <p>
            付款后七个自然日内可以申请退款。请使用结账邮箱联系我们，并附上 Stripe 收据或付款编号。
            符合条件的退款将原路退回。
          </p>

          <h2>访问与恢复</h2>
          <p>
            访问权限保存在当前浏览器的签名 Cookie 中。清除 Cookie、更换浏览器或设备后，本地访问状态可能消失。
            请将 Stripe 收据或付款编号发送给我们，我们会人工恢复访问。
          </p>

          <h2>联系</h2>
          {supportEmail ? (
            <p>
              退款及访问支持：<a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          ) : (
            <p>在公布并验证可用的支持邮箱前，付费结账将保持关闭。</p>
          )}

          <h2>隐私</h2>
          <p>
            银行卡信息由 Stripe 按其隐私条款处理，MinCut 不保存完整卡号。为交付、恢复访问和退款，我们可能接收结账邮箱、
            付款编号、付款状态及退款状态。网站也会使用基本页面和产品事件分析，以判断哪些研究内容有价值。
            我们不会出售个人信息。如需查询或删除支持数据，请联系我们；付款、反欺诈、税务或法律留存义务除外。
          </p>

          <h2>研究声明</h2>
          <p>
            MinCut 是教育与分析研究工具，不构成任何投资建议。公司及股票条目只是尽调线索，不是买入、卖出或持有建议。
            研究可能不完整、存在不确定性或已经过时；作出决定前请独立核验相关事实与来源。
          </p>
        </section>

        <div className="button-row">
          <Link className="button secondary" href="/">
            Back to MinCut · 返回 MinCut
          </Link>
        </div>
      </article>
    </div>
  );
}
