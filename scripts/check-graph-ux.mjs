import fs from "node:fs";

const graphExplorer = fs.readFileSync("src/components/GraphExplorer.tsx", "utf8");
const globals = fs.readFileSync("src/app/globals.css", "utf8");

const failures = [];

function requireMatch(name, condition) {
  if (!condition) failures.push(name);
}

const layoutEffectMatch = graphExplorer.match(/useEffect\(\(\) => \{[\s\S]*?layoutWithElk[\s\S]*?\}, \[([^\]]*)\]\);/);
const layoutDeps = layoutEffectMatch?.[1] ?? "";
const cardHoverMatch = globals.match(/\.graph-node-card:hover\s*\{([\s\S]*?)\}/);
const cardHoverBody = cardHoverMatch?.[1] ?? "";

requireMatch("GraphExplorer should not keep ReactFlow fitView enabled on every update.", !/\sfitView(?:\s|>|$)/.test(graphExplorer));
requireMatch("Layout effect should not depend on hover-only state.", !/\bhoveredId\b/.test(layoutDeps) && !/\bflowEdges\b/.test(layoutDeps));
requireMatch("GraphExplorer should not use React Flow hover handlers for graph-wide state.", !/onNodeMouseEnter|onNodeMouseLeave|hoveredId/.test(graphExplorer));
requireMatch("GraphExplorer should handle double-click through an explicit custom node onDoubleClick handler.", /onDoubleClick=\{\(event\) => \{[\s\S]*data\.onToggle\(data\.id\)/.test(graphExplorer));
requireMatch("Single-click handlers should not toggle expansion through click detail.", !/event\.detail >= 2[\s\S]*(?:data\.onToggle|toggleSelectedExpansion)/.test(graphExplorer));
requireMatch("React Flow double-click fallback must also toggle expansion when used.", /onNodeDoubleClick=\{\(event, node\) => \{[\s\S]*toggleSelectedExpansion\(node\.id\)/.test(graphExplorer));
requireMatch("React Flow node single-click fallback should only select.", /onNodeClick=\{\([^,]+, node\) => \{[\s\S]*setSelectedId\(node\.id\);[\s\S]*\}\}/.test(graphExplorer));
requireMatch("React Flow double-click viewport zoom must stay disabled because double-click expands nodes.", /zoomOnDoubleClick=\{false\}/.test(graphExplorer));
requireMatch("Layout effect should not depend on selection-only state.", !/\bselectedId\b/.test(layoutDeps));
requireMatch("Layout effect should depend on structural nodes and edges.", /\bfilteredNodes\b/.test(layoutDeps) && /\blayoutEdges\b/.test(layoutDeps));
requireMatch("Graph expansion should use incremental layout before falling back to ELK.", /incrementalLayout\(nodes, edges, anchorId, previousPositions\)/.test(graphExplorer));
requireMatch("Hover hitbox must not move the outer graph node.", !/\btranslate\b|\btransform\b/.test(cardHoverBody));
requireMatch("Main graph nodes should not use ambient float animation.", !/graphNodeFloat|animation:\s*graphNodeFloat/.test(globals));
requireMatch("ELK worker should be served as a static asset.", fs.existsSync("public/elk-worker.min.js"));
requireMatch("GraphExplorer should not import the bundled ELK main build.", !/elkjs\/lib\/elk\.bundled|from "elkjs";/.test(graphExplorer));

if (failures.length) {
  console.error("Graph UX regression checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Graph UX regression checks passed.");
