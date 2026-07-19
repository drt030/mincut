import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ESLint ignores every isolated Next build directory", () => {
  const config = fs.readFileSync(new URL("../eslint.config.mjs", import.meta.url), "utf8");

  assert.match(
    config,
    /["']\.next-\*\/\*\*["']/,
    "NEXT_DIST_DIR builds such as .next-hydration must not break release lint",
  );
});
