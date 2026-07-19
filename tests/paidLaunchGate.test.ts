import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { paidLaunchOptions } from "../src/lib/paidLaunchOptions";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};

function runScript(name: string) {
  return spawnSync("npm", ["run", name], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ENABLE_PAID_UNLOCKS: "0",
      STRIPE_SECRET_KEY: "",
      STRIPE_PRICE_FOUNDING: "",
      NEXT_PUBLIC_STRIPE_LINK_FOUNDING: "",
      ENTITLEMENT_SECRET: "",
      SUPPORT_EMAIL: "",
    },
  });
}

test("ordinary builds may stay in explicit safe mode", () => {
  const result = runScript("check:paid-launch");
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /checkout disabled \(safe mode\)/);
});

test("paid releases fail when the paid switch is not enabled", () => {
  const result = runScript("check:paid-release");
  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /ENABLE_PAID_UNLOCKS must be 1 for a paid release/);
});

test("the paid release command requires live remote Stripe verification before build", () => {
  assert.match(packageJson.scripts?.["check:paid-release"] ?? "", /--require-enabled/);
  assert.match(packageJson.scripts?.["check:paid-release"] ?? "", /--require-live/);
  assert.match(packageJson.scripts?.["check:paid-release"] ?? "", /--verify-stripe/);
  assert.match(packageJson.scripts?.["verify:paid-release"] ?? "", /check:commercial-readiness/);
  assert.match(packageJson.scripts?.["verify:paid-release"] ?? "", /check:node-detail-ia -- --fail-on-warn/);
  assert.match(packageJson.scripts?.["verify:paid-release"] ?? "", /check:paid-release/);
  assert.match(packageJson.scripts?.["verify:paid-release"] ?? "", /npm run build$/);
});

test("an enabled Vercel production build automatically becomes a strict paid release", () => {
  assert.deepEqual(
    paidLaunchOptions([], { VERCEL_ENV: "production", ENABLE_PAID_UNLOCKS: "1" }),
    { requireEnabled: true, requireLive: true, verifyStripe: true },
  );
  assert.deepEqual(
    paidLaunchOptions([], { VERCEL_ENV: "production", ENABLE_PAID_UNLOCKS: "0" }),
    { requireEnabled: false, requireLive: false, verifyStripe: false },
  );
});
