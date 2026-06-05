"use client";

import React from "react";
import { RAMP, type ColorMode } from "@/lib/edgeStyleFor";

/**
 * Per ADR-0006 §"Chrome (toolbar)" with the 2026-05-31 UX correction:
 * color mode is persistent graph chrome. The edge-colouring options stay
 * visible because hiding them behind an icon made the analysis modes too
 * easy to miss.
 *
 * The control renders all 5 mode options (one per `ColorMode`) plus a
 * 5-stop legend visualising the active mode's colour ramp. Click on an
 * option fires `onSelect(next)`.
 *
 * The component is intentionally render-time-pure: no `useEffect`, no
 * timers, no `props.onSelect` calls from the render body. Parents
 * control the selected `mode`.
 *
 * Stable test hooks (consumed by `tests/colorModeFloatingButton.test.ts`
 * + future uxSmoke integration tests):
 *   - The persistent surface: `data-testid="color-mode-control"`.
 *   - Legacy surface hook retained: `data-testid="color-mode-button"`.
 *   - Each mode option: `data-mode="<modeId>"`.
 *   - Each swatch in the 5-stop legend: `data-testid="color-mode-swatch"`.
 *
 * The CSS for the floating-button surface lives inline so the component
 * is self-contained and survives ReactFlow's viewport transform (which
 * applies to nodes/edges but not to fixed-position chrome outside the
 * canvas tree). Position is `fixed; bottom: 16px; left: 16px` per the
 * ADR.
 */

export type ColorModeFloatingButtonProps = {
  mode: ColorMode;
  onSelect: (next: ColorMode) => void;
};

/**
 * Canonical mode order — matches the ADR's listing. Used for both the
 * collapsed button label resolution and the expanded option list.
 */
const ALL_MODES: readonly ColorMode[] = [
  "bottleneck-risk",
  "cost",
  "maturity",
  "overall",
  "relation",
];

/** English labels used in the rendered UI. The unit tests match
 *  loosely (case-insensitive substring) so these copy strings can be
 *  retuned without breaking the contract. */
const MODE_LABELS: Record<ColorMode, string> = {
  "bottleneck-risk": "Bottleneck risk",
  cost: "Cost",
  maturity: "Maturity",
  overall: "Overall",
  relation: "Relation",
};

const FIXED_POSITION_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "16px",
  left: "16px",
  zIndex: 50,
};

const CONTROL_STYLE: React.CSSProperties = {
  ...FIXED_POSITION_STYLE,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
  maxWidth: "calc(100vw - 32px)",
  padding: "8px 10px",
  borderRadius: 8,
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #1e293b",
  fontSize: 12,
  fontFamily: "inherit",
  boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
};

const OPTION_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6,
};

const OPTION_BASE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  minHeight: 28,
  padding: "5px 10px",
  borderRadius: 4,
  cursor: "pointer",
  border: "1px solid rgba(148,163,184,0.34)",
  background: "rgba(15,23,42,0.68)",
  color: "inherit",
  fontSize: 12,
  fontFamily: "inherit",
  textAlign: "center",
};

const OPTION_ACTIVE_STYLE: React.CSSProperties = {
  ...OPTION_BASE_STYLE,
  background: "#f8fafc",
  color: "#0f172a",
  border: "1px solid #f8fafc",
};

const LEGEND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  paddingTop: 2,
  borderTop: "1px solid rgba(255,255,255,0.12)",
  color: "#cbd5e1",
  fontSize: 11,
};

const LEGEND_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 700,
  marginRight: 4,
};

const LEGEND_ENDPOINT_STYLE: React.CSSProperties = {
  opacity: 0.82,
};

const SWATCH_BASE_STYLE: React.CSSProperties = {
  display: "inline-block",
  width: 16,
  height: 12,
  borderRadius: 2,
  border: "1px solid rgba(0,0,0,0.18)",
};

/**
 * Compute the 5-stop ramp shown in the expanded-state legend. For the
 * graded modes we reuse the global `RAMP` from `edgeStyleFor`. For
 * `relation` mode the 5 stops are all neutral grey — there is no
 * mode-encoded gradient.
 */
function rampForMode(mode: ColorMode): readonly string[] {
  if (mode === "relation") {
    return ["#94a3b8", "#94a3b8", "#94a3b8", "#94a3b8", "#94a3b8"];
  }
  return RAMP;
}

export function ColorModeFloatingButton({
  mode,
  onSelect,
}: ColorModeFloatingButtonProps) {
  const swatches = rampForMode(mode);

  return (
    <div
      data-testid="color-mode-control"
      style={CONTROL_STYLE}
      role="group"
      aria-label={`Color mode selector. Current mode: ${MODE_LABELS[mode]}`}
    >
      <div
        data-testid="color-mode-button"
        style={OPTION_ROW_STYLE}
        role="group"
        aria-label="Color mode options"
      >
        {ALL_MODES.map((option) => {
          const active = option === mode;
          return (
            <button
              key={option}
              type="button"
              data-mode={option}
              aria-pressed={active}
              aria-label={`Color mode: ${MODE_LABELS[option]}`}
              style={active ? OPTION_ACTIVE_STYLE : OPTION_BASE_STYLE}
              onClick={() => onSelect(option)}
            >
              <span>{MODE_LABELS[option]}</span>
            </button>
          );
        })}
      </div>
      <div style={LEGEND_ROW_STYLE} aria-label="Legend: active mode color ramp from low to high">
        <span style={LEGEND_LABEL_STYLE}>Legend</span>
        <span style={LEGEND_ENDPOINT_STYLE}>Low</span>
        {swatches.map((color, i) => (
          <span
            key={`${mode}-${i}-${color}`}
            data-testid="color-mode-swatch"
            aria-hidden="true"
            style={{ ...SWATCH_BASE_STYLE, background: color }}
          />
        ))}
        <span style={LEGEND_ENDPOINT_STYLE}>High</span>
      </div>
    </div>
  );
}
