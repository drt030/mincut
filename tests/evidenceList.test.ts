import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceList } from "../src/components/EvidenceList";
import type { Evidence } from "../src/lib/schema";

const evidence: Evidence[] = [
  {
    id: "ev_public_sanitize",
    type: "vendor_claim",
    title: "Vendor capacity note",
    sourceName: "Vendor",
    summary: "Claim is useful but unreviewed.",
    limitations: "Company blog; claims remain unreviewed vendor claims and need human review.",
    confidence: "medium",
    reviewStatus: "unreviewed",
  },
];

test("EvidenceList public mode preserves caveats without exposing raw review state", () => {
  const html = renderToStaticMarkup(React.createElement(EvidenceList, { evidence }));

  assert.match(html, /Vendor capacity note/);
  assert.match(html, /confidence.*medium/i);
  assert.match(html, /not independently validated vendor claims/i);
  assert.match(html, /pending independent validation/i);
  assert.doesNotMatch(html, /Status.*unreviewed/i);
  assert.doesNotMatch(html, /reviewStatus|unreviewed|needs human review|needs review/i);
});

test("EvidenceList internal mode can still expose raw review bookkeeping", () => {
  const html = renderToStaticMarkup(
    React.createElement(EvidenceList, { evidence, showInternalReviewState: true }),
  );

  assert.match(html, /Status.*unreviewed/i);
  assert.match(html, /unreviewed vendor claims/i);
  assert.match(html, /need human review/i);
});
