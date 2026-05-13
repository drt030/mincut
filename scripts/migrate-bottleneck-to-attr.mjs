#!/usr/bin/env node
/**
 * Migrate legacy `kind: "bottleneck"` and `kind: "placeholder_breakthrough"`
 * nodes (plus the `bottlenecked_by` edges that point to them) into
 * `bottleneckOf` / `frontierFor` string[] attributes on the source modules.
 *
 * Per ADR-0006: a node is a "bottleneck" because of its mode-derived color
 * (low maturity, high cost, high risk), not because it has a separate
 * placeholder node sitting next to it. The radial layout renders only
 * structural nodes; the former bottleneck / placeholder_breakthrough
 * descriptive nodes live in the detail panel as attribute-derived text.
 *
 * Usage:
 *   node scripts/migrate-bottleneck-to-attr.mjs              # dry-run (default)
 *   node scripts/migrate-bottleneck-to-attr.mjs --apply      # mutate files in-place
 *
 * Idempotent: running twice in a row on already-migrated data is a no-op
 * (no bottleneck-kind nodes left, no bottlenecked_by edges left, attributes
 * dedupe on re-append).
 *
 * Formatting policy: the script preserves the existing per-item formatting
 * of `data/nodes/*.json` and `data/edges/*.json` by operating as text
 * surgery on the raw file, not by re-serializing the whole array with
 * JSON.stringify. The existing files mix inline-object style (e.g.
 * `maturityHistory: [{...}, {...}]` with each entry on one line) with
 * block style; re-serializing would churn every line and bury the actual
 * migration diff under formatting noise. We therefore:
 *   - Compute the per-file removal/mutation plan from the parsed JSON.
 *   - Walk the raw text to find each top-level array item's byte range,
 *     using a small JSON-aware brace/bracket/string scanner.
 *   - For deletions: cut the item's range plus the following separator.
 *   - For mutations (add `bottleneckOf`/`frontierFor` keys): find the
 *     closing `}` of the item and inject the new keys with matching
 *     indentation right before it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const apply = process.argv.includes("--apply");
const dryRun = !apply;

const nodesDir = path.join(repoRoot, "data", "nodes");
const edgesDir = path.join(repoRoot, "data", "edges");
const evidenceDir = path.join(repoRoot, "data", "evidence");

function loadDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      const raw = fs.readFileSync(file, "utf8");
      return { file, name, raw, data: JSON.parse(raw) };
    });
}

const nodeFiles = loadDir(nodesDir);
const edgeFiles = loadDir(edgesDir);
const evidenceFiles = loadDir(evidenceDir);

// Global id index across all node files.
const nodeIndex = new Map();
for (const nf of nodeFiles) {
  for (const node of nf.data) {
    nodeIndex.set(node.id, { node, fileName: nf.name });
  }
}

const bottleneckIds = new Set();
const placeholderIds = new Set();
for (const { node } of nodeIndex.values()) {
  if (node.kind === "bottleneck") bottleneckIds.add(node.id);
  if (node.kind === "placeholder_breakthrough") placeholderIds.add(node.id);
}

// Per-module attribute plan.
const attrPlans = new Map(); // moduleId -> {bottleneckOf: Set, frontierFor: Set}
function planAttr(moduleId, kind, value) {
  if (!attrPlans.has(moduleId)) {
    attrPlans.set(moduleId, { bottleneckOf: new Set(), frontierFor: new Set() });
  }
  attrPlans.get(moduleId)[kind].add(value);
}

const placeholderRelations = new Map();
const edgeIdsToRemoveByFile = new Map(); // fileName -> Set of edge.id
function markEdgeForRemoval(fileName, edgeId) {
  if (!edgeIdsToRemoveByFile.has(fileName)) edgeIdsToRemoveByFile.set(fileName, new Set());
  edgeIdsToRemoveByFile.get(fileName).add(edgeId);
}

for (const ef of edgeFiles) {
  for (const edge of ef.data) {
    const targetIsBottleneck = bottleneckIds.has(edge.target);
    const targetIsPlaceholder = placeholderIds.has(edge.target);
    const sourceIsPlaceholder = placeholderIds.has(edge.source);
    const sourceIsBottleneck = bottleneckIds.has(edge.source);

    if (edge.relation === "bottlenecked_by" && (targetIsBottleneck || targetIsPlaceholder)) {
      if (targetIsBottleneck) {
        planAttr(edge.source, "bottleneckOf", edge.target);
      } else if (targetIsPlaceholder) {
        planAttr(edge.source, "frontierFor", edge.target);
        const r = edge.relation;
        placeholderRelations.set(r, (placeholderRelations.get(r) ?? 0) + 1);
      }
      markEdgeForRemoval(ef.name, edge.id);
    } else if (targetIsBottleneck || targetIsPlaceholder || sourceIsBottleneck || sourceIsPlaceholder) {
      // Edges touching a removed node from any other relation (e.g.
      // `placeholder_breakthrough --enables--> capability` stub edges).
      if ((targetIsPlaceholder || sourceIsPlaceholder) && !targetIsBottleneck && !sourceIsBottleneck) {
        const r = edge.relation;
        placeholderRelations.set(r, (placeholderRelations.get(r) ?? 0) + 1);
      }
      markEdgeForRemoval(ef.name, edge.id);
    }
  }
}

// Resolve per-module attribute additions (with dedupe against existing).
let modulesUpdated = 0;
let bottleneckOfAttrsAdded = 0;
let frontierForAttrsAdded = 0;

// Stash the *additions* per module (the set of new entries that need to
// be appended to whatever the file already has). We materialize the
// merged final array in-memory for accurate dry-run reporting, but for
// the actual text-surgery write we only need to know the additions.
const additionsByModule = new Map(); // moduleId -> {bottleneckOf: string[], frontierFor: string[]}

for (const [moduleId, plan] of attrPlans.entries()) {
  const entry = nodeIndex.get(moduleId);
  if (!entry) continue;
  const node = entry.node;
  const existingBN = new Set(Array.isArray(node.bottleneckOf) ? node.bottleneckOf : []);
  const existingFF = new Set(Array.isArray(node.frontierFor) ? node.frontierFor : []);
  const addBN = [...plan.bottleneckOf].filter((v) => !existingBN.has(v));
  const addFF = [...plan.frontierFor].filter((v) => !existingFF.has(v));
  if (addBN.length === 0 && addFF.length === 0) continue;
  additionsByModule.set(moduleId, { bottleneckOf: addBN, frontierFor: addFF });
  bottleneckOfAttrsAdded += addBN.length;
  frontierForAttrsAdded += addFF.length;
  modulesUpdated++;
}

// Node-id removal sets per file.
const nodeIdsToRemoveByFile = new Map();
function markNodeForRemoval(fileName, nodeId) {
  if (!nodeIdsToRemoveByFile.has(fileName)) nodeIdsToRemoveByFile.set(fileName, new Set());
  nodeIdsToRemoveByFile.get(fileName).add(nodeId);
}
let bottleneckNodesRemoved = 0;
let placeholderNodesRemoved = 0;
for (const { node, fileName } of nodeIndex.values()) {
  if (node.kind === "bottleneck") {
    markNodeForRemoval(fileName, node.id);
    bottleneckNodesRemoved++;
  } else if (node.kind === "placeholder_breakthrough") {
    markNodeForRemoval(fileName, node.id);
    placeholderNodesRemoved++;
  }
}

const totalEdgesRemoved = [...edgeIdsToRemoveByFile.values()].reduce((a, b) => a + b.size, 0);
const bottleneckedByEdgesRemoved = (() => {
  let n = 0;
  for (const ef of edgeFiles) {
    const removed = edgeIdsToRemoveByFile.get(ef.name) ?? new Set();
    for (const edge of ef.data) {
      if (removed.has(edge.id) && edge.relation === "bottlenecked_by") n++;
    }
  }
  return n;
})();

// Plan evidence cleanup: evidence records carry `supportsNodeIds` /
// `supportsEdgeIds` arrays that may reference now-removed nodes or
// edges. `validate:data` would fail if those references dangle. Build
// the global set of removed ids, then per-evidence-file, find every
// reference that needs to be pruned.
const allRemovedNodeIds = new Set();
for (const ids of nodeIdsToRemoveByFile.values()) for (const id of ids) allRemovedNodeIds.add(id);
const allRemovedEdgeIds = new Set();
for (const ids of edgeIdsToRemoveByFile.values()) for (const id of ids) allRemovedEdgeIds.add(id);

// Per-evidence-record planned filter: evidenceId -> { fileName, removeNodeIds: Set, removeEdgeIds: Set }
const evidencePlans = new Map();
let evidenceNodeRefsRemoved = 0;
let evidenceEdgeRefsRemoved = 0;
for (const evf of evidenceFiles) {
  for (const ev of evf.data) {
    const removeNodeIds = new Set();
    const removeEdgeIds = new Set();
    for (const id of ev.supportsNodeIds ?? []) {
      if (allRemovedNodeIds.has(id)) removeNodeIds.add(id);
    }
    for (const id of ev.supportsEdgeIds ?? []) {
      if (allRemovedEdgeIds.has(id)) removeEdgeIds.add(id);
    }
    if (removeNodeIds.size > 0 || removeEdgeIds.size > 0) {
      evidencePlans.set(ev.id, { fileName: evf.name, removeNodeIds, removeEdgeIds });
      evidenceNodeRefsRemoved += removeNodeIds.size;
      evidenceEdgeRefsRemoved += removeEdgeIds.size;
    }
  }
}

// -------------- Summary printing -------------------------------------------

console.log(`Migration plan (${dryRun ? "DRY RUN — no files written" : "APPLY MODE — writing files"}):`);
console.log("");
console.log(`  Bottleneck-kind nodes to remove: ${bottleneckNodesRemoved}`);
console.log(`  Placeholder_breakthrough-kind nodes to remove: ${placeholderNodesRemoved}`);
console.log(`  bottlenecked_by edges to remove: ${bottleneckedByEdgesRemoved}`);
console.log(`  Other edges touching removed nodes also removed: ${totalEdgesRemoved - bottleneckedByEdgesRemoved}`);
console.log("");
console.log(`  Modules gaining attributes: ${modulesUpdated}`);
console.log(`  bottleneckOf attribute values appended: ${bottleneckOfAttrsAdded}`);
console.log(`  frontierFor attribute values appended: ${frontierForAttrsAdded}`);
console.log("");
console.log(`  Evidence records with dangling refs cleaned: ${evidencePlans.size}`);
console.log(`    supportsNodeIds entries removed: ${evidenceNodeRefsRemoved}`);
console.log(`    supportsEdgeIds entries removed: ${evidenceEdgeRefsRemoved}`);
console.log("");

if (placeholderRelations.size > 0) {
  const sorted = [...placeholderRelations.entries()].sort((a, b) => b[1] - a[1]);
  console.log("  Edge relations seen touching placeholder_breakthrough nodes (descending):");
  for (const [r, n] of sorted) console.log(`    - ${r}: ${n}`);
  console.log("");
}

if (additionsByModule.size > 0) {
  console.log("  Per-module attribute additions:");
  for (const [moduleId, add] of additionsByModule.entries()) {
    const parts = [];
    if (add.bottleneckOf.length > 0) parts.push(`bottleneckOf+=[${add.bottleneckOf.join(", ")}]`);
    if (add.frontierFor.length > 0) parts.push(`frontierFor+=[${add.frontierFor.join(", ")}]`);
    console.log(`    ${moduleId} -> ${parts.join("; ")}`);
  }
  console.log("");
}

// -------------- Text surgery -----------------------------------------------

/**
 * Find the byte ranges of each top-level array element in a JSON file
 * whose contents are a top-level array. Returns an array of `{start, end}`
 * where `start` is the index of the first character of the element (the
 * opening `{` for object elements) and `end` is the index *just past* the
 * matching close. Handles strings (with escapes), nested braces / brackets.
 */
function scanTopLevelItems(raw) {
  const items = [];
  let i = 0;
  // Skip whitespace + opening `[`.
  while (i < raw.length && raw[i] !== "[") i++;
  if (raw[i] !== "[") throw new Error("expected top-level array");
  i++;
  while (i < raw.length) {
    // Skip whitespace and commas between items.
    while (i < raw.length && /[\s,]/.test(raw[i])) i++;
    if (raw[i] === "]") break;
    if (i >= raw.length) break;
    const startIdx = i;
    // Walk the value. The top-level items are objects, so we expect `{`.
    if (raw[i] !== "{") throw new Error(`expected object at ${i}, got '${raw[i]}'`);
    let depth = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (ch === '"') {
        // Skip string.
        i++;
        while (i < raw.length) {
          if (raw[i] === "\\") {
            i += 2;
            continue;
          }
          if (raw[i] === '"') {
            i++;
            break;
          }
          i++;
        }
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          i++;
          items.push({ start: startIdx, end: i });
          break;
        }
      }
      i++;
    }
  }
  return items;
}

/**
 * Given the text of one top-level item (a JSON object spanning multiple
 * lines), figure out the indentation used for its keys. We sample the
 * second line's leading whitespace; if the item is single-line, we return
 * "  " as a fallback and emit single-line additions.
 *
 * Returns `{indent, multiline}`. `indent` is the leading whitespace
 * string used by member lines (e.g. "    " for the standard 4-space
 * nested indent in our files). `multiline` indicates whether the object
 * spans more than one line.
 */
function detectIndent(itemText) {
  const lines = itemText.split("\n");
  if (lines.length === 1) return { indent: "  ", multiline: false };
  // Find the first non-empty line after the opening line that has leading whitespace.
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(/^(\s+)\S/);
    if (m) return { indent: m[1], multiline: true };
  }
  return { indent: "    ", multiline: true };
}

/**
 * Emit a new JSON object key/value pair in block style aligned to the
 * given indent. `value` is a string[]; render each entry on its own line
 * inside a block array, matching the existing style used in
 * `data/nodes/parcel_sorting_robot.json` for fields like `evidenceIds`
 * and `domain`.
 */
function emitArrayMember(key, values, indent) {
  const inner = values.map((v) => `${indent}  ${JSON.stringify(v)}`).join(",\n");
  return `"${key}": [\n${inner}\n${indent}]`;
}

/**
 * Inject new top-level keys (bottleneckOf / frontierFor) into the text
 * of an existing object item that has neither key yet (or that has
 * one of them — we then append only the missing additions to the
 * already-present array, leaving the other untouched).
 *
 * For simplicity in this migration we assume neither key is already
 * present (validated by `additionsByModule` only listing modules that
 * gain at least one new value; idempotent re-runs filter out anything
 * already present in the existing arrays).
 *
 * Returns the rewritten item text.
 */
function injectMembers(itemText, additions, indent) {
  // Find the closing `}` of the object (last non-whitespace `}` in the text).
  // The item text always ends with `}` per the scanner contract.
  if (!itemText.endsWith("}")) throw new Error("item does not end with }");

  // Locate the position of the closing `}` and the preceding non-whitespace
  // char so we know whether the last member had a trailing comma already.
  let i = itemText.length - 1; // closing `}`
  let j = i - 1;
  while (j >= 0 && /\s/.test(itemText[j])) j--;
  // `j` now points at the last non-whitespace char before `}`.
  const beforeClose = itemText.slice(0, j + 1);
  const whitespaceBeforeClose = itemText.slice(j + 1, i); // includes the newline and indent of the closing `}`
  const closing = itemText.slice(i); // `}`

  // Check whether key already exists by name (for the case where the
  // existing node has e.g. `bottleneckOf` from a partial prior run); we
  // skip the existing one and only inject what's missing. Because
  // `additionsByModule` already excluded entries that were already
  // present element-wise, the only special case is "the key exists but
  // we still have entries to add" — that means we need to extend the
  // existing array rather than create a new one. Handle the common case
  // first (no existing key); fall back to a hash-check otherwise.
  const newPieces = [];
  if (additions.bottleneckOf.length > 0) {
    if (new RegExp(`"bottleneckOf"\\s*:`).test(itemText)) {
      // Existing key present — extend in place.
      return extendExistingArray(itemText, "bottleneckOf", additions.bottleneckOf, indent);
    }
    newPieces.push(emitArrayMember("bottleneckOf", additions.bottleneckOf, indent));
  }
  if (additions.frontierFor.length > 0) {
    if (new RegExp(`"frontierFor"\\s*:`).test(itemText)) {
      let text = itemText;
      if (additions.bottleneckOf.length > 0 && !new RegExp(`"bottleneckOf"\\s*:`).test(itemText)) {
        text = injectMembers(text, { bottleneckOf: additions.bottleneckOf, frontierFor: [] }, indent);
      }
      return extendExistingArray(text, "frontierFor", additions.frontierFor, indent);
    }
    newPieces.push(emitArrayMember("frontierFor", additions.frontierFor, indent));
  }
  if (newPieces.length === 0) return itemText;

  // Build insertion. We need a leading comma if `beforeClose` does not
  // end in `,` or `{`.
  const lastChar = beforeClose[beforeClose.length - 1];
  const leadComma = lastChar === "," || lastChar === "{" ? "" : ",";
  const sep = `\n${indent}`;
  const inserted = leadComma + newPieces.map((p) => sep + p).join(",");
  return beforeClose + inserted + whitespaceBeforeClose + closing;
}

/**
 * Extend an existing array-valued member by appending new string values
 * before the closing `]`. Used for idempotent extension when a prior
 * migration partial-ran.
 */
function extendExistingArray(itemText, key, additions, indent) {
  const re = new RegExp(`("${key}"\\s*:\\s*\\[)([\\s\\S]*?)(\\])`);
  return itemText.replace(re, (_full, open, body, close) => {
    // If body is empty (just whitespace), produce a fresh block array
    // with our additions; otherwise append to the existing items.
    const trimmedBody = body.trim();
    const newItems = additions.map((v) => `${indent}  ${JSON.stringify(v)}`).join(",\n");
    if (trimmedBody === "") {
      return `${open}\n${newItems}\n${indent}${close}`;
    }
    // Append: insert a comma after the existing last item, then our new items.
    // Conservatively reconstruct: strip trailing whitespace from body, ensure
    // it ends without a trailing comma, then add `,\n` + new items + newline.
    let bodyTail = body.replace(/\s+$/, "");
    if (bodyTail.endsWith(",")) bodyTail = bodyTail.slice(0, -1);
    return `${open}${bodyTail},\n${newItems}\n${indent}${close}`;
  });
}

/**
 * Rewrite a whole file's text by applying per-item deletions and
 * per-item mutations. The strategy is to walk the items in order,
 * accumulating output. For each item, we emit either:
 *   - nothing (deletion), AND consume the trailing comma + leading
 *     whitespace before the next item or before the closing `]`;
 *   - the original text (unchanged); or
 *   - a mutated text with new keys injected.
 */
function rewriteFile(raw, itemMatcher) {
  // itemMatcher(itemText) returns one of:
  //   { action: "keep" }
  //   { action: "delete" }
  //   { action: "mutate", text: <new text> }
  const items = scanTopLevelItems(raw);
  if (items.length === 0) return raw;

  // Emit prefix (text before the first item, which includes `[` + whitespace).
  let out = raw.slice(0, items[0].start);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const itemText = raw.slice(item.start, item.end);
    // The separator between this item and the next (or the trailing `]`)
    // is the substring from `item.end` to the next item's `.start` (or to
    // the file's closing `]` for the last item).
    const sepEnd = idx + 1 < items.length ? items[idx + 1].start : raw.indexOf("]", item.end);
    const sepText = raw.slice(item.end, sepEnd);

    const decision = itemMatcher(itemText);
    if (decision.action === "keep") {
      out += itemText + sepText;
    } else if (decision.action === "mutate") {
      out += decision.text + sepText;
    } else if (decision.action === "delete") {
      // Drop the item AND the separator between it and the next item.
      // But: if this is the last item, the separator we'd be dropping
      // contains the trailing newline before the closing `]`. We need
      // to keep that — otherwise we'd splice the `]` onto the previous
      // item line. So:
      //   - If not last item: drop both the item and its trailing
      //     separator (next item's leading "," and indentation).
      //   - If last item: drop the item, but we also need to strip the
      //     trailing `,` from the PRIOR item if any. Easier: keep a
      //     short pretty newline-and-`]`-indent string after the last
      //     remaining item; we know what the original looked like by
      //     checking what sepText after the last not-deleted item is.
      // For correctness we simply skip the item-and-sep here. After the
      // full pass, we do a small fix-up below to normalize the trailing
      // comma situation.
      // For non-last items: append nothing.
      // For last item: also append nothing; we'll have a `,` to clean.
    }
  }

  // Append the closing `]` and any trailing text (e.g. trailing newline).
  const closingStart = raw.indexOf("]", items[items.length - 1].end);
  out += raw.slice(closingStart);

  // Fix-up: a trailing `,` immediately before the closing `]` (possibly
  // with whitespace between) is invalid JSON and would happen if the
  // last item got deleted. Strip it.
  out = out.replace(/,(\s*)\]/g, "$1]");

  return out;
}

// -------------- Apply pass --------------------------------------------------

function planForNodeFile(nf) {
  const removeIds = nodeIdsToRemoveByFile.get(nf.name) ?? new Set();
  // Map id → additions for fast lookup.
  return function matcher(itemText) {
    const idMatch = itemText.match(/"id"\s*:\s*"([^"]+)"/);
    if (!idMatch) return { action: "keep" };
    const id = idMatch[1];
    if (removeIds.has(id)) return { action: "delete" };
    const additions = additionsByModule.get(id);
    if (!additions) return { action: "keep" };
    const { indent } = detectIndent(itemText);
    const newText = injectMembers(itemText, additions, indent);
    return { action: "mutate", text: newText };
  };
}

function planForEdgeFile(ef) {
  const removeIds = edgeIdsToRemoveByFile.get(ef.name) ?? new Set();
  return function matcher(itemText) {
    const idMatch = itemText.match(/"id"\s*:\s*"([^"]+)"/);
    if (!idMatch) return { action: "keep" };
    const id = idMatch[1];
    if (removeIds.has(id)) return { action: "delete" };
    return { action: "keep" };
  };
}

/**
 * For an evidence file, mutate any record whose `supportsNodeIds` or
 * `supportsEdgeIds` array contains a now-removed id. The mutation only
 * removes the offending string entries — the rest of the array (and the
 * rest of the record) stays byte-identical.
 *
 * Both inline (`[..."x"...]`) and block (`[\n  "x"\n]`) array styles are
 * handled via a regex that targets the value's literal text plus any
 * adjacent comma/whitespace.
 */
function planForEvidenceFile(evf) {
  return function matcher(itemText) {
    const idMatch = itemText.match(/"id"\s*:\s*"([^"]+)"/);
    if (!idMatch) return { action: "keep" };
    const plan = evidencePlans.get(idMatch[1]);
    if (!plan || plan.fileName !== evf.name) return { action: "keep" };
    let next = itemText;
    for (const removedId of plan.removeNodeIds) {
      next = removeArrayStringEntry(next, "supportsNodeIds", removedId);
    }
    for (const removedId of plan.removeEdgeIds) {
      next = removeArrayStringEntry(next, "supportsEdgeIds", removedId);
    }
    return { action: "mutate", text: next };
  };
}

/**
 * Remove a single `"value"` entry from the named array within `itemText`,
 * preserving the surrounding formatting. Handles both inline (comma-
 * separated single-line) and block (one element per line) styles.
 */
function removeArrayStringEntry(itemText, key, value) {
  // Build a regex that matches the array region and inner items so we can
  // operate on it as a unit. Simple approach: locate the `"key": [`
  // substring, then walk character-by-character to the matching `]`.
  const keyAnchor = new RegExp(`"${key}"\\s*:\\s*\\[`);
  const m = keyAnchor.exec(itemText);
  if (!m) return itemText;
  let i = m.index + m[0].length;
  let depth = 1;
  let inString = false;
  let escape = false;
  let close = -1;
  for (; i < itemText.length; i++) {
    const ch = itemText[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return itemText;
  const arrayOpen = m.index + m[0].length; // index just after `[`
  const arrayBody = itemText.slice(arrayOpen, close);

  // Try block style first: a line whose content (after indent) is the
  // quoted value, possibly followed by a trailing comma.
  const valueQuoted = JSON.stringify(value);
  const blockRe = new RegExp(`(^|,)([ \\t]*\\n[ \\t]*${escapeRegex(valueQuoted)}\\s*)(?=,|\\n[ \\t]*$)`, "m");
  // Simpler: do a focused removal. We support 4 cases:
  //   (a) inline middle: `"a", "removed", "c"` -> `"a", "c"`
  //   (b) inline last:   `"a", "removed"` -> `"a"`
  //   (c) inline first:  `"removed", "b"` -> `"b"`
  //   (d) inline only:   `"removed"` -> ``
  //   (e) block lines:   one entry per line — drop the line including
  //                      its trailing comma if any.
  let newBody = arrayBody;

  // Block-line pattern: capture leading newline+indent + `"value"` + optional `,` + optional whitespace before next newline.
  const blockLine = new RegExp(`\\n[ \\t]*${escapeRegex(valueQuoted)}\\s*,?`);
  if (blockLine.test(newBody)) {
    newBody = newBody.replace(blockLine, "");
  } else {
    // Inline patterns. Try `, "value"` first (cases a/b).
    const inlineAfter = new RegExp(`,\\s*${escapeRegex(valueQuoted)}`);
    if (inlineAfter.test(newBody)) {
      newBody = newBody.replace(inlineAfter, "");
    } else {
      // Try `"value",` (case c).
      const inlineBefore = new RegExp(`${escapeRegex(valueQuoted)}\\s*,\\s*`);
      if (inlineBefore.test(newBody)) {
        newBody = newBody.replace(inlineBefore, "");
      } else {
        // Try bare `"value"` (case d).
        const inlineOnly = new RegExp(escapeRegex(valueQuoted));
        if (inlineOnly.test(newBody)) {
          newBody = newBody.replace(inlineOnly, "");
        }
      }
    }
  }
  // Defensive: trailing comma directly before close bracket.
  newBody = newBody.replace(/,(\s*)$/, "$1");

  return itemText.slice(0, arrayOpen) + newBody + itemText.slice(close);
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (dryRun) {
  console.log("(dry-run; pass --apply to write files)");
  process.exit(0);
}

let filesWritten = 0;
for (const nf of nodeFiles) {
  const hasRemoves = (nodeIdsToRemoveByFile.get(nf.name) ?? new Set()).size > 0;
  const hasMutations = nf.data.some((n) => additionsByModule.has(n.id));
  if (!hasRemoves && !hasMutations) continue;
  const next = rewriteFile(nf.raw, planForNodeFile(nf));
  if (next !== nf.raw) {
    fs.writeFileSync(nf.file, next, "utf8");
    filesWritten++;
    console.log(`  wrote ${nf.name}`);
  }
}
for (const ef of edgeFiles) {
  const hasRemoves = (edgeIdsToRemoveByFile.get(ef.name) ?? new Set()).size > 0;
  if (!hasRemoves) continue;
  const next = rewriteFile(ef.raw, planForEdgeFile(ef));
  if (next !== ef.raw) {
    fs.writeFileSync(ef.file, next, "utf8");
    filesWritten++;
    console.log(`  wrote ${ef.name}`);
  }
}
for (const evf of evidenceFiles) {
  const hasMutations = evf.data.some((ev) => {
    const plan = evidencePlans.get(ev.id);
    return plan && plan.fileName === evf.name;
  });
  if (!hasMutations) continue;
  const next = rewriteFile(evf.raw, planForEvidenceFile(evf));
  if (next !== evf.raw) {
    fs.writeFileSync(evf.file, next, "utf8");
    filesWritten++;
    console.log(`  wrote ${evf.name}`);
  }
}
console.log("");
console.log(`Wrote ${filesWritten} file(s).`);
