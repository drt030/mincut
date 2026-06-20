import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadGraphData } from "../src/lib/graphLoader";
import { stripExposureLayer } from "../src/lib/exposureGate";
import { computeHolderTeasers } from "../src/lib/holderTeasers";
import { nodeById } from "../src/lib/graphTraversal";
import { ProductView } from "../src/components/ProductView";
import { ExposureLockProvider } from "../src/components/ExposureLockCta";
import { HolderTeaserProvider } from "../src/components/HolderTeaserProvider";
(globalThis as any).React = React;
const full = loadGraphData();
const teasers = computeHolderTeasers(full);
const { graph, locked } = stripExposureLayer(full, []);   // NO entitlement
const product = nodeById(graph, "humanoid_reducer_transmission_stack")!;
const html = renderToStaticMarkup(
  React.createElement(ExposureLockProvider, { locked },
    React.createElement(HolderTeaserProvider, { teasers },
      React.createElement(ProductView, { graph, product }))));
console.log("leak (Nabtesco/Harmonic/Leaderdrive present):", /Harmonic Drive|Nabtesco|Leaderdrive/i.test(html));
console.log("lock CTA present (Who makes this / Unlock all paid maps):", /Who makes this|Unlock all paid maps/i.test(html));
console.log("html kb:", Math.round(html.length/1024));
