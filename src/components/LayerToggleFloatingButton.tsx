"use client";

import React from "react";
import type { GraphLayer } from "@/lib/knowHowLayer";

/**
 * Per ADR-0008: floating layer switch for the /graph canvas. Sits in
 * the bottom-left control column. The toggle is a lens, not a
 * navigation: positions stay fixed, only node visibility/styling
 * changes (ADR-0007 stable identity).
 *
 * Labels arrive via props (caller translates with `t()`), so the
 * component renders standalone in unit tests without a
 * LanguageProvider in scope — same reason RadialNode takes `zoom` as
 * a prop instead of subscribing to the store.
 */
export type LayerToggleFloatingButtonProps = {
  layer: GraphLayer;
  onSelect: (next: GraphLayer) => void;
  labels: { toggle: string; product: string; knowHow: string };
};

const WRAPPER_STYLE: React.CSSProperties = {
  position: "fixed",
  bottom: "96px",
  left: "16px",
  zIndex: 50,
};

const CONTROL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 8,
  borderRadius: 8,
  background: "#0f172a",
};

const OPTION_BASE_STYLE: React.CSSProperties = {
  minHeight: 28,
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid transparent",
  background: "transparent",
  color: "#cbd5e1",
  fontSize: 12,
  textAlign: "left",
  cursor: "pointer",
};

const OPTION_ACTIVE_STYLE: React.CSSProperties = {
  ...OPTION_BASE_STYLE,
  background: "#1e293b",
  border: "1px solid #475569",
  color: "#f8fafc",
};

export function LayerToggleFloatingButton({ layer, onSelect, labels }: LayerToggleFloatingButtonProps) {
  const options: { value: GraphLayer; label: string }[] = [
    { value: "product", label: labels.product },
    { value: "knowhow", label: labels.knowHow },
  ];
  return (
    <div style={WRAPPER_STYLE} data-testid="layer-toggle" aria-label={labels.toggle}>
      <div style={CONTROL_STYLE}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-layer-option={option.value}
            aria-pressed={layer === option.value}
            style={layer === option.value ? OPTION_ACTIVE_STYLE : OPTION_BASE_STYLE}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default LayerToggleFloatingButton;
