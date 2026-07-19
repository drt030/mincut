import { SignJWT, jwtVerify } from "jose";
import { activeSupportEmail } from "./supportContact";

export const ENTITLEMENT_COOKIE = "cge_ent";
export const PAID_UNLOCKS_ENABLED_ENV = "ENABLE_PAID_UNLOCKS";
export const FOUNDING_CHECKOUT_LINK_ENV = "NEXT_PUBLIC_STRIPE_LINK_FOUNDING";

type EntitlementEnv = Record<string, string | undefined>;

export function paidUnlocksEnabled(env: EntitlementEnv = process.env): boolean {
  return env[PAID_UNLOCKS_ENABLED_ENV] === "1";
}

export function foundingCheckoutConfigIssues(env: EntitlementEnv = process.env): string[] {
  if (!paidUnlocksEnabled(env)) return [];

  const issues: string[] = [];
  const stripeKey = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const priceId = env.STRIPE_PRICE_FOUNDING?.trim() ?? "";
  const entitlementSecret = env.ENTITLEMENT_SECRET?.trim() ?? "";
  const link = env[FOUNDING_CHECKOUT_LINK_ENV]?.trim() ?? "";

  if (!stripeKey) issues.push("STRIPE_SECRET_KEY is missing");
  if (!priceId.startsWith("price_")) issues.push("STRIPE_PRICE_FOUNDING must be a Stripe price id");
  if (entitlementSecret.length < 32) issues.push("ENTITLEMENT_SECRET must contain at least 32 characters");
  try {
    if (!activeSupportEmail(env)) issues.push("SUPPORT_EMAIL is missing");
  } catch (error) {
    issues.push(error instanceof Error ? error.message : "SUPPORT_EMAIL is invalid");
  }

  let checkoutUrl: URL | null = null;
  try {
    checkoutUrl = new URL(link);
    if (checkoutUrl.protocol !== "https:") issues.push("NEXT_PUBLIC_STRIPE_LINK_FOUNDING must use HTTPS");
  } catch {
    issues.push("NEXT_PUBLIC_STRIPE_LINK_FOUNDING must be a valid URL");
  }

  if (env.VERCEL_ENV === "production") {
    if (!/^(?:sk|rk)_live_/.test(stripeKey)) issues.push("STRIPE_SECRET_KEY must be live mode in production");
    if (checkoutUrl && (checkoutUrl.hostname !== "buy.stripe.com" || checkoutUrl.pathname.startsWith("/test_"))) {
      issues.push("NEXT_PUBLIC_STRIPE_LINK_FOUNDING must be a live Stripe Payment Link in production");
    }

    try {
      const configuredSiteUrl = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
      const siteUrl = new URL(configuredSiteUrl);
      if (
        siteUrl.protocol !== "https:" ||
        siteUrl.hostname === "localhost" ||
        siteUrl.username ||
        siteUrl.password ||
        siteUrl.pathname !== "/" ||
        siteUrl.search ||
        siteUrl.hash ||
        configuredSiteUrl.replace(/\/$/, "") !== siteUrl.origin
      ) {
        issues.push("NEXT_PUBLIC_SITE_URL must be the HTTPS production origin");
      }
    } catch {
      issues.push("NEXT_PUBLIC_SITE_URL must be the HTTPS production origin");
    }
  }

  return [...new Set(issues)];
}

export function activeFoundingCheckoutLink(env: EntitlementEnv = process.env): string | null {
  if (!paidUnlocksEnabled(env) || foundingCheckoutConfigIssues(env).length > 0) return null;
  const link = env[FOUNDING_CHECKOUT_LINK_ENV]?.trim();
  if (!link) return null;

  try {
    const url = new URL(link);
    if (url.protocol !== "https:") return null;
    return link;
  } catch {
    return null;
  }
}

function secret(): Uint8Array | null {
  const value = process.env.ENTITLEMENT_SECRET;
  if (!value) return null;
  return new TextEncoder().encode(value);
}

export async function grantCookieValue(entitlement: string, existing: string[]): Promise<string> {
  const signingSecret = secret();
  if (!signingSecret) {
    throw new Error("ENTITLEMENT_SECRET is required to grant entitlements");
  }

  const list = [...new Set([...existing, entitlement])];
  return new SignJWT({ e: list })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("400d")
    .sign(signingSecret);
}

export async function readEntitlements(cookieValue: string | undefined): Promise<string[]> {
  if (!cookieValue) return [];
  const verificationSecret = secret();
  if (!verificationSecret) return [];

  try {
    const { payload } = await jwtVerify(cookieValue, verificationSecret);
    return Array.isArray(payload.e) ? (payload.e as string[]) : [];
  } catch {
    return [];
  }
}

export async function readActiveEntitlements(
  cookieValue: string | undefined,
  env: EntitlementEnv = process.env,
): Promise<string[]> {
  if (!paidUnlocksEnabled(env)) return [];
  return readEntitlements(cookieValue);
}
