import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedRequest } from "../lib/auth-request";

test("expired authentication refreshes once and retries the same publication with the new token", async () => {
  const refreshes: boolean[] = [];
  const requests: RequestInit[] = [];
  const result = await authenticatedRequest(
    "/api/publish",
    { workoutId: "test" },
    async (refresh) => {
      refreshes.push(refresh);
      return refresh ? "new-token" : "expired-token";
    },
    async (_path, init) => {
      requests.push(init!);
      return requests.length === 1
        ? Response.json({ error: "Entre novamente" }, { status: 401 })
        : Response.json({ url: "https://example.org/treino/test" });
    },
  );
  assert.deepEqual(refreshes, [false, true]);
  assert.equal(
    new Headers(requests[1].headers).get("Authorization"),
    "Bearer new-token",
  );
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(result.url, "https://example.org/treino/test");
});

test("revoked sessions stop after one refresh; non-authentication failures are never retried", async () => {
  for (const status of [401, 403, 500]) {
    let attempts = 0;
    await assert.rejects(
      authenticatedRequest(
        "/api/publish",
        {},
        async () => "token",
        async () => {
          attempts++;
          return Response.json({ error: "Falha" }, { status });
        },
      ),
    );
    assert.equal(attempts, status === 401 ? 2 : 1);
  }
  let attempts = 0;
  await assert.rejects(
    authenticatedRequest(
      "/api/publish",
      {},
      async (refresh) => (refresh ? null : "old"),
      async () => {
        attempts++;
        return Response.json({}, { status: 401 });
      },
    ),
    /sessão terminou/,
  );
  assert.equal(attempts, 1);
});
