import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INTERNAL_ROUTE_METADATA, internalRoutesAvailable } from "../src/lib/internalRouteGuard";

test("internal routes stay available in local development", () => {
  assert.equal(internalRoutesAvailable({ NODE_ENV: "development" }), true);
  assert.equal(internalRoutesAvailable({ NODE_ENV: "test" }), true);
});

test("internal routes fail closed in production and every Vercel deployment", () => {
  assert.equal(internalRoutesAvailable({ NODE_ENV: "production" }), false);
  assert.equal(
    internalRoutesAvailable({ NODE_ENV: "production", NEXT_PUBLIC_OPERATOR_MODE: "1", VERCEL_ENV: "preview" }),
    false,
  );
  assert.equal(
    internalRoutesAvailable({ NODE_ENV: "production", NEXT_PUBLIC_OPERATOR_MODE: "1", VERCEL_ENV: "production" }),
    false,
  );
});

test("a local production operator can explicitly restore internal routes", () => {
  assert.equal(internalRoutesAvailable({ NODE_ENV: "production", NEXT_PUBLIC_OPERATOR_MODE: "1" }), true);
});

test("internal route metadata blocks indexing", () => {
  assert.deepEqual(INTERNAL_ROUTE_METADATA.robots, { index: false, follow: false });
});

test("every internal app route applies the shared production guard", () => {
  for (const path of [
    "src/app/explore/page.tsx",
    "src/app/gate/page.tsx",
    "src/app/graph/page.tsx",
    "src/app/product/[id]/page.tsx",
    "src/app/tasks/page.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /export const metadata = INTERNAL_ROUTE_METADATA/);
    assert.match(source, /if \(!internalRoutesAvailable\(\)\) notFound\(\)/);
  }
});
