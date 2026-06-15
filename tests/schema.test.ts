import test from "node:test";
import assert from "node:assert/strict";

import { nodeSchema } from "../src/lib/schema";

test("nodeSchema accepts an optional positive demandScale", () => {
  const parsed = nodeSchema.parse({
    id: "p1",
    name: "Product 1",
    kind: "product",
    domain: ["test"],
    demandScale: 50,
  });
  assert.equal(parsed.demandScale, 50);
});

test("nodeSchema rejects a non-positive demandScale", () => {
  assert.throws(() =>
    nodeSchema.parse({ id: "p1", name: "P", kind: "product", domain: ["test"], demandScale: 0 }),
  );
});
