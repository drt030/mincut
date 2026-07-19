import test from "node:test";
import assert from "node:assert/strict";
import {
  activeFoundingCheckoutLink,
  foundingCheckoutConfigIssues,
  grantCookieValue,
  paidUnlocksEnabled,
  readActiveEntitlements,
  readEntitlements,
} from "../src/lib/entitlements";

const checkoutEnv = {
  ENABLE_PAID_UNLOCKS: "1",
  ENTITLEMENT_SECRET: "a-secure-entitlement-secret-over-32-characters",
  STRIPE_SECRET_KEY: "sk_test_checkout",
  STRIPE_PRICE_FOUNDING: "price_founding",
  NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "https://buy.stripe.com/test_example",
  SUPPORT_EMAIL: "support@example.com",
};

test("entitlement cookie round-trips and merges", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  const v1 = await grantCookieValue("ai_compute", []);
  assert.deepEqual(await readEntitlements(v1), ["ai_compute"]);
  const v2 = await grantCookieValue("all", await readEntitlements(v1));
  assert.deepEqual((await readEntitlements(v2)).sort(), ["ai_compute", "all"]);
});

test("tampered cookie reads as empty", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  assert.deepEqual(await readEntitlements("garbage.token.here"), []);
});

test("active entitlements ignore valid cookies until paid unlocks are enabled", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  const value = await grantCookieValue("all", []);

  assert.deepEqual(await readActiveEntitlements(value, {}), []);
  assert.deepEqual(await readActiveEntitlements(value, { ENABLE_PAID_UNLOCKS: "1" }), ["all"]);
});

test("only the server-side ENABLE_PAID_UNLOCKS contract enables paid access", () => {
  assert.equal(paidUnlocksEnabled({ NEXT_PUBLIC_ENABLE_PAID_CHECKOUT: "1" }), false);
  assert.equal(paidUnlocksEnabled({ ENABLE_PAID_UNLOCKS: "true" }), false);
  assert.equal(paidUnlocksEnabled({ ENABLE_PAID_UNLOCKS: "1" }), true);
});

test("founding checkout link is exposed only when paid unlocks are enabled", () => {
  assert.equal(
    activeFoundingCheckoutLink({
      NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "https://buy.example/founding",
    }),
    null,
  );
  assert.equal(
    activeFoundingCheckoutLink(checkoutEnv),
    checkoutEnv.NEXT_PUBLIC_STRIPE_LINK_FOUNDING,
  );
  assert.equal(activeFoundingCheckoutLink({ ENABLE_PAID_UNLOCKS: "1" }), null);
});

test("production founding checkout rejects test-mode or non-Stripe links", () => {
  assert.equal(
    activeFoundingCheckoutLink({
      ...checkoutEnv,
      STRIPE_SECRET_KEY: "sk_live_checkout",
      NEXT_PUBLIC_SITE_URL: "https://drt030.com",
      VERCEL_ENV: "production",
    }),
    null,
  );
  assert.equal(
    activeFoundingCheckoutLink({
      ...checkoutEnv,
      STRIPE_SECRET_KEY: "sk_live_checkout",
      NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "https://example.com/founding",
      NEXT_PUBLIC_SITE_URL: "https://drt030.com",
      VERCEL_ENV: "production",
    }),
    null,
  );
  assert.equal(
    activeFoundingCheckoutLink({
      ...checkoutEnv,
      STRIPE_SECRET_KEY: "rk_live_checkout",
      NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "https://buy.stripe.com/live_example",
      NEXT_PUBLIC_SITE_URL: "https://drt030.com",
      VERCEL_ENV: "production",
    }),
    "https://buy.stripe.com/live_example",
  );
});

test("production site URL must be a bare HTTPS origin", () => {
  const liveEnv = {
    ...checkoutEnv,
    STRIPE_SECRET_KEY: "sk_live_checkout",
    NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "https://buy.stripe.com/live_example",
    VERCEL_ENV: "production",
  };

  for (const invalidSiteUrl of [
    "http://drt030.com",
    "https://localhost:3000",
    "https://drt030.com/app",
    "https://drt030.com?preview=1",
    "https://drt030.com/#launch",
  ]) {
    assert.equal(
      activeFoundingCheckoutLink({ ...liveEnv, NEXT_PUBLIC_SITE_URL: invalidSiteUrl }),
      null,
      `${invalidSiteUrl} must not be accepted as the production origin`,
    );
  }
});

test("checkout stays hidden until every delivery and support dependency is configured", () => {
  const requirements = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_FOUNDING",
    "ENTITLEMENT_SECRET",
    "NEXT_PUBLIC_STRIPE_LINK_FOUNDING",
    "SUPPORT_EMAIL",
  ] as const;

  for (const key of requirements) {
    const incomplete = { ...checkoutEnv, [key]: undefined };
    assert.equal(activeFoundingCheckoutLink(incomplete), null, `${key} must fail closed`);
    assert.ok(foundingCheckoutConfigIssues(incomplete).length > 0, `${key} must report a configuration issue`);
  }
});

test("missing entitlement secret fails closed when reading an existing cookie", async () => {
  process.env.ENTITLEMENT_SECRET = "test-secret";
  const value = await grantCookieValue("all", []);

  delete process.env.ENTITLEMENT_SECRET;

  assert.deepEqual(await readEntitlements(value), []);
});

test("missing entitlement secret rejects grant attempts", async () => {
  delete process.env.ENTITLEMENT_SECRET;

  await assert.rejects(() => grantCookieValue("all", []), /ENTITLEMENT_SECRET/);
});
