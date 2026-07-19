import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("client language dictionary contains no organization identity records", () => {
  const source = fs.readFileSync(new URL("../src/components/LanguageProvider.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /^\s*"?org_[a-z0-9_]+"?\s*:/m);
  assert.match(source, /client dictionary is public and must never carry paid exposure identities/);
});

test("production builds run the client paid-layer leak guard", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.["check:client-paid-leaks"], "tsx scripts/check-client-paid-leaks.ts");
  assert.match(packageJson.scripts?.postbuild ?? "", /npm run check:client-paid-leaks/);
  assert.match(packageJson.scripts?.postbuild ?? "", /npm run check:paid-launch/);
});
