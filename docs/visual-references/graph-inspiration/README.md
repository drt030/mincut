# Graph Visualization References

These images are visual references for improving the `/graph` canvas. They are not source material to copy directly; use them as direction for structure, density control, hierarchy, color language, and label placement.

## Files

| File | Useful lesson |
|---|---|
| `circular-tree-of-life-taxonomy.jpeg` | A radial tree can carry high density if the branching structure is explicit and the outer labels name major sectors. |
| `sunburst-library-hierarchy.png` | Rings make hierarchy immediately legible: center = root, each outer band = deeper level, arcs = grouped descendants. |
| `circular-phylogeny-with-rings.png` | Inner branch color and outer annotation rings can encode different dimensions without making nodes fight for attention. |
| `radial-labeled-cluster-small.jpg` | Curved radial labels and small colored clusters can work when only high-level categories are named. |
| `dark-radial-cluster-network.png` | Cluster-first graph layout: each hub owns a local fan, cross-links are secondary arcs. This is closer to our DAG reality than a pure tree. |
| `wide-tree-of-life-timeline.png` | A tree can feel organic and readable when major branches have strong shape, clear labels, and empty interior breathing room. |
| `dense-tree-of-life-map.jpg` | Extreme density is acceptable only when macro-regions remain readable from far away. |

## Direction For Capability Graph Explorer

The current graph reads as an abstract point cloud: nodes are tiny, edges are faint, sectors are pastel washes, and the user cannot identify the product, subsystem boundaries, or critical paths without interacting. The references point toward a different first impression: a radial technical map with visible structure.

The target visual language should be:

1. **Branch geometry first.** Show dependency structure as branching lines or radial paths, not only dots connected by faint straight edges. The user should see subsystem trunks, child branches, and cross-sector dependencies at a glance.
2. **Rings for depth.** Keep the product at the center, first-layer subsystems on an inner ring, deeper components/processes/materials on outer rings. Depth should be readable before labels.
3. **Sectors as named regions.** First-layer modules should own stable angular sectors with perimeter labels. The sector should feel like a territory, not just a translucent background wedge.
4. **Cluster hubs over point scatter.** Each subsystem should have a local hub-and-fan shape. Cross-links can curve between sectors, but the primary parent-child path should be visually dominant.
5. **Color identity and risk separated.** Use stable hue families for subsystem identity. Encode risk/cost/maturity through edge warmth/thickness, outlines, or outer rings, not by constantly repainting node fill.
6. **LOD by zoom, not by dumping all labels.** Overview should show only product, sector names, critical branches, and top priority glyphs. At closer zoom, reveal node labels and metric badges.
7. **Visible selected path.** The active node's ancestors and descendants should become a clear highlighted route. Everything else can desaturate, but should retain spatial context.
8. **Use empty space deliberately.** The references work because the center and sector gaps create breathing room. Avoid filling the whole canvas with equal-weight marks.

## Practical Redesign Notes

Near-term graph work should focus on the visualization itself before adding more information:

- Replace the default point-cloud appearance with branch strokes that connect nodes along radial hierarchy paths.
- Make first-layer subsystem sectors visibly named and stable.
- Increase overview legibility by drawing fewer but stronger marks: product center, 12 sector labels, major branches, shared material ring, top risk path.
- Add outer annotation bands for secondary metrics later: maturity, evidence coverage, cost confidence, or bottleneck status.
- Keep the detail rail for dense text; do not force descriptions, evidence, and metric prose onto the canvas.

## What Not To Copy

- Do not copy biology taxonomy semantics directly; our graph is a product dependency DAG with shared components and cross-sector constraints.
- Do not make every leaf label visible in overview.
- Do not use decorative radial art if it hides cost/maturity/bottleneck reasoning.
- Do not let palette become a rainbow without meaning. Every hue must map to subsystem identity or a documented metric channel.
