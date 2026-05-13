"use client";

import React from "react";
import { RAMP, type ColorMode } from "@/lib/edgeStyleFor";

/**
 * Per ADR-0006 §"Chrome (toolbar)" — "Color mode + 5-stop legend:
 * bottom-left floating icon button, expands to full selector on click".
 *
 * Two states:
 *   - Collapsed: small fixed-position button anchored bottom-left.
 *     Shows the current mode's label so a returning user knows which
 *     channel is encoding the colour layer.
 *   - Expanded: 5 mode options (one per `ColorMode`) plus a 5-stop
 *     legend visualising the active mode's colour ramp. Click on an
 *     option fires `onSelect(next)`; click on the toggle bar collapses.
 *
 * The component is intentionally render-time-pure: no `useEffect`, no
 * timers, no `props.onSelect` calls from the render body. Parents
 * control the selected `mode` and `expanded` state.
 *
 * Stable test hooks (consumed by `tests/colorModeFloatingButton.test.ts`
 * + future uxSmoke integration tests):
 *   - The collapsed-state button: `data-testid="color-mode-button"`.
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
  expanded?: boolean;
  onSelect: (next: ColorMode) => void;
  onToggle?: () => void;
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

/** Short single-character glyph used as the collapsed-state icon. */
const COLLAPSED_ICON = "◐";

const FIXED_POSITION_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "16px",
  left: "16px",
  zIndex: 50,
};

const BUTTON_STYLE: React.CSSProperties = {
  ...FIXED_POSITION_STYLE,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 6,
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #1e293b",
  fontSize: 12,
  fontFamily: "inherit",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
};

const PANEL_STYLE: React.CSSProperties = {
  ...FIXED_POSITION_STYLE,
  bottom: "56px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 180,
  padding: "10px 12px",
  borderRadius: 8,
  background: "#0f172a",
  color: "#f8fafc",
  border: "1px solid #1e293b",
  fontSize: 12,
  fontFamily: "inherit",
  boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
};

const OPTION_BASE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 6px",
  borderRadius: 4,
  cursor: "pointer",
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 12,
  fontFamily: "inherit",
  textAlign: "left",
  width: "100%",
};

const OPTION_ACTIVE_STYLE: React.CSSProperties = {
  ...OPTION_BASE_STYLE,
  background: "rgba(255,255,255,0.08)",
};

const LEGEND_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: 6,
  paddingTop: 6,
  borderTop: "1px solid rgba(255,255,255,0.12)",
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
  expanded = false,
  onSelect,
  onToggle,
}: ColorModeFloatingButtonProps) {
  // Collapsed: a single fixed-position button. Pin
  // data-testid="color-mode-button" + position: fixed; bottom; left so
  // the unit test selectors match.
  if (!expanded) {
    return (
      <button
        type="button"
        data-testid="color-mode-button"
        aria-label={`Color mode: ${MODE_LABELS[mode]}`}
        aria-expanded={false}
        style={BUTTON_STYLE}
        onClick={() => onToggle?.()}
      >
        <span aria-hidden="true">{COLLAPSED_ICON}</span>
        <span>{MODE_LABELS[mode]}</span>
      </button>
    );
  }

  // Expanded: the same button at bottom-left + a panel above with 5
  // option buttons and a 5-stop legend below.
  const swatches = rampForMode(mode);

  return (
    <>
      <button
        type="button"
        data-testid="color-mode-button"
        aria-label={`Color mode: ${MODE_LABELS[mode]}`}
        aria-expanded={true}
        style={BUTTON_STYLE}
        onClick={() => onToggle?.()}
      >
        <span aria-hidden="true">{COLLAPSED_ICON}</span>
        <span>{MODE_LABELS[mode]}</span>
      </button>
      <div style={PANEL_STYLE} role="group" aria-label="Color mode selector">
        {ALL_MODES.map((option) => {
          const active = option === mode;
          return (
            <button
              key={option}
              type="button"
              data-mode={option}
              aria-pressed={active}
              style={active ? OPTION_ACTIVE_STYLE : OPTION_BASE_STYLE}
              onClick={() => onSelect(option)}
            >
              <span
                aria-hidden="true"
                style={{
                  ...SWATCH_BASE_STYLE,
                  background:
                    option === "relation" ? "#94a3b8" : RAMP[2],
                }}
              />
              <span>{MODE_LABELS[option]}</span>
            </button>
          );
        })}
        <div style={LEGEND_ROW_STYLE} aria-label="Active mode color ramp">
          {swatches.map((color, i) => (
            <span
              key={`${mode}-${i}-${color}`}
              data-testid="color-mode-swatch"
              style={{ ...SWATCH_BASE_STYLE, background: color }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
