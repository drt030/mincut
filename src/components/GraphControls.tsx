"use client";

import React from "react";
import { RAMP, WIDTHS, type ColorMode } from "@/lib/edgeStyleFor";
import type { RouteMode } from "@/lib/routeHighlight";
import { useLanguage } from "./LanguageProvider";

export type GraphControlsProps = {
  routeMode: RouteMode;
  analysisMode: ColorMode;
  onAnalysisModeChange: (next: ColorMode) => void;
};

const ROUTE_LABELS: Record<RouteMode, string> = {
  "cost-drivers": "Cost drivers",
};

const ZH_ROUTE_LABELS: Record<RouteMode, string> = {
  "cost-drivers": "成本驱动",
};

type VisibleAnalysisMode = "relation" | "cost" | "bottleneck-risk" | "maturity";

const ANALYSIS_MODE_OPTIONS: readonly VisibleAnalysisMode[] = [
  "relation",
  "cost",
  "bottleneck-risk",
  "maturity",
];

const ANALYSIS_MODE_LABELS: Record<ColorMode, string> = {
  cost: "Cost drivers",
  "bottleneck-risk": "Bottleneck risk",
  maturity: "Maturity",
  overall: "Overall",
  relation: "System decomposition",
};

const ZH_ANALYSIS_MODE_LABELS: Record<ColorMode, string> = {
  cost: "成本驱动",
  "bottleneck-risk": "瓶颈风险",
  maturity: "成熟度",
  overall: "综合",
  relation: "系统分解",
};

type LensLegendCopy = {
  title: string;
  summary: string;
  low: string;
  high: string;
  edgeLabel: string;
  edgeValue: string;
};

const LENS_LEGEND_COPY: Record<VisibleAnalysisMode, LensLegendCopy> = {
  relation: {
    title: "Legend",
    summary: "Structure only: no cost, risk, or maturity signal.",
    low: "Dependency",
    high: "Structure",
    edgeLabel: "Neutral edges",
    edgeValue: "requires links between product parts",
  },
  cost: {
    title: "Legend",
    summary: "Wider = cost burden.",
    low: "Lower",
    high: "Higher",
    edgeLabel: "Edge color + width",
    edgeValue: "target node cost burden",
  },
  "bottleneck-risk": {
    title: "Legend",
    summary: "Wider = bottleneck risk.",
    low: "Low risk",
    high: "Critical",
    edgeLabel: "Edge color + width",
    edgeValue: "target node can block scale, cost, or adoption",
  },
  maturity: {
    title: "Legend",
    summary: "Wider = maturity gap.",
    low: "Mature",
    high: "Least mature",
    edgeLabel: "Edge color + width",
    edgeValue: "target node maturity, reversed so warm means less proven",
  },
};

const ZH_LENS_LEGEND_COPY: Record<VisibleAnalysisMode, LensLegendCopy> = {
  relation: {
    title: "图例",
    summary: "只看结构：不表达成本、风险或成熟度。",
    low: "依赖",
    high: "结构",
    edgeLabel: "中性线条",
    edgeValue: "产品部件之间的 requires 关系",
  },
  cost: {
    title: "图例",
    summary: "线越粗 = 成本负担。",
    low: "较低",
    high: "较高",
    edgeLabel: "线条颜色 + 粗细",
    edgeValue: "下游节点的成本负担",
  },
  "bottleneck-risk": {
    title: "图例",
    summary: "线越粗 = 瓶颈风险。",
    low: "低风险",
    high: "关键瓶颈",
    edgeLabel: "线条颜色 + 粗细",
    edgeValue: "下游节点可能卡住扩产、成本或采用",
  },
  maturity: {
    title: "图例",
    summary: "线越粗 = 成熟度缺口。",
    low: "成熟",
    high: "最不成熟",
    edgeLabel: "线条颜色 + 粗细",
    edgeValue: "下游节点成熟度，已反向编码：暖色表示更不成熟",
  },
};

function visibleAnalysisMode(mode: ColorMode): VisibleAnalysisMode {
  if (mode === "relation" || mode === "bottleneck-risk" || mode === "maturity") return mode;
  return "cost";
}

function LensLegend({
  mode,
  copy,
}: {
  mode: ColorMode;
  copy: Record<VisibleAnalysisMode, LensLegendCopy>;
}) {
  const activeMode = visibleAnalysisMode(mode);
  const legend = copy[activeMode];
  const showEncodedLegend = activeMode !== "relation";
  return (
    <div
      className="lens-legend"
      data-testid="lens-legend"
      data-lens-mode={activeMode}
      title={`${legend.summary} ${legend.edgeValue}`}
    >
      <div className="lens-legend-heading">
        <span>{legend.title}</span>
        <strong>{legend.summary}</strong>
      </div>
      {showEncodedLegend ? (
        <>
          <div className="lens-legend-widths" aria-hidden="true">
            {RAMP.map((color, index) => (
              <span key={`${color}-${WIDTHS[index]}`} data-testid="lens-legend-width-sample">
                <i
                  style={{
                    backgroundColor: color,
                    height: Math.max(2, WIDTHS[index]),
                  }}
                />
              </span>
            ))}
          </div>
          <div className="lens-legend-scale">
            <span>{legend.low}</span>
            <span>{legend.high}</span>
          </div>
          <dl className="lens-legend-rows">
            <div>
              <dt>{legend.edgeLabel}</dt>
              <dd>{legend.edgeValue}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </div>
  );
}

export function GraphControls({
  routeMode,
  analysisMode,
  onAnalysisModeChange,
}: GraphControlsProps) {
  const { language } = useLanguage();
  const copy = language === "zh"
    ? {
      map: "地图",
      lens: "视角",
      fullSystem: "完整系统",
      routeLabel: ZH_ROUTE_LABELS[routeMode],
      modeLabels: ZH_ANALYSIS_MODE_LABELS,
      legend: ZH_LENS_LEGEND_COPY,
    }
    : {
      map: "Map",
      lens: "Lens",
      fullSystem: "Full system",
      routeLabel: ROUTE_LABELS[routeMode],
      modeLabels: ANALYSIS_MODE_LABELS,
      legend: LENS_LEGEND_COPY,
    };
  return (
    <div
      className="graph-controls"
      data-testid="graph-controls"
      role="group"
      aria-label="Graph view controls"
    >
      <div className="graph-controls-section">
        <div className="graph-controls-label">{copy.lens}</div>
        {ANALYSIS_MODE_OPTIONS.map((mode) => {
          const active = mode === analysisMode;
          const isCostRoute = mode === "cost";
          return (
            <button
              key={mode}
              type="button"
              className={["graph-control-button", active ? "active" : ""].filter(Boolean).join(" ")}
              data-analysis-mode={mode}
              aria-pressed={active}
              onClick={() => onAnalysisModeChange(mode)}
            >
              <span className="graph-control-icon lens" aria-hidden="true" />
              <span>{isCostRoute ? copy.routeLabel : copy.modeLabels[mode]}</span>
            </button>
          );
        })}
      </div>
      <LensLegend mode={analysisMode} copy={copy.legend} />
    </div>
  );
}
