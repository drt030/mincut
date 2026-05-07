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

const labelColors: Record<string, { bg: string; fg: string }> = {
  blocked: { bg: "#dc2626", fg: "#ffffff" },
  hypothesis: { bg: "#dc2626", fg: "#ffffff" },
  lab_proven: { bg: "#d97706", fg: "#ffffff" },
  prototype: { bg: "#d97706", fg: "#ffffff" },
  early_deployment: { bg: "#ca8a04", fg: "#1f2933" },
  commercially_available: { bg: "#65a30d", fg: "#ffffff" },
  widely_adopted: { bg: "#16a34a", fg: "#ffffff" },
  mature: { bg: "#16a34a", fg: "#ffffff" },
  unknown: { bg: "#94a3b8", fg: "#ffffff" },
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
