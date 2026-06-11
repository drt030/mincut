import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/research-tasks/route";

test("research-tasks POST returns 403 when OPERATOR_WRITES is not set", async () => {
  delete process.env.OPERATOR_WRITES;
  const res = await POST(
    new Request("http://localhost/api/research-tasks", {
      method: "POST",
      body: JSON.stringify({ targetNodeId: "anything" }),
    }),
  );
  assert.equal(res.status, 403);
});
