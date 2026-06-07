import test from "node:test";
import assert from "node:assert/strict";
import { formatMetricValue } from "../src/lib/metricValueFormat";

test("range metric display leads with p50 and keeps range in full form", () => {
  const formatted = formatMetricValue({ min: 14_000, typical: 26_000, max: 45_000 }, "RMB", "RMB");

  assert.equal(formatted.compact, "p50 26k RMB");
  assert.equal(formatted.full, "p50 26,000 (range 14,000–45,000) RMB");
  assert.equal(formatted.isRange, true);
});

test("RMB range full display rounds fractional rollups to whole yuan", () => {
  const formatted = formatMetricValue(
    { min: 160_432.762, typical: 309_994.288, max: 550_279.888 },
    "RMB",
    "RMB",
  );

  assert.equal(formatted.full, "p50 309,994 (range 160,433–550,280) RMB");
});

test("currency display preserves decimals for million and billion unit metrics", () => {
  const formatted = formatMetricValue(17.788, "EUR billion", "EUR");

  assert.equal(formatted.full, "17.788 EUR billion");
});

test("non-currency range full display preserves meaningful fractional values", () => {
  const formatted = formatMetricValue({ min: 98, typical: 99, max: 99.5 }, "%");

  assert.equal(formatted.full, "p50 99 (range 98–99.5) %");
});

test("degenerate range metric still collapses to scalar display", () => {
  const formatted = formatMetricValue({ min: 26_000, typical: 26_000, max: 26_000 }, "RMB", "RMB");

  assert.equal(formatted.compact, "26k RMB");
  assert.equal(formatted.full, "26,000 RMB");
});
