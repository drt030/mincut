import test from "node:test";
import assert from "node:assert/strict";
import { nodeSchema, strictNodeSchema } from "../src/lib/schema";

/**
 * RED tests for Slice A1 (spec: docs/superpowers/specs/2026-05-13-graph-radial-progressive-disclosure.md).
 *
 * Per ADR-0006, the dedicated `kind: "bottleneck"` and
 * `kind: "placeholder_breakthrough"` are deprecated. Instead, structural
 * nodes (module / material / etc.) carry two optional attributes:
 *
 *   - `bottleneckOf?: string[]` — capability ids this node currently bottlenecks
 *   - `frontierFor?: string[]`  — capability ids this node is a decomposition frontier for
 *
 * These tests pin the contract. They fail today because the Zod node
 * schema does not yet declare these fields. The GREEN commit extends
 * `nodeSchema` (and consequently `strictNodeSchema`) with the optional
 * `string[]` fields.
 *
 * Note: the test runner picks up tests/<dir>/<file>.test.ts via `tsx --test`
 * (see package.json `test` script). We use `node:test` to match the
 * style of `tests/nodeRisk.test.ts` and friends.
 */

/**
 * A minimal valid `module` node skeleton. Built without bottleneckOf /
 * frontierFor so we can attach them per case below. `maturityAsOf` is
 * deliberately omitted because no maturity claim is set — see ADR-0002.
 */
function baseModuleNode(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "test_module_a1",
    name: "Test module for A1",
    kind: "module",
    domain: ["test"],
    ...extra,
  };
}

/**
 * The "recognized" assertion: Zod's default behavior on a non-strict
 * object is to silently drop unknown keys — so `safeParse` returning
 * success is NOT enough. We must check the parsed *output* preserves
 * the field. That is what catches today's silent-drop behavior and
 * forces the GREEN commit to actually declare the field.
 */

test("schema A1: nodeSchema parsed output preserves bottleneckOf: [string]", () => {
  const node = baseModuleNode({ bottleneckOf: ["cap_parcel_sorting"] });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(parsed.success, true, "safeParse must succeed");
  if (!parsed.success) return;
  assert.deepEqual(
    (parsed.data as { bottleneckOf?: unknown }).bottleneckOf,
    ["cap_parcel_sorting"],
    "schema must declare bottleneckOf so the parsed output preserves it (not silently drop it)",
  );
});

test("schema A1: nodeSchema parsed output preserves frontierFor: [string]", () => {
  const node = baseModuleNode({ frontierFor: ["cap_parcel_sorting"] });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(parsed.success, true, "safeParse must succeed");
  if (!parsed.success) return;
  assert.deepEqual(
    (parsed.data as { frontierFor?: unknown }).frontierFor,
    ["cap_parcel_sorting"],
    "schema must declare frontierFor so the parsed output preserves it",
  );
});

test("schema A1: bottleneckOf [] (empty array) is preserved on parse", () => {
  const node = baseModuleNode({ bottleneckOf: [] });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual((parsed.data as { bottleneckOf?: unknown }).bottleneckOf, []);
});

test("schema A1: frontierFor [] (empty array) is preserved on parse", () => {
  const node = baseModuleNode({ frontierFor: [] });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual((parsed.data as { frontierFor?: unknown }).frontierFor, []);
});

test("schema A1: bottleneckOf preserves a long string[] (>1 element)", () => {
  const values = ["cap_a", "cap_b", "cap_c", "cap_d", "cap_e", "cap_f"];
  const node = baseModuleNode({ bottleneckOf: values });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual((parsed.data as { bottleneckOf?: unknown }).bottleneckOf, values);
});

test("schema A1: frontierFor preserves a long string[] (>1 element)", () => {
  const values = ["cap_a", "cap_b", "cap_c", "cap_d", "cap_e", "cap_f"];
  const node = baseModuleNode({ frontierFor: values });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.deepEqual((parsed.data as { frontierFor?: unknown }).frontierFor, values);
});

test("schema A1: omitting bottleneckOf and frontierFor still parses (both optional)", () => {
  const node = baseModuleNode();
  const parsed = nodeSchema.safeParse(node);
  assert.equal(
    parsed.success,
    true,
    `bare module node without bottleneckOf/frontierFor must parse; got error: ${
      parsed.success ? "" : JSON.stringify(parsed.error.issues)
    }`,
  );
  // And the strict variant — which would have already accepted the bare
  // node today — must continue accepting it after the schema bump.
  const strict = strictNodeSchema.safeParse(node);
  assert.equal(strict.success, true);
});

test("schema A1: bottleneckOf with a non-string element fails validation", () => {
  const node = baseModuleNode({ bottleneckOf: ["cap_a", 42 as unknown as string] });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(
    parsed.success,
    false,
    "bottleneckOf must be string[]; a number element must be rejected",
  );
  if (!parsed.success) {
    // Confirm Zod surfaced a type-related issue on the offending path.
    const issues = parsed.error.issues;
    const hit = issues.find(
      (i) =>
        Array.isArray(i.path) &&
        i.path[0] === "bottleneckOf" &&
        (i.code === "invalid_type" || i.message.toLowerCase().includes("string")),
    );
    assert.ok(
      hit,
      `expected an invalid_type issue on bottleneckOf; got: ${JSON.stringify(issues)}`,
    );
  }
});

test("schema A1: frontierFor with a non-string element fails validation", () => {
  const node = baseModuleNode({ frontierFor: [true as unknown as string] });
  const parsed = nodeSchema.safeParse(node);
  assert.equal(
    parsed.success,
    false,
    "frontierFor must be string[]; a boolean element must be rejected",
  );
  if (!parsed.success) {
    const issues = parsed.error.issues;
    const hit = issues.find(
      (i) =>
        Array.isArray(i.path) &&
        i.path[0] === "frontierFor" &&
        (i.code === "invalid_type" || i.message.toLowerCase().includes("string")),
    );
    assert.ok(
      hit,
      `expected an invalid_type issue on frontierFor; got: ${JSON.stringify(issues)}`,
    );
  }
});

test("schema A1: strict variant recognizes bottleneckOf (no 'unrecognized_keys')", () => {
  // The strict node schema (used by scripts/import-candidates.ts) must
  // not treat bottleneckOf / frontierFor as unknown keys once A1 lands.
  const node = baseModuleNode({
    bottleneckOf: ["cap_parcel_sorting"],
    frontierFor: ["cap_parcel_sorting"],
  });
  const parsed = strictNodeSchema.safeParse(node);
  assert.equal(
    parsed.success,
    true,
    `strict schema must accept bottleneckOf + frontierFor; got error: ${
      parsed.success ? "" : JSON.stringify(parsed.error.issues)
    }`,
  );
});
