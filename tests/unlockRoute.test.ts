import test from "node:test";
import assert from "node:assert/strict";
import { ENTITLEMENT_COOKIE, grantCookieValue, readEntitlements } from "../src/lib/entitlements";
import { PRICE_UNLOCKS, createUnlockGET, type UnlockCheckoutSession } from "../src/lib/unlockRoute";

const env = {
  STRIPE_SECRET_KEY: "sk_test_unlock",
  STRIPE_PRICE_HUMANOID: "price_humanoid",
  STRIPE_PRICE_POWER: "price_power",
  STRIPE_PRICE_FOUNDING: "price_founding",
};

const DISABLED_LEGACY_AI_PRICE_ENV_KEY = "STRIPE_PRICE_AI_COMPUTE";
const disabledLegacyAiEnv = {
  ...env,
  [DISABLED_LEGACY_AI_PRICE_ENV_KEY]: "price_disabled_legacy_ai",
};

process.env.ENTITLEMENT_SECRET = "unlock-route-test-secret";

function paidSession(priceId: string, paymentStatus = "paid"): UnlockCheckoutSession {
  return {
    payment_status: paymentStatus,
    line_items: {
      data: [{ price: { id: priceId } }],
    },
  };
}

function unlockRequest(path = "/unlock?session_id=cs_test_123", cookie?: string): Request {
  return new Request(`https://example.test${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function redirectPath(response: Response): string {
  const location = response.headers.get("location");
  assert.ok(location, "expected a redirect location header");
  const url = new URL(location);
  return `${url.pathname}${url.search}`;
}

function setCookie(response: Response): string | null {
  return response.headers.get("set-cookie");
}

function cookieValue(cookie: string): string {
  const value = cookie.match(new RegExp(`${ENTITLEMENT_COOKIE}=([^;]+)`))?.[1];
  assert.ok(value, "expected entitlement cookie value");
  return value;
}

test("redirects home without setting a cookie when session_id is missing", async () => {
  let retrieveCalls = 0;
  const get = createUnlockGET({
    env,
    retrieveCheckoutSession: async () => {
      retrieveCalls += 1;
      return paidSession(env.STRIPE_PRICE_HUMANOID);
    },
  });

  const response = await get(unlockRequest("/unlock"));

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/");
  assert.equal(setCookie(response), null);
  assert.equal(retrieveCalls, 0);
});

test("legacy paid ai compute sessions redirect to the free demo without granting an entitlement", async () => {
  const get = createUnlockGET({
    env: disabledLegacyAiEnv,
    retrieveCheckoutSession: async (sessionId, secretKey) => {
      assert.equal(sessionId, "cs_test_123");
      assert.equal(secretKey, env.STRIPE_SECRET_KEY);
      return paidSession(disabledLegacyAiEnv[DISABLED_LEGACY_AI_PRICE_ENV_KEY]);
    },
  });

  const response = await get(unlockRequest());
  const cookie = setCookie(response);

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/d/ai-compute?free=1");
  assert.equal(cookie, null);
});

test("future humanoid and power price ids redirect to a pending state without granting entitlement", async () => {
  for (const priceId of [env.STRIPE_PRICE_HUMANOID, env.STRIPE_PRICE_POWER]) {
    const get = createUnlockGET({
      env,
      retrieveCheckoutSession: async () => paidSession(priceId),
    });

    const response = await get(unlockRequest());

    assert.equal(response.status, 307);
    assert.equal(redirectPath(response), "/?purchase=domain-pending&waitlist=1");
    assert.equal(setCookie(response), null);
  }
});

test("paid founding sessions grant all-access and preserve existing entitlements", async () => {
  const existingValue = await grantCookieValue("humanoid", []);
  const get = createUnlockGET({
    env,
    retrieveCheckoutSession: async () => paidSession(env.STRIPE_PRICE_FOUNDING),
  });

  const response = await get(unlockRequest("/unlock?session_id=cs_test_founding", `${ENTITLEMENT_COOKIE}=${existingValue}`));
  const cookie = setCookie(response);

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=founding&waitlist=1&unlocked=1");
  assert.deepEqual((await readEntitlements(cookieValue(cookie))).sort(), ["all", "humanoid"]);
});

test("incomplete payments redirect to an explicit non-grant state", async () => {
  const get = createUnlockGET({
    env,
    retrieveCheckoutSession: async () => paidSession(env.STRIPE_PRICE_HUMANOID, "unpaid"),
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=incomplete");
  assert.equal(setCookie(response), null);
});

test("unknown prices redirect to an explicit non-grant state", async () => {
  const get = createUnlockGET({
    env,
    retrieveCheckoutSession: async () => paidSession("price_unknown"),
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=unknown");
  assert.equal(setCookie(response), null);
});

test("missing Stripe secret key fails safe without retrieving the session or granting access", async () => {
  let retrieveCalls = 0;
  const get = createUnlockGET({
    env: { ...env, STRIPE_SECRET_KEY: undefined },
    retrieveCheckoutSession: async () => {
      retrieveCalls += 1;
      return paidSession(env.STRIPE_PRICE_HUMANOID);
    },
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=config-missing");
  assert.equal(setCookie(response), null);
  assert.equal(retrieveCalls, 0);
});

test("missing entitlement secret fails safe without granting founding access", async () => {
  const previousSecret = process.env.ENTITLEMENT_SECRET;
  delete process.env.ENTITLEMENT_SECRET;
  const get = createUnlockGET({
    env,
    retrieveCheckoutSession: async () => paidSession(env.STRIPE_PRICE_FOUNDING),
  });

  try {
    const response = await get(unlockRequest());

    assert.equal(response.status, 307);
    assert.equal(redirectPath(response), "/?purchase=config-missing");
    assert.equal(setCookie(response), null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ENTITLEMENT_SECRET;
    } else {
      process.env.ENTITLEMENT_SECRET = previousSecret;
    }
  }
});

test("only the founding price mapping grants entitlement", () => {
  assert.deepEqual(
    PRICE_UNLOCKS.map(({ envKey, entitlement, destination }) => ({ envKey, entitlement, destination })),
    [
      { envKey: "STRIPE_PRICE_FOUNDING", entitlement: "all", destination: "/?purchase=founding&waitlist=1" },
    ],
  );
});
