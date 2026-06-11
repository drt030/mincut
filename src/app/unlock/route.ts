import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ENTITLEMENT_COOKIE, grantCookieValue, readEntitlements } from "@/lib/entitlements";

// Post-purchase destination per Decision 4: one route per domain under
// /d/[slug]; founding all-access lands on the flagship chain.
const PRICE_ENV_TO_ENTITLEMENT: [string, string, string][] = [
  ["STRIPE_PRICE_AI_COMPUTE", "ai_compute", "/d/ai-compute"],
  ["STRIPE_PRICE_HUMANOID", "humanoid", "/d/humanoid-actuators"],
  ["STRIPE_PRICE_POWER", "power", "/d/dc-power"],
  ["STRIPE_PRICE_FOUNDING", "all", "/d/ai-compute"],
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return NextResponse.redirect(new URL("/", url.origin));

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  if (session.payment_status !== "paid") {
    return NextResponse.redirect(new URL("/?purchase=incomplete", url.origin));
  }

  const priceId = session.line_items?.data[0]?.price?.id ?? "";
  const match = PRICE_ENV_TO_ENTITLEMENT.find(([env]) => process.env[env] === priceId);
  if (!match) return NextResponse.redirect(new URL("/?purchase=unknown", url.origin));
  const [, entitlement, destination] = match;

  const existing = request.headers.get("cookie")?.match(new RegExp(`${ENTITLEMENT_COOKIE}=([^;]+)`))?.[1];
  const value = await grantCookieValue(entitlement, await readEntitlements(existing));
  const res = NextResponse.redirect(new URL(`${destination}?unlocked=1`, url.origin));
  res.headers.append(
    "Set-Cookie",
    `${ENTITLEMENT_COOKIE}=${value}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
