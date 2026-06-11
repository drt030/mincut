import test from "node:test";
import assert from "node:assert/strict";
import { grantCookieValue, readEntitlements } from "../src/lib/entitlements";

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
