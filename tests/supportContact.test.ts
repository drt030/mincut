import test from "node:test";
import assert from "node:assert/strict";
import { activeSupportEmail } from "../src/lib/supportContact";

test("support contact stays unset without inventing an address while checkout is closed", () => {
  assert.equal(activeSupportEmail({ ENABLE_PAID_UNLOCKS: "0" }), null);
});

test("paid checkout fails closed without a verified support address", () => {
  assert.throws(
    () => activeSupportEmail({ ENABLE_PAID_UNLOCKS: "1" }),
    /SUPPORT_EMAIL is required before paid unlocks can be enabled/,
  );
});

test("support contact accepts a configured email and rejects malformed values", () => {
  assert.equal(
    activeSupportEmail({ ENABLE_PAID_UNLOCKS: "1", SUPPORT_EMAIL: " help@example.com " }),
    "help@example.com",
  );
  assert.throws(
    () => activeSupportEmail({ ENABLE_PAID_UNLOCKS: "0", SUPPORT_EMAIL: "not-an-email" }),
    /SUPPORT_EMAIL must be a valid email address/,
  );
});
