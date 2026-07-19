import { activeFoundingCheckoutLink, foundingCheckoutConfigIssues, paidUnlocksEnabled } from "../src/lib/entitlements";
import { paidLaunchOptions } from "../src/lib/paidLaunchOptions";
import { loadEnvConfig } from "@next/env";
import Stripe from "stripe";

loadEnvConfig(process.cwd());

function expectedSuccessUrl(env: NodeJS.ProcessEnv): string | null {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  try {
    const siteUrl = new URL(configured);
    if (siteUrl.username || siteUrl.password || siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
      return null;
    }
    return `${siteUrl.origin}/unlock?session_id={CHECKOUT_SESSION_ID}`;
  } catch {
    return null;
  }
}

async function remoteStripeIssues(env: NodeJS.ProcessEnv): Promise<string[]> {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const priceId = env.STRIPE_PRICE_FOUNDING?.trim() ?? "";
  const checkoutUrl = env.NEXT_PUBLIC_STRIPE_LINK_FOUNDING?.trim() ?? "";
  const issues: string[] = [];
  const stripe = new Stripe(secretKey);

  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) issues.push("Stripe founding price must be active");
    if (price.currency.toLowerCase() !== "usd") issues.push("Stripe founding price must use USD");
    if (price.unit_amount !== 900) issues.push("Stripe founding price must be exactly USD $9.00");
    if (price.recurring) issues.push("Stripe founding price must be one-time, not recurring");
    const keyIsLive = /^(?:sk|rk)_live_/.test(secretKey);
    if (price.livemode !== keyIsLive) {
      issues.push("Stripe founding price mode does not match STRIPE_SECRET_KEY");
    }
  } catch (error) {
    issues.push(`Could not retrieve Stripe founding price: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  try {
    let paymentLink: Stripe.PaymentLink | undefined;
    for await (const candidate of stripe.paymentLinks.list({ limit: 100 })) {
      if (candidate.url === checkoutUrl) {
        paymentLink = candidate;
        break;
      }
    }
    if (!paymentLink) {
      issues.push("Configured Stripe Payment Link was not found in this Stripe account");
      return issues;
    }
    if (!paymentLink.active) issues.push("Configured Stripe Payment Link must be active");

    const lineItems = await stripe.paymentLinks.listLineItems(paymentLink.id, { limit: 100 });
    const linkedPriceIds = lineItems.data
      .map((item) => typeof item.price === "string" ? item.price : item.price?.id)
      .filter((id): id is string => Boolean(id));
    if (linkedPriceIds.length !== 1 || linkedPriceIds[0] !== priceId) {
      issues.push("Configured Stripe Payment Link must contain exactly STRIPE_PRICE_FOUNDING");
    }

    const expected = expectedSuccessUrl(env);
    const completion = paymentLink.after_completion;
    if (!expected || completion.type !== "redirect" || completion.redirect?.url !== expected) {
      issues.push(`Stripe Payment Link success redirect must be ${expected ?? "<NEXT_PUBLIC_SITE_URL>/unlock?session_id={CHECKOUT_SESSION_ID}"}`);
    }
  } catch (error) {
    issues.push(`Could not verify Stripe Payment Link: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  return issues;
}

async function main() {
  const options = paidLaunchOptions(process.argv.slice(2), process.env);
  if (!paidUnlocksEnabled()) {
    if (options.requireEnabled) {
      console.error("Paid launch preflight failed:\n- ENABLE_PAID_UNLOCKS must be 1 for a paid release");
      process.exit(1);
    }
    console.log("Paid launch preflight: checkout disabled (safe mode).");
    return;
  }

  const validationEnv = options.requireLive
    ? { ...process.env, VERCEL_ENV: "production" }
    : process.env;
  const issues = foundingCheckoutConfigIssues(validationEnv);
  if (!activeFoundingCheckoutLink(validationEnv)) {
    issues.push("Founding checkout is not active");
  }
  if (options.verifyStripe && issues.length === 0) {
    issues.push(...await remoteStripeIssues(validationEnv));
  }

  if (issues.length === 0) {
    console.log(
      options.verifyStripe
        ? "Paid launch preflight: local configuration and Stripe $9 delivery path verified."
        : "Paid launch preflight: checkout, delivery, and support configuration present.",
    );
    return;
  }

  console.error("Paid launch preflight failed:");
  for (const issue of [...new Set(issues)]) console.error(`- ${issue}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(`Paid launch preflight failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
