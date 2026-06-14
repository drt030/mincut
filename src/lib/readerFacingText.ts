export function readerFacingNote(notes: string | null | undefined): string {
  return (notes ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*transactability=(?:must_build|procurable)[^.。]*(?:[.。]|$)/gi, " ")
    .replace(/\s*listing backfill \d{4}-\d{2}-\d{2}[^.。]*(?:[.。]|$)/gi, " ")
    .replace(/\s*\([^)]*\bagent backfill\b[^)]*\)/gi, " ")
    .replace(/\baudit-only\b/gi, "graph-linked")
    .replace(/\bunder audit\b/gi, "in preview")
    .replace(/\bno reviewed source\b/gi, "no public source")
    .replace(/\breviewed price\/BOM\b/gi, "price/BOM")
    .replace(/\breviewed public value\b/gi, "public value")
    .replace(/\bunreviewed\b/gi, "not independently validated")
    .replace(/\bneeds review\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function readerFacingStartupOpportunity(notes: string | null | undefined): string {
  const marker = "Startup opportunity:";
  const index = (notes ?? "").indexOf(marker);
  if (index === -1) return "";
  return readerFacingNote((notes ?? "").slice(index));
}

export type ReaderFacingCostAnswer = {
  primary: string;
  secondary?: string;
  full?: string;
};

export function readerFacingCostAnswer({
  valueText,
  disclosureText,
  fallback,
  disclosurePrimary,
  disclosureSecondary,
}: {
  valueText?: string | null;
  disclosureText?: string | null;
  fallback: string;
  disclosurePrimary: string;
  disclosureSecondary: string;
}): ReaderFacingCostAnswer {
  if (valueText) return { primary: valueText };
  if (disclosureText) {
    return {
      primary: disclosurePrimary,
      secondary: disclosureSecondary,
      full: disclosureText,
    };
  }
  return { primary: fallback };
}

export function readerFacingConstraintReason(description: string | null | undefined): string {
  const cleaned = readerFacingNote(description);
  if (!cleaned) return "";
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return (
    sentences.find((sentence) =>
      /\b(bottleneck|gate|gates|limit|limits|constrain|constrains|constraint|depends|decide|decides|central|needed|unresolved|shortens)\b/i
        .test(sentence),
    ) ??
    sentences[0] ??
    ""
  );
}
