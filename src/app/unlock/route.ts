import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ENTITLEMENT_COOKIE, grantCookieValue, readEntitlements } from "@/lib/entitlements";

const PRICE_ENV_TO_ENTITLEMENT: [string, string][] = [
  ["STRIPE_PRICE_AI_COMPUTE", "ai_compute"],
  ["STRIPE_PRICE_HUMANOID", "humanoid"],
  ["STRIPE_PRICE_POWER", "power"],
  ["STRIPE_PRICE_FOUNDING", "all"],
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
  const entitlement = PRICE_ENV_TO_ENTITLEMENT.find(([env]) => process.env[env] === priceId)?.[1];
  if (!entitlement) return NextResponse.redirect(new URL("/?purchase=unknown", url.origin));

  const existing = request.headers.get("cookie")?.match(new RegExp(`${ENTITLEMENT_COOKIE}=([^;]+)`))?.[1];
  const value = await grantCookieValue(entitlement, await readEntitlements(existing));
  const res = NextResponse.redirect(new URL("/graph?unlocked=1", url.origin));
  res.headers.append(
    "Set-Cookie",
    `${ENTITLEMENT_COOKIE}=${value}; Path=/; Max-Age=34560000; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
