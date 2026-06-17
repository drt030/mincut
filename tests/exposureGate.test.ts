import test from "node:test";
import assert from "node:assert/strict";
import type { GraphData } from "../src/lib/schema";
import { domainBySlug } from "../src/lib/domains";
import { GATED_DOMAINS, stripExposureLayer } from "../src/lib/exposureGate";
import { loadActiveGraphData, validateGraphReferences } from "../src/lib/graphLoader";

const EXPLICIT_AI_COMPUTE_GATE = [{ domainTag: "ai_compute_chain", entitlement: "ai_compute" }];

const fixture: GraphData = {
  graphVersion: "test",
  nodes: [
    { id: "cowos", name: "CoWoS", kind: "module", domain: ["ai_compute_chain"] },
    { id: "tsmc", name: "TSMC", kind: "organization", domain: ["ai_compute_chain"] },
    { id: "fanuc", name: "FANUC", kind: "organization", domain: ["parcel_sorting_robot"] },
  ] as GraphData["nodes"],
  edges: [
    { id: "e1", source: "cowos", target: "tsmc", relation: "manufactured_by", evidenceIds: ["ev_org"] },
  ] as GraphData["edges"],
  evidence: [
    // Plan fixture said type "industry_report"; the evidence schema has no
    // such member, so use a valid one — the gate never reads `type`.
    { id: "ev_org", type: "expert_review", title: "CoWoS supply", supportsNodeIds: ["tsmc"] },
    { id: "ev_keep", type: "expert_review", title: "CoWoS process" },
  ] as GraphData["evidence"],
};

test("strips org nodes, manufactured_by edges, org-only evidence for locked domains", () => {
  const { graph, locked } = stripExposureLayer(fixture, [], EXPLICIT_AI_COMPUTE_GATE);
  assert.ok(!graph.nodes.some((n) => n.id === "tsmc"));
  assert.ok(graph.nodes.some((n) => n.id === "fanuc"));          // other-domain org untouched
  assert.equal(graph.edges.length, 0);
  assert.ok(!graph.evidence.some((ev) => ev.id === "ev_org"));
  assert.ok(graph.evidence.some((ev) => ev.id === "ev_keep"));   // non-org evidence stays free
  assert.equal(locked[0].hiddenOrgCount, 1);
});

test("entitled viewer keeps everything", () => {
  const { graph } = stripExposureLayer(fixture, ["ai_compute"], EXPLICIT_AI_COMPUTE_GATE);
  assert.equal(graph.nodes.length, fixture.nodes.length);
});

test("SpaceX paid-candidate org exposure is gated behind the space entitlement", () => {
  const graph = loadActiveGraphData("spacex_orbital_data_center_system");
  const errors = validateGraphReferences(graph);
  assert.deepEqual(errors, []);

  const { graph: lockedGraph, locked } = stripExposureLayer(graph, []);
  const lockedSpaceX = lockedGraph.nodes.find((node) => node.id === "org_spacex");
  assert.ok(lockedSpaceX, "SpaceX owner identity should stay visible as route context");
  assert.equal(lockedSpaceX.listingStatus, "unknown");
  assert.equal(lockedSpaceX.ticker, undefined);
  assert.equal(lockedSpaceX.tags?.includes("public_company"), false);
  assert.ok(!lockedGraph.nodes.some((node) => node.id === "org_rocket_lab"), "public comparable exposure should be gated");
  assert.ok(locked.some((entry) => entry.domainTag === "spacex_orbital_data_center" && entry.entitlement === "space" && entry.hiddenOrgCount > 0));

  const { graph: unlockedGraph } = stripExposureLayer(graph, ["space"]);
  assert.ok(unlockedGraph.nodes.some((node) => node.id === "org_spacex"), "space entitlement should reveal SpaceX exposure");
  assert.ok(unlockedGraph.nodes.some((node) => node.id === "org_rocket_lab"), "space entitlement should reveal public comparable exposure");
});

test("SpaceX route roots survive locked exposure redaction", () => {
  for (const slug of ["spacex-reusable-launch", "spacex-orbital-data-center"]) {
    const domain = domainBySlug(slug);
    assert.ok(domain, `${slug} route should be registered`);
    const sourceGraph = loadActiveGraphData(domain.rootId);
    const { graph } = stripExposureLayer(sourceGraph, []);
    assert.ok(graph.nodes.some((node) => node.id === domain.rootId), `${domain.rootId} should remain the route root`);
    assert.equal(
      graph.nodes.some((node) => node.id.startsWith("locked_supplier_") && node.id.endsWith(domain.rootId.replace(/^spacex_/, ""))),
      false,
      `${domain.rootId} must not be rewritten as a locked supplier placeholder`,
    );
  }
});

// Real imported org nodes mix chain tags with category labels in `domain`
// (e.g. ["ai_compute_chain","investable_supplier","semiconductor_equipment"])
// and carry a separate `tags` field. The gate must key on registered chain
// tags only — category labels must not exempt an org from stripping — and
// orgs tagged `free_teaser` stay visible (Decision 5).
const realShapeFixture: GraphData = {
  graphVersion: "test",
  nodes: [
    { id: "cowos", name: "CoWoS", kind: "module", domain: ["ai_compute_chain"] },
    {
      id: "org_amat",
      name: "Applied Materials",
      kind: "organization",
      domain: ["ai_compute_chain", "investable_supplier", "semiconductor_equipment"],
      tags: ["manufacturer", "public_company"],
    },
    {
      id: "org_tsmc_teaser",
      name: "TSMC",
      kind: "organization",
      domain: ["ai_compute_chain", "investable_supplier"],
      tags: ["manufacturer", "free_teaser"],
    },
    {
      id: "org_estun",
      name: "Estun",
      kind: "organization",
      domain: ["industrial_robot_arm", "robotics", "investable_supplier"],
      tags: ["manufacturer"],
    },
  ] as GraphData["nodes"],
  edges: [
    { id: "e_amat", source: "cowos", target: "org_amat", relation: "manufactured_by" },
    { id: "e_tsmc", source: "cowos", target: "org_tsmc_teaser", relation: "manufactured_by" },
  ] as GraphData["edges"],
  evidence: [] as GraphData["evidence"],
};

test("category labels in domain do not exempt locked-chain orgs (leak regression)", () => {
  const { graph, locked } = stripExposureLayer(realShapeFixture, [], EXPLICIT_AI_COMPUTE_GATE);
  assert.ok(!graph.nodes.some((n) => n.id === "org_amat"), "non-teaser locked org must be stripped");
  assert.ok(!graph.edges.some((e) => e.id === "e_amat"), "its manufactured_by edge must go too");
  assert.equal(locked[0].hiddenOrgCount, 1);
});

test("free_teaser org survives the strip with its edge", () => {
  const { graph } = stripExposureLayer(realShapeFixture, [], EXPLICIT_AI_COMPUTE_GATE);
  assert.ok(graph.nodes.some((n) => n.id === "org_tsmc_teaser"), "free_teaser org stays");
  assert.ok(graph.edges.some((e) => e.id === "e_tsmc"), "teaser org keeps its manufactured_by edge");
});

test("org with no locked chain tag is untouched regardless of labels", () => {
  const { graph } = stripExposureLayer(realShapeFixture, [], EXPLICIT_AI_COMPUTE_GATE);
  assert.ok(graph.nodes.some((n) => n.id === "org_estun"));
});

// 2026-06-11 audit rewrites moved supplier names into free component prose,
// and some component-linked evidence names locked suppliers in its titles.
// The free layer must not NAME locked orgs: our own prose is redacted in
// place (the lock marker is the tease), and name-bearing evidence records
// belong to the exposure layer. Quoted source text is never altered — only
// re-layered. Teaser org names stay visible everywhere.
const textLeakFixture: GraphData = {
  graphVersion: "test",
  nodes: [
    {
      id: "t_glass",
      name: "T-glass fabric",
      kind: "material",
      domain: ["ai_compute_chain"],
      description: "Qualified by TSMC; supply is highly concentrated around Acme Specialty with relief in 2027.",
      notes: "Acme Specialty holds the qualified base; second sources are in qualification.",
      metrics: [
        {
          name: "Acme Specialty market share",
          unit: "%",
          currentValue: 43,
          description: "Acme Specialty estimated share of this qualified material niche.",
        },
        {
          name: "TSMC qualification status",
          currentValue: "qualified",
          description: "Qualified by TSMC",
        },
        {
          name: "Specialty glass availability",
          currentValue: "tight",
        },
      ],
    },
    {
      id: "org_acme",
      name: "Acme Specialty Co., Ltd.",
      kind: "organization",
      domain: ["ai_compute_chain", "investable_supplier"],
      tags: ["manufacturer"],
    },
    {
      id: "org_tsmc_teaser",
      name: "TSMC",
      kind: "organization",
      domain: ["ai_compute_chain"],
      tags: ["free_teaser"],
    },
  ] as GraphData["nodes"],
  edges: [
    { id: "e_acme", source: "t_glass", target: "org_acme", relation: "manufactured_by" },
    {
      id: "e_req",
      source: "t_glass",
      target: "org_tsmc_teaser",
      relation: "manufactured_by",
      claim: "Acme Specialty supplies the qualified cloth",
    },
  ] as GraphData["edges"],
  evidence: [
    { id: "ev_named_title", type: "expert_review", title: "Acme Specialty expands fiber output", supportsNodeIds: ["t_glass"] },
    {
      id: "ev_named_summary",
      type: "expert_review",
      title: "Fiber output expansion",
      summary: "Acme Specialty plans another qualified line.",
      supportsNodeIds: ["t_glass"],
    },
    {
      id: "ev_named_source",
      type: "expert_review",
      title: "Fiber output source",
      sourceName: "Acme Specialty investor relations",
      supportsNodeIds: ["t_glass"],
    },
    {
      id: "ev_named_excerpt",
      type: "expert_review",
      title: "Fiber output quote",
      excerpt: "Acme Specialty said it would expand.",
      supportsNodeIds: ["t_glass"],
    },
    {
      id: "ev_named_source_quote",
      type: "expert_review",
      title: "Fiber output source quote",
      sourceQuote: "Acme Specialty capacity remains tight.",
      supportsNodeIds: ["t_glass"],
    },
    { id: "ev_clean", type: "expert_review", title: "Specialty glass shortage persists", supportsNodeIds: ["t_glass"] },
  ] as GraphData["evidence"],
};

const TEXT_GATE = EXPLICIT_AI_COMPUTE_GATE;

test("locked org names are redacted from free prose (description, notes, edge claims)", () => {
  const { graph } = stripExposureLayer(textLeakFixture, [], TEXT_GATE);
  const node = graph.nodes.find((n) => n.id === "t_glass")!;
  assert.ok(!/Acme/i.test(node.description ?? ""), "description must not name a locked supplier");
  assert.ok(!/Acme/i.test((node as { notes?: string }).notes ?? ""), "notes must not name a locked supplier");
  assert.match(node.description ?? "", /locked supplier/);
  const edge = graph.edges.find((e) => e.id === "e_req")!;
  assert.ok(!/Acme/i.test(edge.claim ?? ""), "edge claim must not name a locked supplier");
});

test("locked org names are redacted from metric names without deleting free metrics", () => {
  const { graph } = stripExposureLayer(textLeakFixture, [], TEXT_GATE);
  const json = JSON.stringify(graph);
  assert.doesNotMatch(json, /Acme Specialty/, "stripped graph JSON must not name locked suppliers");

  const node = graph.nodes.find((n) => n.id === "t_glass")!;
  const metrics = node.metrics ?? [];
  const redactedMetric = metrics.find((metric) => metric.currentValue === 43);
  assert.equal(redactedMetric?.name, "locked supplier market share");
  assert.equal(redactedMetric?.currentValue, 43);
  assert.ok(metrics.some((metric) => metric.name === "TSMC qualification status"), "free teaser org name survives");
  assert.ok(metrics.some((metric) => metric.name === "Specialty glass availability"), "clean metric name survives");
});

test("teaser org names survive redaction", () => {
  const { graph } = stripExposureLayer(textLeakFixture, [], TEXT_GATE);
  assert.match(graph.nodes.find((n) => n.id === "t_glass")!.description ?? "", /TSMC/);
});

test("component evidence naming a locked org is redacted but stays with visible component evidence", () => {
  const { graph } = stripExposureLayer(textLeakFixture, [], TEXT_GATE);
  for (const evidenceId of [
    "ev_named_title",
    "ev_named_summary",
    "ev_named_source",
    "ev_named_excerpt",
    "ev_named_source_quote",
  ]) {
    const evidence = graph.evidence.find((ev) => ev.id === evidenceId) as Record<string, unknown> | undefined;
    assert.ok(evidence, `${evidenceId} stays available as component evidence`);
    assert.doesNotMatch(JSON.stringify(evidence), /Acme Specialty/i, `${evidenceId} must not leak a locked supplier`);
    assert.match(JSON.stringify(evidence), /locked supplier/i, `${evidenceId} should show redacted source context`);
  }
  assert.ok(graph.evidence.some((ev) => ev.id === "ev_clean"), "clean component evidence stays free");
});

test("entitled viewer gets unredacted prose and the named evidence", () => {
  const { graph } = stripExposureLayer(textLeakFixture, ["ai_compute"], TEXT_GATE);
  assert.match(graph.nodes.find((n) => n.id === "t_glass")!.description ?? "", /Acme Specialty/);
  assert.ok(graph.evidence.some((ev) => ev.id === "ev_named_title"));
});

const mixedCaseAliasFixture: GraphData = {
  graphVersion: "test",
  nodes: [
    {
      id: "epi_growth",
      name: "Epitaxial layer growth",
      kind: "manufacturing_process",
      domain: ["ai_compute_chain"],
      description: "IntelliEPI appears in mixed-case parenthetical aliases and must be locked.",
    },
    {
      id: "org_intelliepi",
      name: "Intelligent Epitaxy Technology, Inc. (IntelliEPI)",
      kind: "organization",
      domain: ["ai_compute_chain", "investable_supplier"],
      tags: ["manufacturer"],
    },
  ] as GraphData["nodes"],
  edges: [] as GraphData["edges"],
  evidence: [
    {
      id: "ev_intelliepi_alias",
      type: "expert_review",
      title: "Epitaxy capacity note",
      summary: "IntelliEPI capacity is cited in this note.",
      supportsNodeIds: ["epi_growth"],
    },
    {
      id: "ev_clean_mixed_support",
      type: "expert_review",
      title: "Epitaxy growth process overview",
      summary: "Clean process note with mixed visible and hidden supports.",
      supportsNodeIds: ["epi_growth", "org_intelliepi"],
    },
  ] as GraphData["evidence"],
};

test("mixed-case parenthetical aliases are locked identities and hidden evidence supports are pruned", () => {
  const { graph } = stripExposureLayer(mixedCaseAliasFixture, [], TEXT_GATE);
  assert.equal(findIdentityLeak(graph, "IntelliEPI"), undefined, "mixed-case hidden alias must not leak");
  assert.ok(!graph.evidence.some((ev) => ev.id === "ev_intelliepi_alias"), "alias-bearing evidence is exposure-layer");
  assert.deepEqual(
    graph.evidence.find((ev) => ev.id === "ev_clean_mixed_support")?.supportsNodeIds,
    ["epi_growth"],
    "retained clean evidence drops hidden support ids",
  );
  assert.deepEqual(validateGraphReferences(graph), []);
});

test("default gated domains do not include the AI compute full-free flagship", () => {
  assert.equal(
    GATED_DOMAINS.some((domain) => domain.domainTag === "ai_compute_chain"),
    false,
  );
});

test("default strip keeps AI compute organizations visible", () => {
  const domain = domainBySlug("ai-compute");
  assert.ok(domain, "ai-compute domain route must exist");

  const sourceGraph = loadActiveGraphData(domain.rootId);
  const sourceOrgIds = sourceGraph.nodes
    .filter((node) => node.kind === "organization" && (node.domain ?? []).includes(domain.domainTag))
    .map((node) => node.id);
  assert.ok(sourceOrgIds.length > 0, "probe must cover AI compute supplier organizations");

  const { graph, locked } = stripExposureLayer(sourceGraph, []);
  const visibleOrgIds = new Set(graph.nodes.map((node) => node.id));
  assert.deepEqual(
    sourceOrgIds.filter((id) => !visibleOrgIds.has(id)),
    [],
    "default strip must not remove AI compute supplier organizations",
  );
  assert.equal(locked.some((entry) => entry.domainTag === domain.domainTag), false);
});

test("explicit AI compute gate still omits hidden organization names and keeps teaser org names", () => {
  const domain = domainBySlug("ai-compute");
  assert.ok(domain, "ai-compute domain route must exist");

  const sourceGraph = loadActiveGraphData(domain.rootId);
  const { graph } = stripExposureLayer(loadActiveGraphData(domain.rootId), [], EXPLICIT_AI_COMPUTE_GATE);
  const json = JSON.stringify(graph);
  const hiddenOrgNames = hiddenOrganizationSearchTerms(sourceGraph, domain.domainTag);
  assert.ok(hiddenOrgNames.includes("Hanmi"), "probe must cover the historical Hanmi leak");
  assert.ok(hiddenOrgNames.includes("Nittobo"), "probe must cover the historical Nittobo leak");
  assert.ok(hiddenOrgNames.includes("IntelliEPI"), "probe must cover mixed-case parenthetical aliases");

  for (const hiddenOrgName of hiddenOrgNames) {
    const leak = findIdentityLeak(graph, hiddenOrgName);
    assert.equal(
      leak,
      undefined,
      `${hiddenOrgName} must not appear in stripped graph string fields${leak ? ` (${leak})` : ""}`,
    );
  }

  for (const hiddenMetricName of [
    "Asetek market share",
    "Merck KGaA estimated share",
    "Henkel/Bergquist estimated NCF market share",
  ]) {
    assert.equal(json.includes(hiddenMetricName), false, `${hiddenMetricName} must not appear in stripped graph JSON`);
  }
  assert.equal(findIdentityLeak(graph, "Hanmi"), undefined, "historical Hanmi leak must not appear");
  assert.equal(findIdentityLeak(graph, "Nittobo"), undefined, "historical Nittobo leak must not appear");
  assert.equal(findIdentityLeak(graph, "IntelliEPI"), undefined, "historical IntelliEPI leak must not appear");
  assert.deepEqual(validateGraphReferences(graph), [], "stripped graph must not retain references to hidden nodes");

  const teaserOrgNames = sourceGraph.nodes
    .filter(
      (node) =>
        node.kind === "organization" &&
        (node.domain ?? []).includes(domain.domainTag) &&
        (node.tags ?? []).includes("free_teaser"),
    )
    .map((node) => node.name);
  assert.ok(teaserOrgNames.some((name) => json.includes(name)), "at least one free_teaser org name stays visible");
  assert.ok(graph.nodes.some((node) => node.id === domain.rootId), "free technical graph root stays visible");
});

// 2026-06-16 Gate-F FF-1: cross-domain supplier orgs (defined in another domain's
// node file, carrying no gated tag of their own) leaked their name + ticker on a
// gated route because they reach the graph only via a supplier edge from a gated
// host. They must be stripped on the gated render; free_teaser route context stays.
const crossDomainLeakFixture: GraphData = {
  graphVersion: "test",
  nodes: [
    { id: "lox_supply", name: "LOX supply", kind: "material", domain: ["spacex_reusable_launch"] },
    {
      id: "org_linde",
      name: "Linde plc",
      kind: "organization",
      ticker: "LIN",
      domain: ["parcel_sorting_robot", "industrial_gas"],
      tags: ["manufacturer", "public_company"],
    },
    { id: "org_spacex", name: "SpaceX", kind: "organization", domain: ["spacex_reusable_launch"], tags: ["free_teaser"] },
  ] as GraphData["nodes"],
  edges: [
    {
      id: "e_lox_linde",
      source: "lox_supply",
      target: "org_linde",
      relation: "manufactured_by",
      claim: "Linde plc supplies SpaceX liquid oxygen",
    },
    { id: "e_lox_spacex", source: "lox_supply", target: "org_spacex", relation: "manufactured_by" },
  ] as GraphData["edges"],
  evidence: [] as GraphData["evidence"],
};

test("cross-domain supplier of a gated host is stripped (Gate-F FF-1 leak regression)", () => {
  const { graph, locked } = stripExposureLayer(crossDomainLeakFixture, []);
  assert.ok(!graph.nodes.some((n) => n.id === "org_linde"), "cross-domain supplier org must be stripped on a gated route");
  assert.ok(!graph.edges.some((e) => e.id === "e_lox_linde"), "its supplier edge must be stripped too");
  assert.doesNotMatch(JSON.stringify(graph), /Linde/, "cross-domain supplier name must not survive anywhere in the gated graph");
  assert.ok(graph.nodes.some((n) => n.id === "org_spacex"), "free_teaser route-context org stays");
  assert.ok(
    locked.some((entry) => entry.domainTag === "spacex_reusable_launch" && entry.hiddenOrgCount >= 1),
    "the cross-domain supplier counts toward the gated teaser",
  );
});

test("entitlement reveals the cross-domain supplier (Gate-F FF-1)", () => {
  const { graph } = stripExposureLayer(crossDomainLeakFixture, ["space"]);
  assert.ok(graph.nodes.some((n) => n.id === "org_linde"), "space entitlement reveals the gated supplier");
});

test("gated routes do not leak the known cross-domain supplier names (Gate-F FF-1, real data)", () => {
  const cases: Array<{ slug: string; orgIds: string[]; name: string }> = [
    { slug: "spacex-reusable-launch", orgIds: ["org_linde", "org_air_liquide", "org_eaton", "org_dupont"], name: "Linde" },
    { slug: "humanoid-robotics", orgIds: ["org_mp_materials", "org_nsk", "org_thk", "org_renishaw"], name: "MP Materials" },
  ];
  for (const { slug, orgIds, name } of cases) {
    const domain = domainBySlug(slug);
    assert.ok(domain, `${slug} route registered`);
    const { graph } = stripExposureLayer(loadActiveGraphData(domain.rootId), []);
    for (const orgId of orgIds) {
      assert.ok(!graph.nodes.some((n) => n.id === orgId), `${slug}: cross-domain supplier ${orgId} must be stripped on the gated route`);
    }
    assert.equal(findIdentityLeak(graph, name), undefined, `${slug}: ${name} must not survive in the gated graph`);
  }
});

test("gated route stripped JSON does not leak locked supplier names, tickers, or named exposure prose (real data)", () => {
  const cases: Array<{ slug: string; deniedTerms: string[] }> = [
    { slug: "humanoid-robotics", deniedTerms: ["Holroyd", "ADI"] },
    { slug: "spacex-reusable-launch", deniedTerms: ["Air Products", "Aerojet Rocketdyne"] },
  ];

  for (const { slug, deniedTerms } of cases) {
    const domain = domainBySlug(slug);
    assert.ok(domain, `${slug} route registered`);
    const { graph } = stripExposureLayer(loadActiveGraphData(domain.rootId), []);

    for (const term of deniedTerms) {
      const leak = findIdentityLeak(graph, term);
      assert.equal(leak, undefined, `${slug}: ${term} must not appear in stripped graph string fields${leak ? ` (${leak})` : ""}`);
    }
  }
});

test("gated humanoid redaction keeps generic artifact roots intact (real data)", () => {
  const domain = domainBySlug("humanoid-robotics");
  assert.ok(domain, "humanoid-robotics route registered");
  const { graph } = stripExposureLayer(loadActiveGraphData(domain.rootId), []);
  const json = JSON.stringify(graph);

  assert.equal(json.includes("BMS locked supplier front-end"), false);
  assert.equal(json.includes("ultra-locked supplier CNC grinding equipment"), false);
  assert.ok(
    graph.nodes.some((node) => node.name === "BMS analog front-end / fuel-gauge IC"),
    "BMS analog front-end / fuel-gauge IC should remain a readable artifact name",
  );
  assert.ok(
    graph.nodes.some((node) => node.name.includes("ultra-precision CNC grinding equipment")),
    "ultra-precision CNC grinding equipment should remain a readable artifact name",
  );
});

function hiddenOrganizationSearchTerms(graph: GraphData, domainTag: string): string[] {
  const hiddenOrganizations = graph.nodes.filter(
    (node) =>
      node.kind === "organization" &&
      (node.domain ?? []).includes(domainTag) &&
      !(node.tags ?? []).includes("free_teaser"),
  );
  const visibleTerms = new Set(
    graph.nodes
      .filter((node) => node.kind === "organization" && !hiddenOrganizations.some((hidden) => hidden.id === node.id))
      .flatMap(visibleOrganizationIdentityTerms)
      .map((term) => term.toLocaleLowerCase()),
  );

  return uniqueTerms(
    hiddenOrganizations
      .flatMap((node) => organizationIdentityTerms(node.name))
      .filter((term) => !visibleTerms.has(term.toLocaleLowerCase())),
  );
}

function visibleOrganizationIdentityTerms(node: GraphData["nodes"][number]): string[] {
  return uniqueTerms([
    ...organizationIdentityTerms(node.name),
    typeof node.ticker === "string" ? node.ticker : "",
    ...(node.metrics ?? []).flatMap((metric) => [
      typeof metric.currentValue === "string" ? metric.currentValue : "",
      typeof metric.targetValue === "string" ? metric.targetValue : "",
    ]),
  ]);
}

function organizationIdentityTerms(name: string): string[] {
  const primaryName = name.replace(/\s*\([^)]*\)/g, "").trim();
  const primarySegments = primaryName.split(/\s+\/\s+/).map((part) => normalizeOrganizationName(part));
  const parentheticalAliases = [...name.matchAll(/\(([^)]*)\)/g)]
    .flatMap((match) => match[1].split(/[;,/]/))
    .map((part) => normalizeOrganizationName(part))
    .filter(isUsefulAlias);
  const terms = uniqueTerms([
    name.trim(),
    primaryName,
    ...primarySegments,
    ...parentheticalAliases,
    ...primarySegments.flatMap((term) => organizationRootTerms(term)),
  ]);

  return terms.filter((term) => term.length >= 3);
}

function normalizeOrganizationName(name: string): string {
  const beforeComma = name.split(",")[0]?.trim() ?? name.trim();
  let next = beforeComma;
  let previous = "";
  while (next !== previous) {
    previous = next;
    next = next
      .replace(
        /(?:[\s,]+(?:Inc\.?|Incorporated|Corporation|Corp\.?|Co\.?|Company|Ltd\.?|Limited|plc|S\.?A\.?|N\.?V\.?|B\.?V\.?|GmbH|KGaA|SE|S\.?E\.?|Holdings?|Industries?))\.?$/i,
        "",
      )
      .trim();
  }
  return next;
}

function organizationRootTerms(name: string): string[] {
  const firstToken = name.split(/\s+/)[0]?.replace(/[^\p{L}\p{N}&.-]/gu, "") ?? "";
  if (!isDistinctiveRootTerm(firstToken)) return [];

  const words = name.split(/\s+/).filter((part) => part !== "&");
  const ampersandAcronym =
    name.includes("&") && words.length >= 2 ? words.map((part) => part[0]).join("&") : undefined;

  return [firstToken, ampersandAcronym].filter((term): term is string => Boolean(term));
}

function isUsefulAlias(value: string): boolean {
  if (value.length < 2) return false;
  if (
    /^(formerly|former|division|foundry|usa|germany|japan|korea|hong kong|switzerland|austria|private|netherlands|asia|sweden|israeli?|optics|photonics)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  if (/\b(foundry|division)\b/i.test(value)) return false;
  if (/^[A-Z0-9&.+-]{2,12}$/.test(value)) return true;
  if (/^(?=.*[a-z])(?=.*[A-Z])[\p{L}\p{N}&.+-]{4,24}$/u.test(value)) return true;
  return /^[A-Z][\p{L}\p{N}&.+-]*(?:\s+[A-Z][\p{L}\p{N}&.+-]*){1,3}$/u.test(value);
}

function isDistinctiveRootTerm(value: string): boolean {
  if (value.length < 3) return false;
  if (/^(Applied|Air|Power|Delta|Advanced|Visual|Intelligent|Onto|Illinois|Tokyo|Analog|Precision)$/i.test(value)) return false;
  return true;
}

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms.map((item) => item.trim()).filter(Boolean)) {
    const key = term.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }
  return result.sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function findIdentityLeak(value: unknown, term: string, path = "graph"): string | undefined {
  if (typeof value === "string") {
    return stringContainsIdentity(value, term) ? `${path}: ${value}` : undefined;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const leak = findIdentityLeak(value[index], term, `${path}[${index}]`);
      if (leak) return leak;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  for (const [key, entry] of Object.entries(value)) {
    const leak = findIdentityLeak(entry, term, `${path}.${key}`);
    if (leak) return leak;
  }
  return undefined;
}

function stringContainsIdentity(value: string, term: string): boolean {
  return (
    identityTextPattern(term).test(value) ||
    identityIdentifierPattern(term).test(value) ||
    (looksUrlLike(value) && compactIdentityString(term).length >= 5 && compactIdentityString(value).includes(compactIdentityString(term)))
  );
}

function identityTextPattern(term: string): RegExp {
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRegExp(term)}(?=$|[^\\p{L}\\p{N}_])`, "iu");
}

function identityIdentifierPattern(term: string): RegExp {
  const parts = term.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(escapeRegExp);
  if (parts.length === 0) return /$a/;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${parts.join("[^\\p{L}\\p{N}]+")}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function looksUrlLike(value: string): boolean {
  return /https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,}/i.test(value);
}

function compactIdentityString(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
