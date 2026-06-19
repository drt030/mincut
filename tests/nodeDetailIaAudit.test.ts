import test from "node:test";
import assert from "node:assert/strict";
import { auditNodeDetailIa } from "../src/lib/nodeDetailIaAudit";
import type { GraphData } from "../src/lib/schema";

test("node detail IA audit flags missing role copy and weak supplier card inputs", () => {
  const graph: GraphData = {
    graphVersion: "fixture",
    nodes: [
      {
        id: "product",
        name: "Product",
        kind: "product",
        domain: ["fixture"],
      },
      {
        id: "module",
        name: "Module",
        kind: "module",
        domain: ["fixture"],
        description: "Module role sentence.",
      },
      {
        id: "org",
        name: "Listed supplier",
        kind: "organization",
        domain: ["fixture"],
        listingStatus: "public",
      },
    ],
    edges: [
      {
        id: "e_product_module",
        source: "product",
        target: "module",
        relation: "requires",
      },
      {
        id: "e_module_org",
        source: "module",
        target: "org",
        relation: "manufactured_by",
      },
    ],
    evidence: [],
  };

  const issues = auditNodeDetailIa(graph, { domainSlug: "fixture", rootId: "product" });
  const kinds = issues.map((issue) => issue.kind);

  assert.ok(kinds.includes("missing_description"), "product missing description should be reported");
  assert.ok(kinds.includes("supplier_org_missing_ticker"), "public supplier without ticker should be reported");
  assert.ok(kinds.includes("supplier_edge_missing_association_basis"), "supplier edge without claim/context should be reported");
  assert.ok(kinds.includes("supplier_edge_missing_evidence"), "supplier edge without evidence should be reported");
});

test("node detail IA audit flags supplier edges that point at missing organization nodes", () => {
  const graph: GraphData = {
    graphVersion: "fixture",
    nodes: [
      {
        id: "product",
        name: "Product",
        kind: "product",
        domain: ["fixture"],
        description: "Product role sentence.",
      },
      {
        id: "module",
        name: "Module",
        kind: "module",
        domain: ["fixture"],
        description: "Module role sentence.",
      },
    ],
    edges: [
      {
        id: "e_product_module",
        source: "product",
        target: "module",
        relation: "requires",
      },
      {
        id: "e_module_missing_org",
        source: "module",
        target: "org_missing",
        relation: "manufactured_by",
        claim: "Missing organization manufactures this module.",
        evidenceIds: ["ev_supplier"],
      },
    ],
    evidence: [
      {
        id: "ev_supplier",
        type: "product_page",
        title: "Supplier product page",
        url: "https://example.com/supplier",
        sourceStatus: "fetch_ok",
        reviewStatus: "unreviewed",
        confidence: "medium",
      },
    ],
  };

  const issues = auditNodeDetailIa(graph, { domainSlug: "fixture", rootId: "product" });
  assert.deepEqual(
    issues.map((issue) => issue.kind),
    ["supplier_edge_missing_org"],
  );
});

test("node detail IA audit accepts claim, ticker, and active evidence for supplier cards", () => {
  const graph: GraphData = {
    graphVersion: "fixture",
    nodes: [
      {
        id: "product",
        name: "Product",
        kind: "product",
        domain: ["fixture"],
        description: "Product role sentence.",
      },
      {
        id: "module",
        name: "Module",
        kind: "module",
        domain: ["fixture"],
        description: "Module role sentence.",
      },
      {
        id: "org",
        name: "Listed supplier",
        kind: "organization",
        domain: ["fixture"],
        listingStatus: "public",
        ticker: "SUP",
      },
    ],
    edges: [
      {
        id: "e_product_module",
        source: "product",
        target: "module",
        relation: "requires",
      },
      {
        id: "e_module_org",
        source: "module",
        target: "org",
        relation: "manufactured_by",
        claim: "Listed supplier manufactures this module.",
        evidenceIds: ["ev_supplier"],
      },
    ],
    evidence: [
      {
        id: "ev_supplier",
        type: "product_page",
        title: "Supplier product page",
        url: "https://example.com/supplier",
        sourceStatus: "fetch_ok",
        reviewStatus: "unreviewed",
        confidence: "medium",
      },
    ],
  };

  const issues = auditNodeDetailIa(graph, { domainSlug: "fixture", rootId: "product" });
  assert.deepEqual(issues.map((issue) => issue.kind), []);
});

test("node detail IA audit does not require obsolete tickers for delisted subsidiaries", () => {
  const graph: GraphData = {
    graphVersion: "fixture",
    nodes: [
      {
        id: "product",
        name: "Product",
        kind: "product",
        domain: ["fixture"],
        description: "Product role sentence.",
      },
      {
        id: "module",
        name: "Module",
        kind: "module",
        domain: ["fixture"],
        description: "Module role sentence.",
      },
      {
        id: "org_delisted",
        name: "Delisted subsidiary",
        kind: "organization",
        domain: ["fixture"],
        listingStatus: "subsidiary",
        notes: "Delisted after a share exchange and now a wholly-owned subsidiary with no standalone ticker.",
      },
      {
        id: "org_private_subsidiary",
        name: "Private subsidiary",
        kind: "organization",
        domain: ["fixture"],
        listingStatus: "subsidiary",
        tags: ["private_company"],
      },
    ],
    edges: [
      {
        id: "e_product_module",
        source: "product",
        target: "module",
        relation: "requires",
      },
      {
        id: "e_module_org_delisted",
        source: "module",
        target: "org_delisted",
        relation: "manufactured_by",
        claim: "Delisted subsidiary manufactures this module.",
        evidenceIds: ["ev_supplier"],
      },
      {
        id: "e_module_org_private_subsidiary",
        source: "module",
        target: "org_private_subsidiary",
        relation: "manufactured_by",
        claim: "Private subsidiary manufactures this module.",
        evidenceIds: ["ev_supplier"],
      },
    ],
    evidence: [
      {
        id: "ev_supplier",
        type: "product_page",
        title: "Supplier product page",
        url: "https://example.com/supplier",
        sourceStatus: "fetch_ok",
        reviewStatus: "unreviewed",
        confidence: "medium",
      },
    ],
  };

  const issues = auditNodeDetailIa(graph, { domainSlug: "fixture", rootId: "product" });
  assert.deepEqual(issues.map((issue) => issue.kind), []);
});
