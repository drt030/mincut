import type { MetricValue } from "./schema";

/**
 * Per ADR-0003 a metric value can be:
 *   - a scalar `number`,
 *   - an opaque `string` (e.g. "100×80×60 cm"),
 *   - or a `{min, typical, max}` range (typical for cost-bearing metrics
 *     where supplier variance is honest signal).
 *
 * This helper is the single rendering surface for those three shapes, used
 * by the metric-fold strip, NodeDetailPanel metric list, and ProductView
 * key-metrics card. Two render modes:
 *
 *   - `compact`: short string for the strip chips (target <=24 chars). For
 *     non-degenerate ranges this leads with an estimate marker, e.g.
 *     `"est. 150k RMB"`.
 *     Numbers >=10k are abbreviated with a `k`/`M` suffix; smaller numbers
 *     use locale grouping.
 *   - `full`: human-readable string for the detail panels. For ranges this
 *     reads `"est. 150,000 (range 120,000–180,000) RMB"`. Currencies other
 *     than RMB are surfaced in the suffix; RMB-as-unit is implicit (RMB shows
 *     because the unit string already contains it). Non-currency units pass
 *     through verbatim.
 *
 * The helper intentionally does NOT do FX conversion — the rollup walker
 * already converts at sum time, but per-metric display keeps the
 * authored currency for traceability (ADR-0003).
 */

export type MetricValueDisplay = {
  /** Short form for graph-card chips. */
  compact: string;
  /** Full form for detail panels. */
  full: string;
  /** True iff the underlying value is a `{min, typical, max}` range. */
  isRange: boolean;
};

const RMB_DEFAULT = "RMB";

export function formatMetricValue(
  value: MetricValue | undefined,
  unit?: string,
  currency?: string,
): MetricValueDisplay {
  if (value === undefined || value === null) {
    return { compact: "—", full: "—", isRange: false };
  }
  if (typeof value === "string") {
    const text = value.trim() || "—";
    return { compact: text, full: text, isRange: false };
  }
  const suffix = displaySuffix(unit, currency);
  const wholeNumberFull = shouldUseWholeNumberFullDisplay(unit, currency);
  if (typeof value === "number") {
    return {
      compact: appendSuffix(formatNumberCompact(value), suffix),
      full: appendSuffix(formatNumberFull(value, wholeNumberFull), suffix),
      isRange: false,
    };
  }
  // Range: {min, typical, max}.
  const { min, typical, max } = value;
  const compactBody = formatRangeCompact(min, typical, max);
  const fullBody = formatRangeFull(min, typical, max, wholeNumberFull);
  return {
    compact: appendSuffix(compactBody, suffix),
    full: appendSuffix(fullBody, suffix),
    isRange: true,
  };
}

/** Convenience for callers that only want the compact form. */
export function formatMetricValueCompact(
  value: MetricValue | undefined,
  unit?: string,
  currency?: string,
): string {
  return formatMetricValue(value, unit, currency).compact;
}

/** Convenience for callers that only want the full form. */
export function formatMetricValueFull(
  value: MetricValue | undefined,
  unit?: string,
  currency?: string,
): string {
  return formatMetricValue(value, unit, currency).full;
}

function displaySuffix(unit: string | undefined, currency: string | undefined): string {
  // Prefer explicit unit when present (e.g. "parcels/hr", "USD/kg", "RMB").
  // Currency is shown only when non-default RMB and not already implied by
  // the unit string. RMB is implicit because almost everything in the v0
  // graph is RMB-priced; we still print "RMB" via the unit string when the
  // metric authored it explicitly.
  const cleanedUnit = unit?.trim();
  if (cleanedUnit) return cleanedUnit;
  const cleanedCurrency = currency?.trim();
  if (cleanedCurrency && cleanedCurrency.toUpperCase() !== RMB_DEFAULT) return cleanedCurrency;
  return "";
}

function appendSuffix(body: string, suffix: string): string {
  if (!suffix) return body;
  return `${body} ${suffix}`;
}

function formatNumberCompact(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimTrailingZeros((n / 1_000_000).toFixed(1))}M`;
  if (abs >= 10_000) return `${trimTrailingZeros((n / 1_000).toFixed(1))}k`;
  if (abs >= 1) return n.toLocaleString("en-US");
  return String(n);
}

function formatNumberFull(n: number, wholeNumber: boolean = false): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 1) {
    return wholeNumber
      ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
      : n.toLocaleString("en-US");
  }
  return String(n);
}

function formatRangeCompact(min: number, typical: number, max: number): string {
  // If min === typical === max, collapse to a single scalar form.
  if (min === typical && typical === max) return formatNumberCompact(typical);
  // If min === max, collapse to a scalar (degenerate range).
  if (min === max) return formatNumberCompact(typical);
  return `est. ${formatNumberCompact(typical)}`;
}

function formatRangeFull(min: number, typical: number, max: number, wholeNumber: boolean = false): string {
  if (min === typical && typical === max) return formatNumberFull(typical, wholeNumber);
  if (min === max) return formatNumberFull(typical, wholeNumber);
  return `est. ${formatNumberFull(typical, wholeNumber)} (range ${formatNumberFull(min, wholeNumber)}–${formatNumberFull(max, wholeNumber)})`;
}

function trimTrailingZeros(value: string): string {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function shouldUseWholeNumberFullDisplay(unit: string | undefined, currency: string | undefined): boolean {
  const normalizedUnit = unit?.trim().toUpperCase() ?? "";
  const normalizedCurrency = currency?.trim().toUpperCase() ?? "";
  if (normalizedUnit.includes("MILLION") || normalizedUnit.includes("BILLION")) return false;
  return normalizedCurrency.length > 0 || normalizedUnit.includes("RMB") || normalizedUnit.includes("USD") || normalizedUnit.includes("EUR") || normalizedUnit.includes("JPY");
}

/**
 * Per ADR-0003 the year a cost (or other time-sensitive) metric was stated
 * in. Surfaced as a small grey "as-of" pill on cost-bearing metric chips
 * and detail rows, parallel to the iter-7 `maturityAsOf` pill.
 */
export type CostAsOfVisual = {
  label: string;
  hasValue: boolean;
};

export function costAsOfVisualFor(year: string | undefined): CostAsOfVisual {
  const raw = year?.trim();
  if (!raw) return { label: "—", hasValue: false };
  return { label: raw, hasValue: true };
}
