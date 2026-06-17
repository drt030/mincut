import fs from "node:fs";

/**
 * `check:disclosure` — the machine floor for `docs/ACCEPTANCE.md` §4.
 *
 * It enforces the cheapest, agent-free slice of the disclosure contract
 * (the QA agent owns whether the disclosure is actually *clear* — §3):
 *
 *   (a) Lens vocabulary (§3b). The live lens selector exposes exactly the
 *       three §2 lenses — `System decomposition`, `Chokepoint`, `Cost` —
 *       and never a `Maturity` or `Bottleneck risk` lens label. This is the
 *       check that would have caught the lens-label drift on 2026-06-15.
 *   (b) First-glance headline (§3a). `NodeDetailPanel.tsx` renders an
 *       element carrying `data-testid="detail-chokepoint-headline"` so the
 *       chokepoint verdict + elevated axis lead the detail surface.
 *   (c) Zero-holder Concentration wording (§3a). A `0` holder state is a
 *       supply-source gap / unverified-holder state, not a confirmed
 *       "0 suppliers" count.
 *
 * It is mirror-style to `scripts/check-graph-topology.ts` /
 * `scripts/check-graph-ux.mjs`: static analysis over the source of truth,
 * exit nonzero on violation. The live lens selector is
 * `src/components/GraphControls.tsx` — NOT the deprecated `ColorModeSelect`
 * / `colorMode*` i18n keys (those are forbidden by `check:graph-ux`). The
 * labels the selector renders live in that component's
 * `ANALYSIS_MODE_LABELS` map, keyed by the option list `ANALYSIS_MODE_OPTIONS`.
 */

const GRAPH_CONTROLS_PATH = "src/components/GraphControls.tsx";
const NODE_DETAIL_PANEL_PATH = "src/components/NodeDetailPanel.tsx";
const LANGUAGE_PROVIDER_PATH = "src/components/LanguageProvider.tsx";

// The §2 vocabulary: exactly these three lens labels, no more, no less.
const REQUIRED_LENS_LABELS = ["System decomposition", "Chokepoint", "Cost"];
// Labels that mean the model drifted back to the pre-ADR-0010 vocabulary.
const FORBIDDEN_LENS_LABELS = ["Maturity", "Bottleneck risk", "Cost drivers"];

const failures: string[] = [];

function readSource(path: string): string {
  if (!fs.existsSync(path)) {
    failures.push(`expected ${path} to exist (lens-selector / detail-panel source moved?).`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

/**
 * Extract a quoted-string array literal assigned to `name` from `source`,
 * e.g. `const ANALYSIS_MODE_OPTIONS: ... = ["relation", "cost"];` → the
 * list of element strings. Returns null when the declaration is absent.
 */
function extractStringArray(source: string, name: string): string[] | null {
  const match = source.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`));
  if (!match) return null;
  const items = [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  return items;
}

/**
 * Extract a `Record`-style object literal assigned to `name` into a map of
 * key → value, reading only simple `key: "value"` / `"key": "value"` pairs.
 */
function extractRecord(source: string, name: string): Record<string, string> | null {
  const match = source.match(new RegExp(`${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!match) return null;
  const record: Record<string, string> = {};
  for (const pair of match[1].matchAll(/["']?([\w-]+)["']?\s*:\s*["']([^"']*)["']/g)) {
    record[pair[1]] = pair[2];
  }
  return record;
}

// ── (a) Lens vocabulary ──────────────────────────────────────────────────
const controls = readSource(GRAPH_CONTROLS_PATH);
if (controls) {
  const options = extractStringArray(controls, "ANALYSIS_MODE_OPTIONS");
  const labels = extractRecord(controls, "ANALYSIS_MODE_LABELS");

  if (!options) {
    failures.push(`${GRAPH_CONTROLS_PATH}: could not find the ANALYSIS_MODE_OPTIONS lens list.`);
  } else if (!labels) {
    failures.push(`${GRAPH_CONTROLS_PATH}: could not find the ANALYSIS_MODE_LABELS map.`);
  } else {
    // Each rendered button shows `copy.modeLabels[mode]` (EN map), so the
    // resolved label set must match what the user sees on the canvas.
    const rendered = options.map((option) => labels[option] ?? option);

    for (const required of REQUIRED_LENS_LABELS) {
      if (!rendered.includes(required)) {
        failures.push(
          `${GRAPH_CONTROLS_PATH}: lens selector is missing the "${required}" lens (rendered: ${rendered.join(", ") || "none"}).`,
        );
      }
    }
    for (const forbidden of FORBIDDEN_LENS_LABELS) {
      if (rendered.includes(forbidden)) {
        failures.push(
          `${GRAPH_CONTROLS_PATH}: lens selector still exposes the forbidden "${forbidden}" lens label (model moved to Chokepoint/Cost/Barrier per ADR-0010).`,
        );
      }
    }
    if (rendered.length !== REQUIRED_LENS_LABELS.length) {
      failures.push(
        `${GRAPH_CONTROLS_PATH}: lens selector renders ${rendered.length} lenses (${rendered.join(", ")}); §2 mandates exactly ${REQUIRED_LENS_LABELS.length} (${REQUIRED_LENS_LABELS.join(", ")}).`,
      );
    }
  }
}

// ── (b) First-glance headline ────────────────────────────────────────────
const detailPanel = readSource(NODE_DETAIL_PANEL_PATH);
if (detailPanel && !/data-testid=["']detail-chokepoint-headline["']/.test(detailPanel)) {
  failures.push(
    `${NODE_DETAIL_PANEL_PATH}: missing the first-glance element data-testid="detail-chokepoint-headline" (§3a chokepoint verdict + elevated axis).`,
  );
}

// ── (c) Zero-holder Concentration wording ────────────────────────────────
if (detailPanel && !/chokepointAxisConcentrationGap/.test(detailPanel)) {
  failures.push(
    `${NODE_DETAIL_PANEL_PATH}: Concentration headline needs a zero-holder gap branch; zero modeled holders must not render as a confirmed "0 suppliers" count (§3a).`,
  );
}
const languageProvider = readSource(LANGUAGE_PROVIDER_PATH);
if (languageProvider && !/chokepointAxisConcentrationGap/.test(languageProvider)) {
  failures.push(
    `${LANGUAGE_PROVIDER_PATH}: missing chokepointAxisConcentrationGap copy for zero-holder Concentration disclosure (§3a).`,
  );
}

if (failures.length > 0) {
  console.error("Disclosure checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Disclosure checks passed.");
