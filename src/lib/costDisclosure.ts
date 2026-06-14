import type { MetricValue, Node } from "./schema";

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

function compactReason(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const sentence = trimmed.match(/^.*?[.!?。！？](?:\s|$)/)?.[0].trim() ?? trimmed;
  if (sentence.length <= maxLength) return sentence;
  return `${sentence.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}
