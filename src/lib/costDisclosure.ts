import type { MetricValue, Node } from "./schema";
import { readerFacingNote } from "./readerFacingText";

type Translator = (key: string) => string;

type CostDisclosureOptions = {
  includeReason?: boolean;
  maxReasonLength?: number;
};

type NodeMetric = NonNullable<Node["metrics"]>[number];

export function hasCostDisclosure(node: Node): boolean {
  return Boolean(costDisclosureMetric(node));
}

export function costDisclosureText(
  node: Node,
  t: Translator,
  options: CostDisclosureOptions = {},
): string | null {
  const metric = costDisclosureMetric(node);
  if (!metric) return null;

  const status = statusText(metric.currentValue, t);
  if (!options.includeReason || !metric.description) return status;

  const reason = compactReason(metric.description, options.maxReasonLength ?? 120);
  return reason ? `${status}: ${reason}` : status;
}

export function costEvidenceNeedText(node: Node, t: Translator): string {
  const metric = costDisclosureMetric(node);
  const haystack = [
    node.id,
    node.name,
    node.description,
    ...(node.tags ?? []),
    metric?.name,
    metric?.unit,
    typeof metric?.currentValue === "string" ? metric.currentValue : null,
    metric?.description,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (hasAny(haystack, ["qualification", "qualified", "lifetime", "durability", "replacement", "reserve"])) {
    return t("readerCostNeedQualification");
  }
  if (hasAny(haystack, ["utilization", "unit economics", "business model", "demand", "revenue", "payback"])) {
    return t("readerCostNeedUnitEconomics");
  }
  if (hasAny(haystack, ["launch", "$/kg", "per kg", "per kw", "mass to orbit", "kg to orbit"])) {
    return t("readerCostNeedLaunchEconomics");
  }
  if (hasAny(haystack, ["capacity", "capex", "capital", "factory", "line", "tooling", "expansion", "commissioning"])) {
    return t("readerCostNeedCapacityCapex");
  }
  if (hasAny(haystack, ["bom", "quote", "quoted", "supplier", "price", "pricing", "asp", "component"])) {
    return t("readerCostNeedPriceBom");
  }
  return t("readerCostMissingReviewedSource");
}

function costDisclosureMetric(node: Node): NodeMetric | null {
  return (node.metrics ?? []).find((metric) => {
    if (typeof metric.currentValue !== "string") return false;
    const name = metric.name.toLowerCase();
    const unit = metric.unit?.toLowerCase() ?? "";
    return name.includes("cost") || unit.includes("cost") || unit.includes("audit status");
  }) ?? null;
}

function statusText(value: MetricValue | undefined, t: Translator): string {
  if (typeof value !== "string") return t("readerCostNotModeled");
  const normalized = value.toLowerCase();
  if (
    normalized.includes("not priceable") ||
    normalized.includes("no reviewed public value") ||
    normalized.includes("unknown")
  ) {
    return t("readerCostNotModeled");
  }
  return value.trim() || t("readerCostNotModeled");
}

function hasAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function compactReason(text: string, maxLength: number): string {
  const trimmed = readerFacingNote(text);
  if (!trimmed) return "";
  const sentence = trimmed.match(/^.*?[.!?。！？](?:\s|$)/)?.[0].trim() ?? trimmed;
  if (sentence.length <= maxLength) return sentence;
  return `${sentence.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
