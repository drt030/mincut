import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import Stripe from "stripe";
import { DOMAIN_ROUTES } from "../src/lib/domains";
import {
  ENTITLEMENT_COOKIE,
  foundingCheckoutConfigIssues,
  paidUnlocksEnabled,
  readEntitlements,
} from "../src/lib/entitlements";

const TEST_DELIVERY_PORT = 3100;
const DEFAULT_BASE_URL = `http://localhost:${TEST_DELIVERY_PORT}`;
const REQUIRED_STRIPE_CLI_VERSION = "1.43.8";
const PRODUCTION_BUILD_INPUTS = ["src", "data", "package.json", "next.config.ts"] as const;

type PaidSessionSnapshot = {
  amount_total: number | null;
  currency: string | null;
  livemode: boolean;
  mode: string;
  payment_status: string;
  status: string | null;
  line_items?: {
    data: Array<{
      price?: string | { id: string } | null;
      quantity?: number | null;
    }>;
  } | null;
};

type FixtureOptions = {
  baseUrl: string;
  clientReferenceId: string;
  priceId: string;
};

const exposureSentinelBySlug: Record<string, string> = {
  "humanoid-robotics": "org_humanoid_harmonic_drive_systems",
  "controlled-fusion": "org_bruker",
  "spacex-reusable-launch": "org_linde",
  "spacex-orbital-data-center": "org_redwire",
};

function flagValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function safeMessage(value: string): string {
  return value
    .replace(/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9_]+\b/g, "[redacted-stripe-key]")
    .replace(/\bcs_test_[A-Za-z0-9_]+\b/g, "[redacted-test-session]")
    .replace(/\bcge_ent=[^;\s]+/g, "cge_ent=[redacted]");
}

export function paidDeliveryServerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const serverEnv: NodeJS.ProcessEnv = { ...env, VERCEL_ENV: "preview" };
  delete serverEnv.STRIPE_TEST_WRITE_KEY;
  delete serverEnv.STRIPE_API_KEY;
  return serverEnv;
}

export function assertFreshProductionBuild(projectDir: string = process.cwd()): void {
  const buildId = path.join(projectDir, ".next", "BUILD_ID");
  if (!fs.existsSync(buildId)) {
    throw new Error("No production build found; run npm run build before paid test delivery");
  }

  const buildTime = fs.statSync(buildId).mtimeMs;
  const changedInputs: string[] = [];
  const visit = (absolutePath: string) => {
    const stat = fs.lstatSync(absolutePath);
    if (stat.mtimeMs > buildTime) changedInputs.push(path.relative(projectDir, absolutePath));
    if (!stat.isDirectory()) return;
    for (const entry of fs.readdirSync(absolutePath)) visit(path.join(absolutePath, entry));
  };

  for (const input of PRODUCTION_BUILD_INPUTS) {
    const absolutePath = path.join(projectDir, input);
    if (fs.existsSync(absolutePath)) visit(absolutePath);
  }

  if (changedInputs.length > 0) {
    const examples = changedInputs.sort().slice(0, 10).join(", ");
    const remainder = changedInputs.length > 10 ? ` (+${changedInputs.length - 10} more)` : "";
    throw new Error(`Production build is stale; rebuild after changes to: ${examples}${remainder}`);
  }
}

export function localTestBaseUrl(raw: string): URL {
  const url = new URL(raw);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname)) {
    throw new Error("Paid test delivery must target an HTTP loopback URL");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Paid test delivery base URL must be a bare loopback origin");
  }
  return url;
}

export function checkoutCompletedFixture({ baseUrl, clientReferenceId, priceId }: FixtureOptions) {
  return {
    _meta: { template_version: 0 },
    fixtures: [
      {
        name: "checkout_session",
        path: "/v1/checkout/sessions",
        method: "post",
        params: {
          success_url: `${baseUrl}/unlock?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/?purchase=canceled`,
          client_reference_id: clientReferenceId,
          mode: "payment",
          line_items: [{ price: priceId, quantity: 1 }],
        },
      },
      {
        name: "payment_page",
        path: "/v1/payment_pages/${checkout_session:id}",
        method: "get",
      },
      {
        name: "payment_method",
        path: "/v1/payment_methods",
        method: "post",
        params: {
          type: "card",
          card: { token: "tok_visa" },
          billing_details: {
            email: "mincut-paid-e2e@example.test",
            name: "MinCut paid delivery E2E",
          },
        },
      },
      {
        name: "payment_page_confirm",
        path: "/v1/payment_pages/${checkout_session:id}/confirm",
        method: "post",
        params: {
          payment_method: "${payment_method:id}",
          expected_amount: 900,
        },
      },
    ],
  };
}

export function paidTestSessionIssues(session: PaidSessionSnapshot, expectedPriceId: string): string[] {
  const issues: string[] = [];
  const items = session.line_items?.data ?? [];
  const firstPrice = items[0]?.price;
  const firstPriceId = typeof firstPrice === "string" ? firstPrice : firstPrice?.id;

  if (session.livemode) issues.push("Checkout Session must be test mode");
  if (session.status !== "complete") issues.push("Checkout Session must be complete");
  if (session.payment_status !== "paid") issues.push("Checkout Session must be paid");
  if (session.mode !== "payment") issues.push("Checkout Session must be a one-time payment");
  if (session.currency?.toLowerCase() !== "usd") issues.push("Checkout Session currency must be USD");
  if (session.amount_total !== 900) issues.push("Checkout Session amount must be exactly USD $9.00");
  if (items.length !== 1) issues.push("Checkout Session must contain exactly one line item");
  if (firstPriceId !== expectedPriceId) issues.push("Checkout Session line item must use STRIPE_PRICE_FOUNDING");
  if (items[0]?.quantity !== 1) issues.push("Checkout Session founding quantity must be one");

  return issues;
}

function assertTestConfiguration(baseUrl: URL): { priceId: string; readKey: string; writeKey: string } {
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("Paid test delivery is forbidden in Vercel production");
  }
  if (!paidUnlocksEnabled()) throw new Error("ENABLE_PAID_UNLOCKS must be 1 for paid test delivery");

  const issues = foundingCheckoutConfigIssues(process.env);
  if (issues.length > 0) throw new Error(`Paid test configuration is incomplete: ${issues.join("; ")}`);
  if (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") !== baseUrl.origin) {
    throw new Error(`NEXT_PUBLIC_SITE_URL must equal ${baseUrl.origin}`);
  }

  const priceId = process.env.STRIPE_PRICE_FOUNDING?.trim() ?? "";
  const readKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const writeKey = process.env.STRIPE_TEST_WRITE_KEY?.trim() || readKey;
  for (const [label, key] of [["STRIPE_SECRET_KEY", readKey], ["STRIPE_TEST_WRITE_KEY", writeKey]] as const) {
    if (!/^(?:sk|rk)_test_/.test(key)) throw new Error(`${label} must be a test-mode Stripe key`);
  }
  return { priceId, readKey, writeKey };
}

async function createPaidTestSession(
  stripe: Stripe,
  baseUrl: URL,
  priceId: string,
  writeKey: string,
  stripeCli: string,
): Promise<Stripe.Checkout.Session> {
  const version = spawnSync(stripeCli, ["version"], { encoding: "utf8" });
  if (version.error || version.status !== 0) {
    throw new Error(`Stripe CLI is unavailable at ${stripeCli}`);
  }
  const versionOutput = `${version.stdout ?? ""}\n${version.stderr ?? ""}`;
  if (!versionOutput.includes(`stripe version ${REQUIRED_STRIPE_CLI_VERSION}`)) {
    throw new Error(`Stripe CLI ${REQUIRED_STRIPE_CLI_VERSION} is required for reproducible paid test delivery`);
  }

  const clientReferenceId = `mincut-paid-e2e-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const createdAt = Math.floor(Date.now() / 1000) - 2;
  const fixture = JSON.stringify(checkoutCompletedFixture({
    baseUrl: baseUrl.origin,
    clientReferenceId,
    priceId,
  }));
  const cliEnv: NodeJS.ProcessEnv = { ...process.env, STRIPE_API_KEY: writeKey };
  delete cliEnv.STRIPE_TEST_WRITE_KEY;
  const trigger = spawnSync(
    stripeCli,
    ["trigger", "checkout.session.completed", "--raw", fixture, "--color", "off"],
    { encoding: "utf8", env: cliEnv },
  );
  if (trigger.error || trigger.status !== 0) {
    const detail = safeMessage(`${trigger.stdout ?? ""}\n${trigger.stderr ?? ""}`).trim();
    throw new Error(`Stripe CLI could not create the paid test Session${detail ? `: ${detail}` : ""}`);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sessions = await stripe.checkout.sessions.list({
      created: { gte: createdAt },
      limit: 100,
      expand: ["data.line_items"],
    });
    const match = sessions.data.find((session) => session.client_reference_id === clientReferenceId);
    if (match) return match;
    await delay(500);
  }
  throw new Error("Stripe created the fixture but its Checkout Session could not be found");
}

async function fetchManual(baseUrl: URL, route: string, cookie?: string): Promise<Response> {
  return fetch(new URL(route, baseUrl), {
    redirect: "manual",
    headers: cookie ? { cookie } : undefined,
    signal: AbortSignal.timeout(20_000),
  });
}

async function verifyDelivery(baseUrl: URL, sessionId: string): Promise<void> {
  const paidDomains = DOMAIN_ROUTES.filter((domain) => Boolean(domain.allAccessRole));
  assert.equal(paidDomains.length, 4, "the current offer must contain exactly four paid maps");

  for (const domain of paidDomains) {
    const sentinel = exposureSentinelBySlug[domain.slug];
    assert.ok(sentinel, `missing paid exposure sentinel for ${domain.slug}`);
    const locked = await fetchManual(baseUrl, domain.href);
    const html = await locked.text();
    assert.equal(locked.status, 200, `${domain.href} must render before purchase`);
    assert.match(html, /exposure-access-banner-locked/, `${domain.href} must start locked`);
    assert.doesNotMatch(html, /exposure-access-banner-unlocked/);
    assert.ok(!html.includes(sentinel), `${domain.href} leaked ${sentinel} before purchase`);
  }

  const unlock = await fetchManual(baseUrl, `/unlock?session_id=${encodeURIComponent(sessionId)}`);
  assert.equal(unlock.status, 307, "paid Session must redirect through /unlock");
  const location = unlock.headers.get("location");
  const setCookie = unlock.headers.get("set-cookie");
  assert.equal(location, `${baseUrl.origin}/?purchase=success&access=all&unlocked=1`);
  assert.ok(setCookie, "paid Session must issue an entitlement cookie");
  for (const rule of [
    new RegExp(`${ENTITLEMENT_COOKIE}=`),
    /Path=\//i,
    /Max-Age=34560000/i,
    /HttpOnly/i,
    /Secure/i,
    /SameSite=Lax/i,
  ]) assert.match(setCookie, rule);

  const cookie = setCookie.split(";", 1)[0];
  const token = decodeURIComponent(cookie.slice(`${ENTITLEMENT_COOKIE}=`.length));
  assert.deepEqual(await readEntitlements(token), ["all"], "paid cookie must contain only global all-access");

  const success = await fetch(location, { headers: { cookie }, signal: AbortSignal.timeout(20_000) });
  const successHtml = await success.text();
  assert.equal(success.status, 200);
  assert.match(successHtml, /All current paid maps are unlocked\./);
  assert.match(successHtml, /Payment received\. All-access is ready in this browser\./);

  for (const domain of paidDomains) {
    const sentinel = exposureSentinelBySlug[domain.slug];
    const unlocked = await fetchManual(baseUrl, domain.href, cookie);
    const html = await unlocked.text();
    assert.equal(unlocked.status, 200, `${domain.href} must render after purchase`);
    assert.match(html, /exposure-access-banner-unlocked/, `${domain.href} must unlock`);
    assert.doesNotMatch(html, /exposure-access-banner-locked/);
    assert.ok(html.includes(sentinel), `${domain.href} did not deliver ${sentinel}`);
  }

  const ai = await fetchManual(baseUrl, "/d/ai-compute");
  const aiHtml = await ai.text();
  assert.equal(ai.status, 200);
  assert.match(aiHtml, /Free reference map/);
  assert.ok(aiHtml.includes("org_asml"), "AI Compute must retain its free company/ticker layer");
  assert.doesNotMatch(aiHtml, /exposure-access-banner-(?:locked|unlocked)/);

  const replayFresh = await fetchManual(baseUrl, `/unlock?session_id=${encodeURIComponent(sessionId)}`);
  assert.equal(replayFresh.status, 307);
  assert.equal(replayFresh.headers.get("location"), location);
  assert.match(replayFresh.headers.get("set-cookie") ?? "", new RegExp(`${ENTITLEMENT_COOKIE}=`));

  const replayExisting = await fetchManual(baseUrl, `/unlock?session_id=${encodeURIComponent(sessionId)}`, cookie);
  assert.equal(replayExisting.status, 307);
  assert.equal(replayExisting.headers.get("location"), location);
  assert.match(replayExisting.headers.get("set-cookie") ?? "", new RegExp(`${ENTITLEMENT_COOKIE}=`));

  const invalid = await fetchManual(baseUrl, `/unlock?session_id=cs_test_invalid_${randomUUID().replaceAll("-", "")}`);
  assert.equal(invalid.status, 307);
  assert.equal(invalid.headers.get("location"), `${baseUrl.origin}/?purchase=verification-unavailable`);
  assert.equal(invalid.headers.get("set-cookie"), null);
}

async function serverIsReady(baseUrl: URL): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_500) });
    await response.arrayBuffer();
    return response.ok;
  } catch {
    return false;
  }
}

async function startNextServer(baseUrl: URL): Promise<{ child: ChildProcess; logs: () => string }> {
  assertFreshProductionBuild();
  const port = Number(baseUrl.port || TEST_DELIVERY_PORT);
  const serverEnv = paidDeliveryServerEnv(process.env);
  const child = spawn(
    process.execPath,
    [path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"), "start", "--port", String(port)],
    { cwd: process.cwd(), env: serverEnv, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  const append = (chunk: Buffer | string) => {
    output = `${output}${String(chunk)}`.slice(-12_000);
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next server exited early: ${safeMessage(output)}`);
    if (await serverIsReady(baseUrl)) return { child, logs: () => output };
    await delay(500);
  }
  child.kill("SIGTERM");
  throw new Error(`Next server did not become ready: ${safeMessage(output)}`);
}

export async function preparePaidDeliveryServer(
  baseUrl: URL,
  shouldStart: boolean,
): Promise<ChildProcess | null> {
  const ready = await serverIsReady(baseUrl);
  if (ready) {
    if (shouldStart) {
      throw new Error(`${baseUrl.origin} is already running; --start-server requires an unused port`);
    }
    return null;
  }
  if (!shouldStart) throw new Error(`${baseUrl.origin} is not running; pass --start-server or start Next first`);
  return (await startNextServer(baseUrl)).child;
}

async function stopNextServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(5_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2);
  const baseUrl = localTestBaseUrl(
    flagValue(args, "--base-url") ?? process.env.PAID_E2E_BASE_URL ?? DEFAULT_BASE_URL,
  );
  const { priceId, readKey, writeKey } = assertTestConfiguration(baseUrl);
  const stripe = new Stripe(readKey);
  const shouldStart = args.includes("--start-server");
  const shouldCreate = args.includes("--create-session");
  let startedServer: ChildProcess | null = null;

  try {
    startedServer = await preparePaidDeliveryServer(baseUrl, shouldStart);

    let sessionId = flagValue(args, "--session-id") ?? process.env.PAID_E2E_SESSION_ID;
    if (!sessionId && shouldCreate) {
      const stripeCli = flagValue(args, "--stripe-cli") ?? process.env.STRIPE_CLI_PATH ?? "stripe";
      sessionId = (await createPaidTestSession(stripe, baseUrl, priceId, writeKey, stripeCli)).id;
    }
    if (!sessionId) throw new Error("Provide PAID_E2E_SESSION_ID or pass --create-session");

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
    const issues = paidTestSessionIssues(session, priceId);
    if (issues.length > 0) throw new Error(`Stripe paid Session verification failed: ${issues.join("; ")}`);

    await verifyDelivery(baseUrl, session.id);
    console.log("Paid test delivery E2E passed: Stripe test payment -> /unlock -> secure cookie -> all four paid maps.");
    console.log("AI Compute remained fully free; fresh-browser recovery and invalid-session fail-closed checks passed.");
  } finally {
    if (startedServer) await stopNextServer(startedServer);
  }
}

const invokedDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (invokedDirectly) {
  void main().catch((error) => {
    console.error(`Paid test delivery E2E failed: ${safeMessage(error instanceof Error ? error.message : String(error))}`);
    process.exitCode = 1;
  });
}
