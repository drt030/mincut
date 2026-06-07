import test from "node:test";
import assert from "node:assert/strict";
import { withImportDefaults } from "../scripts/import-candidates";

test("candidate import defaults missing maturityLabel to unknown", () => {
  const imported = withImportDefaults(
    {
      nodes: [
        {
          id: "org_test_supplier",
          name: "Test supplier",
          kind: "organization",
          domain: ["test"],
        },
      ],
      edges: [],
      evidence: [],
      tasks: [],
    },
    "2026-06-07T00:00:00.000Z",
  );

  assert.equal(imported.nodes[0].maturityLabel, "unknown");
  assert.equal(imported.nodes[0].maturityAsOf, undefined);
});
