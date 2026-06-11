import test from "node:test";
import assert from "node:assert/strict";
import { nodeSchema } from "../src/lib/schema";

const base = {
  id: "n1",
  name: "Node",
  domain: ["test"],
  maturityLabel: "mature",
  maturityAsOf: "2025-01",
};

test("transactability accepted on engineering_method nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "engineering_method",
    transactability: "must_build",
  });
  assert.equal(parsed.success, true);
});

test("transactability accepted on manufacturing_process nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "manufacturing_process",
    transactability: "procurable",
  });
  assert.equal(parsed.success, true);
});

test("transactability rejected on module nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    transactability: "procurable",
  });
  assert.equal(parsed.success, false);
});

test("transactability rejects unknown values", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "engineering_method",
    transactability: "buyable",
  });
  assert.equal(parsed.success, false);
});

test("listingStatus + ticker accepted on organization nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "organization",
    listingStatus: "public",
    ticker: "6954.T",
  });
  assert.equal(parsed.success, true);
});

test("listingStatus rejected on non-organization nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    listingStatus: "public",
  });
  assert.equal(parsed.success, false);
});

test("ticker rejected on non-organization nodes", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    ticker: "NVDA",
  });
  assert.equal(parsed.success, false);
});

test("capacityLeadTimeMonths accepted on any structural node", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    capacityLeadTimeMonths: 18,
  });
  assert.equal(parsed.success, true);
});

test("capacityLeadTimeMonths rejects non-positive values", () => {
  const parsed = nodeSchema.safeParse({
    ...base,
    kind: "module",
    capacityLeadTimeMonths: 0,
  });
  assert.equal(parsed.success, false);
});
