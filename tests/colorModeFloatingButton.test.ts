import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// RED Slice B1 (spec:
// docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md;
// ADR-0006 §"Chrome (toolbar)" — "Color mode + 5-stop legend: bottom-
// left floating icon button, expands to full selector on click").
//
// `ColorModeFloatingButton` REPLACES the legacy `ColorModeSelect`
// dropdown (deleted in slice A3). Per ADR-0006:
//
//   - Default state: collapsed icon button positioned bottom-left.
//   - Expanded state: 5 mode options + a 5-stop legend visualising
//     the active mode's colour ramp.
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
  expanded?: boolean;
  onSelect: (next: ColorMode) => void;
  onToggle?: () => void;
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

// -------------------- Assertion 1: Default (collapsed) render --------------------

/**
 * Collapsed state must render:
 *   - A small icon button identifiable via a stable test hook
 *     (`data-testid="color-mode-button"`). The bring-back says
 *     "(or similar pinned hook)" — we pin this exact value so the
 *     GREEN commit and any future test (e.g. uxSmoke integration)
 *     share the same selector.
 *   - Positioned bottom-left via CSS. `renderToStaticMarkup` emits
 *     inline `style="..."` strings for React's `style` prop, so we
 *     can check for `position: fixed`, `bottom:` and `left:`
 *     substrings without coupling to a specific px value.
 *   - The current mode label is reachable somewhere in the
 *     collapsed output (so the user knows which mode is active
 *     before opening the selector).
 *
 * The collapsed output MUST NOT contain the full option list — the
 * 5-mode selector should only render when `expanded` is true. We
 * verify this by counting that AT MOST one mode label fragment
 * appears (the active mode's), not all 5.
 */
test("ColorModeFloatingButton (collapsed): bottom-left icon button with current mode label and stable test hook", () => {
  const html = render({
    mode: "bottleneck-risk",
    expanded: false,
    onSelect: () => {},
  });

  // Stable test hook.
  assert.match(
    html,
    /data-testid="color-mode-button"/,
    `collapsed render must expose data-testid="color-mode-button"; got: ${html}`,
  );

  // CSS positioning: `position: fixed; bottom: <X>; left: <Y>`.
  // React inlines the style prop, so the string will contain those
  // CSS tokens directly. We accept any value (including 0 or any
  // numeric px / rem) by anchoring only the property names.
  assert.match(
    html,
    /position:\s*fixed/,
    `collapsed render must set CSS position: fixed; got: ${html}`,
  );
  assert.match(
    html,
    /bottom:\s*[^;"]+/,
    `collapsed render must set CSS bottom; got: ${html}`,
  );
  assert.match(
    html,
    /left:\s*[^;"]+/,
    `collapsed render must set CSS left; got: ${html}`,
  );

  // The current mode label fragment must appear at least once.
  assert.match(
    html,
    MODE_LABEL_REGEXES["bottleneck-risk"],
    `collapsed render must include the current mode's label fragment; got: ${html}`,
  );

  // The OTHER 4 mode labels must NOT appear when collapsed — otherwise
  // the collapsed state effectively pre-renders the full selector.
  // We pick three labels whose regexes are unambiguous: `cost`,
  // `maturity`, and `relation`. (`overall` is excluded because the
  // word "overall" could legitimately appear in copy like "Overall
  // risk view" even when collapsed.)
  for (const other of ["cost", "maturity", "relation"] as const) {
    assert.doesNotMatch(
      html,
      MODE_LABEL_REGEXES[other],
      `collapsed render must NOT show option "${other}"; got: ${html}`,
    );
  }
});

// -------------------- Assertion 2: Expanded render --------------------

/**
 * Expanded state must render:
 *   - All 5 mode option labels (the 5 ColorMode strings via their
 *     loose copy fragments above).
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
test("ColorModeFloatingButton (expanded): 5 mode options visible + 5-stop legend", () => {
  const html = render({
    mode: "cost",
    expanded: true,
    onSelect: () => {},
  });

  // All 5 mode labels appear.
  for (const mode of ALL_MODES) {
    assert.match(
      html,
      MODE_LABEL_REGEXES[mode],
      `expanded render must include option label for "${mode}"; got: ${html}`,
    );
  }

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
      `expanded render must have 5 swatches with data-testid="color-mode-swatch"; got ${swatchHookCount}`,
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
      `expanded render must contain a 5-stop colour legend; found rect=${rectCount} div=${divSwatchCount} li=${liSwatchCount}; got: ${html}`,
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
test("ColorModeFloatingButton (expanded): one data-mode option element per ColorMode", () => {
  let lastSelected: ColorMode | null = null;
  const onSelect = (next: ColorMode) => {
    lastSelected = next;
  };
  const html = render({
    mode: "maturity",
    expanded: true,
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
