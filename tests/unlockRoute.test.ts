import test from "node:test";
import assert from "node:assert/strict";
import { ENTITLEMENT_COOKIE, grantCookieValue, readEntitlements } from "../src/lib/entitlements";
import { PRICE_UNLOCKS, createUnlockGET, type UnlockCheckoutSession } from "../src/lib/unlockRoute";

const env = {
  ENTITLEMENT_SECRET: "a-secure-entitlement-secret-over-32-characters",
  SUPPORT_EMAIL: "support@example.com",
  STRIPE_SECRET_KEY: "sk_test_unlock",
  STRIPE_PRICE_HUMANOID: "price_humanoid",
  STRIPE_PRICE_POWER: "price_power",
  STRIPE_PRICE_FOUNDING: "price_founding",
  NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "https://buy.stripe.com/test_example",
};
const paidUnlocksEnabledEnv = {
  ...env,
  ENABLE_PAID_UNLOCKS: "1",
};

const DISABLED_LEGACY_AI_PRICE_ENV_KEY = "STRIPE_PRICE_AI_COMPUTE";
const disabledLegacyAiEnv = {
  ...env,
  [DISABLED_LEGACY_AI_PRICE_ENV_KEY]: "price_disabled_legacy_ai",
};

process.env.ENTITLEMENT_SECRET = "unlock-route-test-secret";

type PaidSessionFixture = UnlockCheckoutSession & {
  status: string;
  mode: string;
  currency: string;
  amount_total: number;
  line_items: {
    data: Array<{
      price: { id: string };
      quantity: number;
    }>;
  };
};

function paidSession(priceId: string, paymentStatus = "paid"): PaidSessionFixture {
  return {
    payment_status: paymentStatus,
    status: "complete",
    mode: "payment",
    currency: "usd",
    amount_total: 900,
    line_items: {
      data: [{ price: { id: priceId }, quantity: 1 }],
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

test("paid unlocks fail closed by default even when Stripe env is configured", async () => {
  let retrieveCalls = 0;
  const get = createUnlockGET({
    env,
    retrieveCheckoutSession: async () => {
      retrieveCalls += 1;
      return paidSession(env.STRIPE_PRICE_FOUNDING);
    },
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=disabled&waitlist=1");
  assert.equal(setCookie(response), null);
  assert.equal(retrieveCalls, 0);
});

test("legacy paid ai compute sessions redirect to the free demo without granting an entitlement", async () => {
  const get = createUnlockGET({
    env: { ...disabledLegacyAiEnv, ENABLE_PAID_UNLOCKS: "1" },
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
      env: paidUnlocksEnabledEnv,
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
    env: paidUnlocksEnabledEnv,
    retrieveCheckoutSession: async () => paidSession(env.STRIPE_PRICE_FOUNDING),
  });

  const response = await get(unlockRequest("/unlock?session_id=cs_test_founding", `${ENTITLEMENT_COOKIE}=${existingValue}`));
  const cookie = setCookie(response);

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=success&access=all&unlocked=1");
  assert.doesNotMatch(redirectPath(response), /waitlist/);
  assert.match(cookie ?? "", /Path=\//i);
  assert.match(cookie ?? "", /Max-Age=34560000/i);
  assert.match(cookie ?? "", /HttpOnly/i);
  assert.match(cookie ?? "", /Secure/i);
  assert.match(cookie ?? "", /SameSite=Lax/i);
  assert.deepEqual((await readEntitlements(cookieValue(cookie))).sort(), ["all", "humanoid"]);
});

test("normalizes whitespace around the configured Stripe key and founding price", async () => {
  const get = createUnlockGET({
    env: {
      ...paidUnlocksEnabledEnv,
      STRIPE_SECRET_KEY: `  ${env.STRIPE_SECRET_KEY}  `,
      STRIPE_PRICE_FOUNDING: `  ${env.STRIPE_PRICE_FOUNDING}  `,
    },
    retrieveCheckoutSession: async (sessionId, secretKey) => {
      assert.equal(sessionId, "cs_test_whitespace");
      assert.equal(secretKey, env.STRIPE_SECRET_KEY);
      return paidSession(env.STRIPE_PRICE_FOUNDING);
    },
  });

  const response = await get(unlockRequest("/unlock?session_id=cs_test_whitespace"));

  assert.equal(redirectPath(response), "/?purchase=success&access=all&unlocked=1");
  assert.deepEqual(await readEntitlements(cookieValue(setCookie(response))), ["all"]);
});

test("a verified paid session can be replayed to restore all-access without duplicating entitlements", async () => {
  let retrieveCalls = 0;
  const get = createUnlockGET({
    env: paidUnlocksEnabledEnv,
    retrieveCheckoutSession: async (sessionId) => {
      retrieveCalls += 1;
      assert.equal(sessionId, "cs_test_restore");
      return paidSession(env.STRIPE_PRICE_FOUNDING);
    },
  });

  const first = await get(unlockRequest("/unlock?session_id=cs_test_restore"));
  const firstCookie = cookieValue(setCookie(first));
  assert.deepEqual(await readEntitlements(firstCookie), ["all"]);

  const replayWithCookie = await get(
    unlockRequest("/unlock?session_id=cs_test_restore", `${ENTITLEMENT_COOKIE}=${firstCookie}`),
  );
  assert.deepEqual(await readEntitlements(cookieValue(setCookie(replayWithCookie))), ["all"]);

  const replayOnFreshBrowser = await get(unlockRequest("/unlock?session_id=cs_test_restore"));
  assert.deepEqual(await readEntitlements(cookieValue(setCookie(replayOnFreshBrowser))), ["all"]);
  assert.equal(redirectPath(replayOnFreshBrowser), "/?purchase=success&access=all&unlocked=1");
  assert.equal(retrieveCalls, 3);
});

test("incomplete payments redirect to an explicit non-grant state", async () => {
  const get = createUnlockGET({
    env: paidUnlocksEnabledEnv,
    retrieveCheckoutSession: async () => paidSession(env.STRIPE_PRICE_FOUNDING, "unpaid"),
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=incomplete");
  assert.equal(setCookie(response), null);
});

test("paid sessions with an invalid $9 Checkout contract fail closed", async (t) => {
  const invalidSessions: Array<[string, () => UnlockCheckoutSession]> = [
    ["session is not complete", () => ({ ...paidSession(env.STRIPE_PRICE_FOUNDING), status: "open" })],
    ["session is not a one-time payment", () => ({ ...paidSession(env.STRIPE_PRICE_FOUNDING), mode: "subscription" })],
    ["currency is not USD", () => ({ ...paidSession(env.STRIPE_PRICE_FOUNDING), currency: "eur" })],
    ["amount is not exactly 900 cents", () => ({ ...paidSession(env.STRIPE_PRICE_FOUNDING), amount_total: 899 })],
    [
      "session contains more than one line item",
      () => {
        const session = paidSession(env.STRIPE_PRICE_FOUNDING);
        return {
          ...session,
          line_items: {
            data: [...session.line_items.data, { price: { id: env.STRIPE_PRICE_FOUNDING }, quantity: 1 }],
          },
        };
      },
    ],
    [
      "line item quantity is not one",
      () => {
        const session = paidSession(env.STRIPE_PRICE_FOUNDING);
        return {
          ...session,
          line_items: {
            data: [{ ...session.line_items.data[0], quantity: 2 }],
          },
        };
      },
    ],
  ];

  for (const [name, createSession] of invalidSessions) {
    await t.test(name, async () => {
      const get = createUnlockGET({
        env: paidUnlocksEnabledEnv,
        retrieveCheckoutSession: async () => createSession(),
      });

      const response = await get(unlockRequest());

      assert.equal(redirectPath(response), "/?purchase=unknown");
      assert.equal(setCookie(response), null);
    });
  }
});

test("temporary Stripe verification failures redirect to a retry-safe issue state", async () => {
  const get = createUnlockGET({
    env: paidUnlocksEnabledEnv,
    retrieveCheckoutSession: async () => {
      throw new Error("temporary Stripe outage");
    },
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=verification-unavailable");
  assert.equal(setCookie(response), null);
});

test("unknown prices redirect to an explicit non-grant state", async () => {
  const get = createUnlockGET({
    env: paidUnlocksEnabledEnv,
    retrieveCheckoutSession: async () => paidSession("price_unknown"),
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=unknown");
  assert.equal(setCookie(response), null);
});

test("missing founding price configuration fails closed before payment verification", async () => {
  const get = createUnlockGET({
    env: { ...paidUnlocksEnabledEnv, STRIPE_PRICE_FOUNDING: undefined },
    retrieveCheckoutSession: async () => paidSession(env.STRIPE_PRICE_FOUNDING),
  });

  const response = await get(unlockRequest());

  assert.equal(response.status, 307);
  assert.equal(redirectPath(response), "/?purchase=config-missing");
  assert.equal(setCookie(response), null);
});

test("missing Stripe secret key fails safe without retrieving the session or granting access", async () => {
  let retrieveCalls = 0;
  const get = createUnlockGET({
    env: { ...paidUnlocksEnabledEnv, STRIPE_SECRET_KEY: undefined },
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

test("incomplete paid-launch support configuration refuses direct unlock requests", async () => {
  let retrieveCalls = 0;
  const get = createUnlockGET({
    env: { ...paidUnlocksEnabledEnv, SUPPORT_EMAIL: undefined },
    retrieveCheckoutSession: async () => {
      retrieveCalls += 1;
      return paidSession(env.STRIPE_PRICE_FOUNDING);
    },
  });

  const response = await get(unlockRequest());

  assert.equal(redirectPath(response), "/?purchase=config-missing");
  assert.equal(setCookie(response), null);
  assert.equal(retrieveCalls, 0);
});

test("missing entitlement secret fails safe without granting founding access", async () => {
  const previousSecret = process.env.ENTITLEMENT_SECRET;
  delete process.env.ENTITLEMENT_SECRET;
  const get = createUnlockGET({
    env: paidUnlocksEnabledEnv,
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
      { envKey: "STRIPE_PRICE_FOUNDING", entitlement: "all", destination: "/?purchase=success&access=all" },
    ],
  );
});
