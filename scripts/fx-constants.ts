/**
 * 2025 mid-market FX rates → RMB, used by `src/lib/costRollup.ts`.
 * Reviewed annually (last reviewed: 2026-05-07). Per ADR-0003 the rollup
 * converts to RMB at sum time; original-currency values stay on the metric
 * for traceability. A 15%+ FX move within one year forces a mid-cycle
 * revisit — see ADR-0003 "Revisit when".
 */

export const FX_TO_RMB_2025 = {
  RMB: 1,
  USD: 7.20,
  EUR: 7.85,
  JPY: 0.048,
} as const;

export type FxCurrency = keyof typeof FX_TO_RMB_2025;

export function toRmb(value: number, currency: FxCurrency = "RMB"): number {
  return value * FX_TO_RMB_2025[currency];
}

export function rangeToRmb(
  range: { min: number; typical: number; max: number },
  currency: FxCurrency = "RMB",
): { min: number; typical: number; max: number } {
  return {
    min: toRmb(range.min, currency),
    typical: toRmb(range.typical, currency),
    max: toRmb(range.max, currency),
  };
}
