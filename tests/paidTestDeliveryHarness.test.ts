import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertFreshProductionBuild,
  checkoutCompletedFixture,
  localTestBaseUrl,
  paidDeliveryServerEnv,
  paidTestSessionIssues,
  preparePaidDeliveryServer,
} from "../scripts/verify-paid-test-delivery";

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    amount_total: 900,
    currency: "usd",
    livemode: false,
    mode: "payment" as const,
    payment_status: "paid" as const,
    status: "complete" as const,
    line_items: {
      object: "list" as const,
      data: [{
        id: "li_test",
        object: "item" as const,
        amount_discount: 0,
        amount_subtotal: 900,
        amount_tax: 0,
        amount_total: 900,
        currency: "usd",
        description: "MinCut all-access",
        discounts: [],
        price: { id: "price_founding", object: "price" as const },
        quantity: 1,
        taxes: [],
      }],
      has_more: false,
      url: "/v1/checkout/sessions/cs_test/line_items",
    },
    ...overrides,
  };
}

test("paid delivery harness builds the four-step Stripe CLI completion fixture", () => {
  const fixture = checkoutCompletedFixture({
    baseUrl: "http://localhost:3100",
    clientReferenceId: "mincut-e2e-run",
    priceId: "price_founding",
  });

  assert.deepEqual(fixture.fixtures.map((step) => step.name), [
    "checkout_session",
    "payment_page",
    "payment_method",
    "payment_page_confirm",
  ]);
  assert.deepEqual(fixture.fixtures[0]?.params?.line_items, [{ price: "price_founding", quantity: 1 }]);
  assert.equal(fixture.fixtures[0]?.params?.client_reference_id, "mincut-e2e-run");
  assert.equal(fixture.fixtures[3]?.params?.expected_amount, 900);
  assert.ok(!fixture.fixtures.some((step) => step.path === "/v1/products" || step.path === "/v1/prices"));
});

test("paid delivery harness accepts only an exact paid $9 founding Session", () => {
  assert.deepEqual(paidTestSessionIssues(paidSession(), "price_founding"), []);

  const issues = paidTestSessionIssues(
    paidSession({ amount_total: 3900, livemode: true, payment_status: "unpaid" }),
    "price_other",
  );
  assert.ok(issues.some((issue) => issue.includes("test mode")));
  assert.ok(issues.some((issue) => issue.includes("paid")));
  assert.ok(issues.some((issue) => issue.includes("$9.00")));
  assert.ok(issues.some((issue) => issue.includes("STRIPE_PRICE_FOUNDING")));
});

test("paid delivery harness rejects non-loopback and pathful targets", () => {
  assert.equal(localTestBaseUrl("http://localhost:3100").origin, "http://localhost:3100");
  assert.throws(() => localTestBaseUrl("https://example.com"), /loopback/);
  assert.throws(() => localTestBaseUrl("http://localhost:3100/unlock"), /bare loopback origin/);
});

test("paid delivery harness refuses to reuse an occupied port with --start-server", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200).end("occupied");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = new URL(`http://127.0.0.1:${address.port}`);
    await assert.rejects(
      preparePaidDeliveryServer(baseUrl, true),
      /already running.*--start-server/i,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("paid delivery harness may reuse an occupied port only without --start-server", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200).end("existing app");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = new URL(`http://127.0.0.1:${address.port}`);
    assert.equal(await preparePaidDeliveryServer(baseUrl, false), null);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("paid delivery harness starts Next explicitly in Vercel preview mode", () => {
  const env = paidDeliveryServerEnv({
    KEEP_ME: "yes",
    STRIPE_API_KEY: "write-key",
    STRIPE_TEST_WRITE_KEY: "test-write-key",
    VERCEL_ENV: "production",
  });

  assert.equal(env.VERCEL_ENV, "preview");
  assert.equal(env.KEEP_ME, "yes");
  assert.equal(env.STRIPE_API_KEY, undefined);
  assert.equal(env.STRIPE_TEST_WRITE_KEY, undefined);
});

test("paid delivery harness rejects a build older than any production input", () => {
  for (const changedInput of [
    path.join("src", "nested", "offer.ts"),
    path.join("data", "nested", "domain.json"),
    "package.json",
    "next.config.ts",
  ]) {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "mincut-paid-build-"));
    try {
      const inputs = [
        path.join("src", "nested", "offer.ts"),
        path.join("data", "nested", "domain.json"),
        "package.json",
        "next.config.ts",
      ];
      for (const relativePath of inputs) {
        const file = path.join(projectDir, relativePath);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "fixture\n");
      }
      const buildId = path.join(projectDir, ".next", "BUILD_ID");
      fs.mkdirSync(path.dirname(buildId), { recursive: true });
      fs.writeFileSync(buildId, "fixture-build\n");
      const built = new Date(Date.now() + 30_000);
      const changed = new Date(Date.now() + 60_000);
      fs.utimesSync(buildId, built, built);
      fs.utimesSync(path.join(projectDir, changedInput), changed, changed);

      const expectedPath = changedInput.replaceAll("\\", "[/\\\\]").replaceAll("/", "[/\\\\]");
      assert.throws(
        () => assertFreshProductionBuild(projectDir),
        new RegExp(`production build is stale.*${expectedPath}`, "i"),
      );
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  }
});
