import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// RED Slice B1 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
// ADR-0006 §"Chrome (toolbar)" originally specified "Color mode +
// 5-stop legend: bottom-left floating icon button, expands to full
// selector on click". The 2026-05-31 UX correction changes that
// contract: the colour-mode selector is persistent graph chrome because
// hidden edge-colouring controls were too easy to miss.
//
// `ColorModeFloatingButton` REPLACES the legacy `ColorModeSelect`
// dropdown (deleted in slice A3). Per ADR-0006:
//
//   - Default state: persistent bottom-left selector with all 5 mode
//     options visible.
//   - The 5-stop legend remains visible so users can interpret the
//     active colour ramp without opening a hidden menu.
//
// The component does not exist yet; this import fails at module
// load time, which is the cleanest RED signal for the GREEN sub-
// agent. We import the component AND the `ColorMode` type that
// lives alongside `edgeStyleFor.ts` (per the slice's "ColorMode
// type can live alongside edgeStyleFor.ts" constraint).
import { ColorModeFloatingButton } from "../src/components/ColorModeFloatingButton";
import type { ColorMode } from "../src/lib/edgeStyleFor";

/**
 * Test renderer choice mirrors `tests/lod.test.ts`:
 * `react-dom/server.renderToStaticMarkup`. `react-dom` is already a
 * transitive dep via Next.js; no new packages needed. The downside
 * vs `react-test-renderer` is that we assert on the rendered HTML
 * string rather than a structured tree, but the contract for this
 * component is shape-of-DOM (button presence, swatch count, option
 * count, attribute positioning), so string-level assertions are
 * precise enough.
 *
 * Click wiring: `renderToStaticMarkup` strips event handlers, so we
 * can't assert that `onSelect` actually fires on a synthetic click.
 * The compromise (per the bring-back: "trust the click wire-up via
 * static check") is to assert that the option elements exist with
 * the right per-mode hooks (e.g. a stable `data-mode` attribute)
 * AND that the `onSelect` prop type is honoured — i.e. the test
 * passes a non-null callback as `onSelect` and the render succeeds.
 * A click-firing assertion is left for an integration test under
 * `tests/uxSmoke.test.ts` in a later phase.
 */

type ColorModeFloatingButtonProps = {
  mode: ColorMode;
  onSelect: (next: ColorMode) => void;
};

function render(props: ColorModeFloatingButtonProps): string {
  return renderToStaticMarkup(
    React.createElement(
      ColorModeFloatingButton as unknown as React.FC<ColorModeFloatingButtonProps>,
      props,
    ),
  );
}

/** All 5 modes, in the canonical order the ADR lists them. */
const ALL_MODES: readonly ColorMode[] = [
  "bottleneck-risk",
  "cost",
  "maturity",
  "overall",
  "relation",
];

/**
 * Mode → display-label fragment that must appear somewhere in the
 * rendered output when the option is visible. We pin LOOSE
 * fragments (case-insensitive substrings) so the GREEN commit can
 * choose its own copy strings — e.g. "Bottleneck risk" / "瓶颈风险"
 * / "Risk" — without breaking the test. The test only verifies that
 * SOMETHING anchored to each mode renders.
 */
const MODE_LABEL_REGEXES: Record<ColorMode, RegExp> = {
  "bottleneck-risk": /bottleneck|风险|risk/i,
  cost: /cost|成本/i,
  maturity: /maturity|成熟/i,
  overall: /overall|综合/i,
  relation: /relation|关系/i,
};

// -------------------- Assertion 1: Default persistent render --------------------

/**
 * Default state must render:
 *   - A persistent selector identifiable via a stable test hook
 *     (`data-testid="color-mode-control"`), with the legacy
 *     `data-testid="color-mode-button"` retained on the surface for
 *     existing smoke selectors.
 *   - Positioned bottom-left via CSS. `renderToStaticMarkup` emits
 *     inline `style="..."` strings for React's `style` prop, so we
 *     can check for `position: fixed`, `bottom:` and `left:`
 *     substrings without coupling to a specific px value.
 *   - All 5 mode labels are visible by default. No expand/collapse
 *     gesture is required to discover edge-colouring options.
 */
test("ColorModeFloatingButton (default): bottom-left persistent selector shows every mode", () => {
  const html = render({
    mode: "bottleneck-risk",
    onSelect: () => {},
  });

  // Stable test hook.
  assert.match(
    html,
    /data-testid="color-mode-control"/,
    `default render must expose data-testid="color-mode-control"; got: ${html}`,
  );
  assert.match(
    html,
    /data-testid="color-mode-button"/,
    `default render must retain data-testid="color-mode-button"; got: ${html}`,
  );

  // CSS positioning: `position: fixed; bottom: <X>; left: <Y>`.
  // React inlines the style prop, so the string will contain those
  // CSS tokens directly. We accept any value (including 0 or any
  // numeric px / rem) by anchoring only the property names.
  assert.match(
    html,
    /position:\s*fixed/,
    `default render must set CSS position: fixed; got: ${html}`,
  );
  assert.match(
    html,
    /bottom:\s*[^;"]+/,
    `default render must set CSS bottom; got: ${html}`,
  );
  assert.match(
    html,
    /left:\s*[^;"]+/,
    `default render must set CSS left; got: ${html}`,
  );

  for (const mode of ALL_MODES) {
    assert.match(
      html,
      MODE_LABEL_REGEXES[mode],
      `default render must include visible option label for "${mode}"; got: ${html}`,
    );
  }
});

// -------------------- Assertion 2: Persistent legend --------------------

/**
 * The persistent state must render:
 *   - A 5-stop legend: 5 colour swatches (rect | div | li | path)
 *     showing the active mode's colour ramp. We count occurrences
 *     of a swatch-element pattern in the rendered HTML; the GREEN
 *     implementation can pick its own element form, but it must
 *     emit 5 of them.
 *
 * Implementation hint left for the GREEN commit: the canonical way
 * to expose "this is one of the 5 swatches" is a stable per-swatch
 * `data-testid="color-mode-swatch"` (mirroring the button hook).
 * We accept either that hook OR five repeated coloured rectangle
 * elements within the same legend container — the regex below
 * matches both. We do NOT pin the colours; the colour values come
 * from `edgeStyleFor` and the legend should derive them at render
 * time.
 */
test("ColorModeFloatingButton (default): 5-stop legend stays visible", () => {
  const html = render({
    mode: "cost",
    onSelect: () => {},
  });

  assert.match(
    html,
    /Legend|图例/i,
    `default render must label the swatches as a legend, not as selectable controls; got: ${html}`,
  );
  assert.match(
    html,
    /Low|低/i,
    `default render must label the low end of the active colour ramp; got: ${html}`,
  );
  assert.match(
    html,
    /High|高/i,
    `default render must label the high end of the active colour ramp; got: ${html}`,
  );

  // 5-stop legend. We count swatches by looking for the dedicated
  // hook `data-testid="color-mode-swatch"` FIRST (the canonical
  // form the GREEN commit should adopt), then fall back to a
  // generic 5-element <li>/<rect>/<div> heuristic only if the hook
  // is missing — the fallback exists so a partial implementation
  // that forgot the test hook still gets a clear "you have 4
  // swatches, expected 5" message rather than a confusing "selector
  // not found" message.
  const swatchHookCount = (html.match(/data-testid="color-mode-swatch"/g) ?? []).length;
  if (swatchHookCount > 0) {
    assert.equal(
      swatchHookCount,
      5,
      `default render must have 5 swatches with data-testid="color-mode-swatch"; got ${swatchHookCount}`,
    );
  } else {
    // Fallback: any container with exactly 5 repeated colour
    // swatches. Look for the smallest enclosing tag with 5
    // <rect> | <li> | <span> | <div> children that include a
    // `background-color` / `fill` style attribute.
    const rectCount = (html.match(/<rect\b[^>]*(?:fill|stroke)=/g) ?? []).length;
    const divSwatchCount = (html.match(/<div\b[^>]*style="[^"]*background(?:-color)?:/g) ?? []).length;
    const liSwatchCount = (html.match(/<li\b[^>]*style="[^"]*background(?:-color)?:/g) ?? []).length;
    const totalSwatches = rectCount + divSwatchCount + liSwatchCount;
    assert.ok(
      totalSwatches >= 5,
      `default render must contain a 5-stop colour legend; found rect=${rectCount} div=${divSwatchCount} li=${liSwatchCount}; got: ${html}`,
    );
  }
});

// -------------------- Assertion 3: onSelect wiring per option --------------------

/**
 * Each of the 5 options must render with a stable per-mode hook so
 * a UI test (or a future click-driven integration test) can target
 * it. We pin the hook as `data-mode="<modeId>"` on the option
 * element. Per the bring-back: "the rendered tree shows the
 * option's `onClick` was wired to a function reference
 * (renderToStaticMarkup can only verify presence of the option
 * element + the right element type, not the actual click — instead
 * assert that the option element exists per mode, and trust the
 * click wire-up via static check)".
 *
 * To honour that constraint we:
 *   1. Pass a non-null `onSelect` callback (so any TypeScript
 *      runtime guard inside the component that bails out on
 *      missing handlers does NOT short-circuit before rendering
 *      the options).
 *   2. Assert one `data-mode="<modeId>"` attribute appears per
 *      mode in the expanded render.
 *
 * This is enough to guarantee the GREEN implementation actually
 * rendered an interactive surface for each mode; the harness can
 * wire its own click test elsewhere.
 */
test("ColorModeFloatingButton (default): one data-mode option element per ColorMode", () => {
  let lastSelected: ColorMode | null = null;
  const onSelect = (next: ColorMode) => {
    lastSelected = next;
  };
  const html = render({
    mode: "maturity",
    onSelect,
  });

  for (const mode of ALL_MODES) {
    // Per-mode option element with a stable hook. Order of
    // attributes inside the tag is implementation-defined; we
    // anchor only on the attribute value.
    const re = new RegExp(`data-mode="${mode}"`);
    assert.match(
      html,
      re,
      `expanded render must contain a data-mode="${mode}" option element; got: ${html}`,
    );
  }

  // Callback identity sanity: the render call above must NOT have
  // triggered onSelect by accident (e.g. via an effect or a
  // synchronous side-effect in the component). renderToStaticMarkup
  // strips events but does still run hooks like useEffect-as-init
  // patterns that some implementations use for "default-select"
  // behaviour. The assertion below guards against an implementer
  // who calls `props.onSelect` from the render body to "initialise"
  // the parent state.
  assert.equal(
    lastSelected,
    null,
    `render must not invoke onSelect as a render-time side effect; got lastSelected=${lastSelected}`,
  );
});

test("ColorModeFloatingButton (default): mode options are plain text without decorative colour markers", () => {
  const html = render({
    mode: "bottleneck-risk",
    onSelect: () => {},
  });

  assert.equal(
    (html.match(/data-testid="color-mode-option-marker"/g) ?? []).length,
    0,
    `mode options should not render decorative colour markers; got: ${html}`,
  );
});
