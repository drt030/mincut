import type { Node } from "./schema";

export type MaturityVisual = {
  /** Localized / display label for the pill ("Prototype", "Commercially available", or "—" when missing). */
  label: string;
  /** Background color for the pill. */
  bg: string;
  /** Text color for the pill. */
  fg: string;
  /** Whether the underlying node has a `maturityLabel` set (false when we are showing the faded "—" pill). */
  hasLabel: boolean;
};

// Per iter-44 a11y audit (MAJOR): 5 of 9 maturity backgrounds failed
// WCAG AA 4.5:1 with white foreground (orange #d97706 → 3.19, light-green
// #65a30d → 3.09, green #16a34a → 3.30, grey #94a3b8 → 2.56). Darkened
// each so white text passes AA. Red #dc2626 (5.94) and yellow-on-dark
// #ca8a04+#1f2933 (8.6) already passed and are unchanged.
const labelColors: Record<string, { bg: string; fg: string }> = {
  blocked: { bg: "#dc2626", fg: "#ffffff" },
  hypothesis: { bg: "#dc2626", fg: "#ffffff" },
  lab_proven: { bg: "#b45309", fg: "#ffffff" },
  prototype: { bg: "#b45309", fg: "#ffffff" },
  early_deployment: { bg: "#ca8a04", fg: "#1f2933" },
  commercially_available: { bg: "#4d7c0f", fg: "#ffffff" },
  widely_adopted: { bg: "#15803d", fg: "#ffffff" },
  mature: { bg: "#15803d", fg: "#ffffff" },
  unknown: { bg: "#475569", fg: "#ffffff" },
};

const missingColors = { bg: "#cbd5e1", fg: "#475569" };

/** Convert a snake_case maturity label into sentence case ("commercially_available" -> "Commercially available"). */
export function formatMaturityLabel(rawLabel: string): string {
  if (!rawLabel) return "—";
  const spaced = rawLabel.replace(/_/g, " ").trim();
  if (!spaced) return "—";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Resolve the visual treatment for a node's maturity label. */
export function maturityVisualFor(node: Pick<Node, "maturityLabel">): MaturityVisual {
  const raw = node.maturityLabel;
  if (!raw) {
    return { label: "—", bg: missingColors.bg, fg: missingColors.fg, hasLabel: false };
  }
  const colors = labelColors[raw] ?? missingColors;
  return { label: formatMaturityLabel(raw), bg: colors.bg, fg: colors.fg, hasLabel: true };
}

export type MaturityAsOfVisual = {
  /** Display string ("2026-04" when present, "—" when missing). */
  label: string;
  /** Whether the underlying node has a `maturityAsOf` set. */
  hasValue: boolean;
};

/**
 * Resolve the visual treatment for a node's `maturityAsOf` time stamp.
 *
 * Per ADR-0002, every maturity assessment carries an `as of` date.
 * The graph cards, NodeDetailPanel, ProductView and gate report all
 * surface that date as a small "as of YYYY-MM" pill so a learner can
 * scan when each maturity claim was last assessed. A faded "—" pill is
 * rendered when the date is missing, matching the iter-6 treatment of
 * a missing `maturityLabel`.
 */
export function maturityAsOfVisualFor(node: Pick<Node, "maturityAsOf">): MaturityAsOfVisual {
  const raw = node.maturityAsOf?.trim();
  if (!raw) return { label: "—", hasValue: false };
  return { label: raw, hasValue: true };
}
