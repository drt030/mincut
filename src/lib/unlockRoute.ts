import { NextResponse } from "next/server";
import { ENTITLEMENT_COOKIE, grantCookieValue, readEntitlements } from "./entitlements";

export type UnlockCheckoutSession = {
  payment_status?: string | null;
  line_items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
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

// Post-purchase destination per Decision 4: one route per domain under
// /d/[slug]; founding all-access uses a neutral waitlist destination because
// AI compute is now a free flagship demo, not a paid exposure unlock.
export const PRICE_UNLOCKS: PriceUnlock[] = [
  { envKey: "STRIPE_PRICE_FOUNDING", entitlement: "all", destination: "/?purchase=founding&waitlist=1" },
];

// Disabled price ids are recognized only to fail safe: they never grant
// entitlements. Future domain-specific routes stay disabled until the domain
// route, data, review state, and Stripe target are all ready together.
const DISABLED_LEGACY_PRICE_REDIRECTS: DisabledPriceRedirect[] = [
  { envKey: "STRIPE_PRICE_HUMANOID", destination: "/?purchase=domain-pending&waitlist=1" },
  { envKey: "STRIPE_PRICE_POWER", destination: "/?purchase=domain-pending&waitlist=1" },
  { envKey: "STRIPE_PRICE_AI_COMPUTE", destination: "/d/ai-compute?free=1" },
];

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
    const configuredPriceId = env[envKey];
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

    const stripeSecretKey = env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) return NextResponse.redirect(new URL("/?purchase=config-missing", url.origin));

    const session = await retrieveCheckoutSession(sessionId, stripeSecretKey);
    if (session.payment_status !== "paid") {
      return NextResponse.redirect(new URL("/?purchase=incomplete", url.origin));
    }

    const priceId = session.line_items?.data?.[0]?.price?.id ?? "";
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
