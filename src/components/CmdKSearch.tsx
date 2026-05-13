"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GraphData, Node } from "@/lib/schema";

/**
 * Slice C2 — Cmd+K search modal (per ADR-0006 §Chrome (toolbar):
 * "Cmd+K search: no visible button; fuzzy-searches node names and
 * metric/evidence text; Enter flies-to") and the 2026-05-13 radial
 * progressive-disclosure spec.
 *
 * This module exports three symbols:
 *
 *   - `fuzzyMatch(query, graph, limit?)`: pure scoring function over
 *     node names + descriptions + metric names + tags. Empty query
 *     returns `[]` (no implicit "show all"); a no-match query also
 *     returns `[]`. Results are deduped by `nodeId`, sorted by score
 *     descending, and capped at `limit` (default 10). Each entry
 *     carries the `matchText` snippet that surfaced the hit so the
 *     UI can show context, not just the node name.
 *
 *   - `CmdKSearch`: a presentational React component. The parent (page
 *     / GraphExplorer) owns the `open` boolean and renders this
 *     component unconditionally; when `open === false` the component
 *     returns `null` (no hidden DOM, no testids, no event listeners).
 *     When open, it renders a backdrop + centered modal containing
 *     an autofocused `<input>` and a `<ul>` of fuzzy-match results.
 *     Selecting a result (Enter on the highlighted row, click on a
 *     row, or Enter while typing if the first result is the implicit
 *     highlight) calls `onSelect(nodeId)` then `onClose()`. Esc and a
 *     backdrop click both call `onClose()` without selecting.
 *
 *   - `handleCmdKKeydown(event, setOpen)`: a pure dispatcher meant to
 *     be wired into a document-level keydown listener by the parent.
 *     `Meta+K` / `Ctrl+K` calls `setOpen(true)`; `Escape` calls
 *     `setOpen(false)`. Other keys are ignored — a naked `k` must NOT
 *     toggle (otherwise typing the letter `k` in any input opens the
 *     modal). The handler is intentionally state-free; the caller's
 *     React `setOpen` state setter handles idempotence.
 *
 * The modal itself does not know about React Flow, the radial layout,
 * or which node is currently focused — the parent's `onSelect` does
 * the flyTo + focus side-effect. That separation is what makes the
 * modal cheap to unit-test via `renderToStaticMarkup` and `fuzzyMatch`
 * cheap to unit-test as a pure function.
 */

export type FuzzyMatchResult = {
  nodeId: string;
  matchText: string;
  score: number;
};

const MAX_MATCH_TEXT_LENGTH = 120;

/**
 * Truncate a candidate `matchText` snippet so the modal can render it
 * inline without wrapping multi-line. The cutoff is generous enough to
 * show the surrounding sentence on a metric/evidence hit.
 */
function truncate(text: string): string {
  if (text.length <= MAX_MATCH_TEXT_LENGTH) return text;
  return text.slice(0, MAX_MATCH_TEXT_LENGTH - 1) + "…";
}

/**
 * Score a single (query, field) hit. Substring match required;
 * additional bonuses:
 *
 *   - +5 if the field starts with the query (prefix bonus). This
 *     surfaces `vision_barcode_label_recognition` over
 *     `dimensioning_vision` when the query is `"vision"`.
 *   - +2 if the field exactly equals the query.
 *   - +0 baseline for an interior substring hit.
 *
 * Returns `null` when there is no substring match.
 */
function scoreField(query: string, field: string): number | null {
  if (!field) return null;
  const haystack = field.toLowerCase();
  const idx = haystack.indexOf(query);
  if (idx < 0) return null;
  let score = 1;
  if (idx === 0) score += 5;
  if (haystack === query) score += 2;
  return score;
}

/**
 * Search a node and return the best (score, matchText) pair from any
 * of its searchable fields, or `null` when nothing matched. Fields
 * searched (in priority order so that name hits win ties via the
 * prefix bonus + earlier field iteration):
 *
 *   1. `name` (most user-recognisable, drives the prefix bonus).
 *   2. `id` (in case a node is referenced by id elsewhere).
 *   3. `description` (catches metric/evidence-like prose stored on
 *      the node directly).
 *   4. `metrics[].name` (substring-match against metric titles).
 *   5. `tags[]`.
 *
 * The pure-function shape (no I/O, deterministic) means the test can
 * call it directly without mounting the React component.
 */
function bestNodeMatch(
  query: string,
  node: Node,
): { score: number; matchText: string } | null {
  let best: { score: number; matchText: string } | null = null;
  const consider = (score: number | null, raw: string) => {
    if (score === null) return;
    if (best === null || score > best.score) {
      best = { score, matchText: truncate(raw) };
    }
  };
  consider(scoreField(query, node.name), node.name);
  consider(scoreField(query, node.id), node.name);
  if (typeof node.description === "string") {
    consider(scoreField(query, node.description), node.description);
  }
  if (Array.isArray(node.metrics)) {
    for (const metric of node.metrics) {
      consider(scoreField(query, metric.name), `${node.name} · ${metric.name}`);
      if (typeof metric.description === "string") {
        consider(
          scoreField(query, metric.description),
          `${node.name} · ${metric.description}`,
        );
      }
    }
  }
  if (Array.isArray(node.tags)) {
    for (const tag of node.tags) {
      consider(scoreField(query, tag), `${node.name} · #${tag}`);
    }
  }
  return best;
}

/**
 * Pure fuzzy-match scorer over a `GraphData`. Empty query returns
 * `[]` (no implicit "show all"); a no-match query returns `[]`.
 * Results are deduped by `nodeId` (a node that matches both via its
 * name and its description surfaces once with the highest score) and
 * sorted by score descending. Capped at `limit` (default 10).
 */
export function fuzzyMatch(
  query: string,
  graph: GraphData,
  limit: number = 10,
): FuzzyMatchResult[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return [];
  }
  const byNodeId = new Map<string, FuzzyMatchResult>();
  for (const node of graph.nodes) {
    const match = bestNodeMatch(trimmed, node);
    if (match === null) continue;
    const existing = byNodeId.get(node.id);
    if (existing === undefined || match.score > existing.score) {
      byNodeId.set(node.id, {
        nodeId: node.id,
        matchText: match.matchText,
        score: match.score,
      });
    }
  }
  const results = [...byNodeId.values()];
  // Stable sort: primary by score desc, secondary by nodeId asc so two
  // results with equal score have a deterministic order.
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.nodeId.localeCompare(b.nodeId);
  });
  return results.slice(0, Math.max(0, limit));
}

/**
 * Pure dispatcher for the Cmd+K hotkey. Intended to be wired into a
 * document-level keydown listener by the parent:
 *
 *   useEffect(() => {
 *     const onKey = (e: KeyboardEvent) => handleCmdKKeydown(e, setOpen);
 *     window.addEventListener("keydown", onKey);
 *     return () => window.removeEventListener("keydown", onKey);
 *   }, []);
 *
 * `Meta+K` / `Ctrl+K` → `setOpen(true)`. `Escape` → `setOpen(false)`.
 * All other keys are ignored. Critically, a naked `k` (no modifier)
 * must NOT toggle the modal — typing the letter `k` in any input
 * would otherwise open it.
 */
export function handleCmdKKeydown(
  event: KeyboardEvent,
  setOpen: (next: boolean) => void,
): void {
  const key = event.key;
  if ((event.metaKey || event.ctrlKey) && (key === "k" || key === "K")) {
    if (typeof event.preventDefault === "function") event.preventDefault();
    setOpen(true);
    return;
  }
  if (key === "Escape") {
    setOpen(false);
    return;
  }
}

export type CmdKSearchProps = {
  graph: GraphData;
  open: boolean;
  onClose: () => void;
  onSelect: (nodeId: string) => void;
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 42, 0.55)",
  zIndex: 1000,
};

const MODAL_STYLE: React.CSSProperties = {
  position: "fixed",
  top: "20vh",
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(480px, 92vw)",
  background: "var(--surface-elevated, #ffffff)",
  color: "var(--text-primary, #111827)",
  borderRadius: 12,
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.35)",
  zIndex: 1001,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  fontSize: 16,
  border: "none",
  borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
  outline: "none",
  background: "transparent",
  color: "inherit",
  boxSizing: "border-box",
};

const RESULTS_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  maxHeight: "50vh",
  overflowY: "auto",
};

const RESULT_ROW_STYLE_BASE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "10px 16px",
  cursor: "pointer",
  borderTop: "1px solid rgba(15, 23, 42, 0.04)",
};

const RESULT_NAME_STYLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
};

const RESULT_SNIPPET_STYLE: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.7,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const EMPTY_HINT_STYLE: React.CSSProperties = {
  padding: "16px",
  fontSize: 13,
  opacity: 0.6,
  textAlign: "center",
};

/**
 * Cmd+K search modal. Presentational only — the parent supplies the
 * `onSelect` callback that performs the flyTo + focus action and the
 * `onClose` callback that flips its `open` state. Renders `null` when
 * `open === false` so a closed modal has no DOM, no testids, and no
 * event listeners.
 */
export function CmdKSearch({ graph, open, onClose, onSelect }: CmdKSearchProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Recompute the result list on every keystroke. The fuzzy scan is
  // O(nodes × fields) which is ~130 × ~6 ≈ 800 ops — negligible per
  // keystroke even without memoisation, but memoising keeps the render
  // stable when only `highlight` changes.
  const results = useMemo(() => {
    if (!open) return [] as FuzzyMatchResult[];
    return fuzzyMatch(query, graph);
  }, [query, graph, open]);

  // Reset transient state every time the modal opens so a stale query
  // from the previous session doesn't pre-populate.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open]);

  // Autofocus the input when the modal opens. The component itself is
  // unmounted when closed, so this effect runs every open.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  // Keep the highlight inside bounds when the result list shrinks.
  useEffect(() => {
    if (highlight >= results.length) {
      setHighlight(results.length === 0 ? 0 : results.length - 1);
    }
  }, [results.length, highlight]);

  if (!open) return null;

  const commitSelection = (nodeId: string) => {
    onSelect(nodeId);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) return;
      setHighlight((h) => Math.min(results.length - 1, h + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setHighlight((h) => Math.max(0, h - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[highlight];
      if (chosen) commitSelection(chosen.nodeId);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search nodes"
      onKeyDown={onKeyDown}
    >
      <div
        data-testid="cmdk-backdrop"
        style={BACKDROP_STYLE}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        data-testid="cmdk-modal"
        className="cmdk-modal"
        style={MODAL_STYLE}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          data-testid="cmdk-input"
          type="text"
          value={query}
          placeholder="Search nodes by name, metric, or description..."
          aria-label="Search nodes"
          style={INPUT_STYLE}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
        />
        <ul
          data-testid="cmdk-results"
          role="listbox"
          aria-label="Search results"
          style={RESULTS_STYLE}
        >
          {results.length === 0 ? (
            <li style={EMPTY_HINT_STYLE}>
              {query.trim().length === 0
                ? "Type to search the graph..."
                : "No matches."}
            </li>
          ) : (
            results.map((r, i) => {
              const node = graph.nodes.find((n) => n.id === r.nodeId);
              const displayName = node?.name ?? r.nodeId;
              const isHighlighted = i === highlight;
              const rowStyle: React.CSSProperties = {
                ...RESULT_ROW_STYLE_BASE,
                background: isHighlighted
                  ? "rgba(59, 130, 246, 0.12)"
                  : "transparent",
              };
              return (
                <li
                  key={r.nodeId}
                  role="option"
                  style={rowStyle}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => commitSelection(r.nodeId)}
                  aria-selected={isHighlighted}
                >
                  <span style={RESULT_NAME_STYLE}>{displayName}</span>
                  <span style={RESULT_SNIPPET_STYLE}>{r.matchText}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
