import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LayerToggleFloatingButton } from "../src/components/LayerToggleFloatingButton";

const LABELS = { toggle: "Layer", product: "Products", knowHow: "Know-how" };

test("renders both layer options with the active one marked", () => {
  const html = renderToStaticMarkup(
    React.createElement(LayerToggleFloatingButton, {
      layer: "product",
      onSelect: () => {},
      labels: LABELS,
    }),
  );
  assert.match(html, /data-testid="layer-toggle"/);
  assert.match(html, /data-layer-option="product"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-layer-option="product"/);
  assert.match(html, /data-layer-option="knowhow"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*data-layer-option="knowhow"/);
  assert.match(html, /Know-how/);
});

test("know-how active state flips aria-pressed", () => {
  const html = renderToStaticMarkup(
    React.createElement(LayerToggleFloatingButton, {
      layer: "knowhow",
      onSelect: () => {},
      labels: LABELS,
    }),
  );
  assert.match(html, /data-layer-option="knowhow"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-layer-option="knowhow"/);
});
