import { NextResponse } from "next/server";
import {
  ENTITLEMENT_COOKIE,
  foundingCheckoutConfigIssues,
  grantCookieValue,
  paidUnlocksEnabled,
  readEntitlements,
} from "./entitlements";

export type UnlockCheckoutSession = {
  payment_status?: string | null;
  status?: string | null;
  mode?: string | null;
  currency?: string | null;
  amount_total?: number | null;
  line_items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
      quantity?: number | null;
    } | null>;
  } | null;
};

export type PriceUnlock = {
  envKey: string;
  entitlement: string;
  destination: string;
};

type DisabledPriceRedirect = {
  envKey: string;
  destination: string;
};

export type UnlockRouteEnv = Record<string, string | undefined>;

export type RetrieveCheckoutSession = (sessionId: string, secretKey: string) => Promise<UnlockCheckoutSession>;

export type UnlockRouteDependencies = {
  env: UnlockRouteEnv;
  retrieveCheckoutSession: RetrieveCheckoutSession;
};

// The sole live SKU grants the global entitlement, then returns to the landing
// page's explicit all-access success state. It must never fall through to the
// waitlist path after Stripe has verified a paid session.
export const PRICE_UNLOCKS: PriceUnlock[] = [
  { envKey: "STRIPE_PRICE_FOUNDING", entitlement: "all", destination: "/?purchase=success&access=all" },
];

// Disabled price ids are recognized only to fail safe: they never grant
// entitlements. Future domain-specific routes stay disabled until the domain
// route, data, review state, and Stripe target are all ready together.
const DISABLED_LEGACY_PRICE_REDIRECTS: DisabledPriceRedirect[] = [
  { envKey: "STRIPE_PRICE_HUMANOID", destination: "/?purchase=domain-pending&waitlist=1" },
  { envKey: "STRIPE_PRICE_POWER", destination: "/?purchase=domain-pending&waitlist=1" },
  { envKey: "STRIPE_PRICE_AI_COMPUTE", destination: "/d/ai-compute?free=1" },
];

const FOUNDING_PRICE_CENTS = 900;

function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = `${name}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie?.slice(prefix.length);
}

function priceUnlockFor(priceId: string, env: UnlockRouteEnv): PriceUnlock | undefined {
  return PRICE_UNLOCKS.find(({ envKey }) => {
    const configuredPriceId = env[envKey]?.trim();
    return Boolean(configuredPriceId) && configuredPriceId === priceId;
  });
}

function disabledLegacyDestinationFor(priceId: string, env: UnlockRouteEnv): string | undefined {
  return DISABLED_LEGACY_PRICE_REDIRECTS.find(({ envKey }) => {
    const configuredPriceId = env[envKey];
    return Boolean(configuredPriceId) && configuredPriceId === priceId;
  })?.destination;
}

function redirectUrl(destination: string, origin: string, params?: Record<string, string>): URL {
  const redirect = new URL(destination, origin);
  Object.entries(params ?? {}).forEach(([key, value]) => redirect.searchParams.set(key, value));
  return redirect;
}

export function createUnlockGET({ env, retrieveCheckoutSession }: UnlockRouteDependencies) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return NextResponse.redirect(new URL("/", url.origin));
    if (!paidUnlocksEnabled(env)) {
      return NextResponse.redirect(redirectUrl("/?purchase=disabled&waitlist=1", url.origin));
    }
    if (foundingCheckoutConfigIssues(env).length > 0) {
      return NextResponse.redirect(new URL("/?purchase=config-missing", url.origin));
    }

    const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey) return NextResponse.redirect(new URL("/?purchase=config-missing", url.origin));

    let session: UnlockCheckoutSession;
    try {
      session = await retrieveCheckoutSession(sessionId, stripeSecretKey);
    } catch {
      // A transient Stripe/API failure must not leave a paid customer on a 500.
      // The original success URL can be retried because Stripe remains the
      // source of truth and a verified session is intentionally replay-safe.
      return NextResponse.redirect(new URL("/?purchase=verification-unavailable", url.origin));
    }
    if (session.payment_status !== "paid") {
      return NextResponse.redirect(new URL("/?purchase=incomplete", url.origin));
    }

    const lineItems = session.line_items?.data ?? [];
    const lineItem = lineItems[0];
    if (
      session.status !== "complete" ||
      session.mode !== "payment" ||
      session.currency !== "usd" ||
      session.amount_total !== FOUNDING_PRICE_CENTS ||
      lineItems.length !== 1 ||
      lineItem?.quantity !== 1
    ) {
      return NextResponse.redirect(new URL("/?purchase=unknown", url.origin));
    }

    const priceId = lineItem.price?.id ?? "";
    const disabledLegacyDestination = disabledLegacyDestinationFor(priceId, env);
    if (disabledLegacyDestination) {
      return NextResponse.redirect(redirectUrl(disabledLegacyDestination, url.origin));
    }

    const unlock = priceUnlockFor(priceId, env);
    if (!unlock) return NextResponse.redirect(new URL("/?purchase=unknown", url.origin));

    const existing = cookieValue(request.headers.get("cookie"), ENTITLEMENT_COOKIE);
    let value: string;
    try {
      value = await grantCookieValue(unlock.entitlement, await readEntitlements(existing));
    } catch {
      return NextResponse.redirect(new URL("/?purchase=config-missing", url.origin));
    }

    const res = NextResponse.redirect(redirectUrl(unlock.destination, url.origin, { unlocked: "1" }));
    res.headers.append(
      "Set-Cookie",
      `${ENTITLEMENT_COOKIE}=${value}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`,
    );
    return res;
  };
}
