import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createPublicMcpProxy } from "./public-proxy.mjs";

const authority = "example.ts.net:10000";
const received = [];
const upstream = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  received.push({ path: request.url, headers: request.headers, body: Buffer.concat(chunks) });
  if (!request.headers.authorization) {
    response.writeHead(401, { "WWW-Authenticate": 'Bearer realm="engui-mcp"' });
    return response.end("Unauthorized");
  }
  if (request.headers["x-workspace-id"] !== "workspace-fixture") {
    response.writeHead(403);
    return response.end("Workspace mismatch");
  }
  response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": "must-not-escape=1" });
  response.end(Buffer.concat(chunks));
});
upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const proxy = createPublicMcpProxy({ authority, upstreamPort: upstream.address().port });
proxy.listen(0, "127.0.0.1");
await once(proxy, "listening");
const send = (path, { method = "POST", headers = {}, body = "{}" } = {}) => new Promise((resolve, reject) => {
  const request = http.request({
    host: "127.0.0.1", port: proxy.address().port, path, method,
    headers: { host: authority, authorization: "Bearer synthetic", "x-workspace-id": "workspace-fixture", ...headers },
  }, async (response) => {
    const chunks = [];
    for await (const chunk of response) chunks.push(chunk);
    resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) });
  });
  request.on("error", reject);
  request.end(body);
});
try {
  await test("unrelated, encoded, traversal and query targets never reach the application", async () => {
    for (const path of ["/", "/openclaw", "/api/workspaces", "/api/mcp/", "/api/mcp/../../api/workspaces", "/api/mcp/%2e%2e/x", "/api%2fmcp", "//api/mcp", "/api/mcp?token=secret", "http://127.0.0.1:3010/api/mcp"]) {
      assert.equal((await send(path)).status, 404, path);
    }
    assert.equal(received.length, 0);
  });
  await test("untrusted hosts and unsupported methods are rejected before forwarding", async () => {
    assert.equal((await send("/api/mcp", { headers: { host: "wrong.example" } })).status, 403);
    assert.equal((await send("/api/mcp", { method: "OPTIONS" })).status, 405);
    assert.equal(received.length, 0);
  });
  await test("declared and chunked oversized bodies are rejected before forwarding", async () => {
    assert.equal((await send("/api/mcp", { headers: { "Content-Length": "131073" }, body: "x" })).status, 413);
    assert.equal((await send("/api/mcp", { body: "x".repeat(131073) })).status, 413);
    assert.equal(received.length, 0);
  });
  await test("fixed upstream receives exact bytes and only intended request headers", async () => {
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", data: "Привет" });
    const result = await send("/api/mcp", { body: payload, headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-03-26", Cookie: "private=secret",
      "X-Forwarded-Host": "attacker.example", "X-Forwarded-Proto": "http",
      "X-Original-URL": "/api/workspaces",
    } });
    assert.equal(result.status, 200);
    assert.equal(result.body.toString(), payload);
    assert.equal(result.headers["set-cookie"], undefined);
    assert.equal(result.headers["cache-control"], "no-store");
    const captured = received.at(-1);
    assert.equal(captured.path, "/api/mcp");
    assert.equal(captured.headers.host, authority);
    assert.equal(captured.headers["x-forwarded-proto"], "https");
    assert.equal(captured.headers["x-forwarded-host"], undefined);
    assert.equal(captured.headers["x-original-url"], undefined);
    assert.equal(captured.headers.cookie, undefined);
    assert.equal(captured.headers["mcp-protocol-version"], "2025-03-26");
  });
  await test("authentication challenge and workspace rejection are preserved", async () => {
    const noCredential = await send("/api/mcp", { headers: { authorization: "" } });
    assert.equal(noCredential.status, 401);
    assert.equal(noCredential.headers["www-authenticate"], 'Bearer realm="engui-mcp"');
    assert.equal((await send("/api/mcp", { headers: { "x-workspace-id": "other-workspace" } })).status, 403);
  });
  await test("browser origin is not hidden from application validation", async () => {
    await send("/api/mcp", { headers: { origin: "https://untrusted.example" } });
    assert.equal(received.at(-1).headers.origin, "https://untrusted.example");
  });
  await test("duplicate credentials cannot be silently selected", async () => {
    const count = received.length;
    assert.equal((await send("/api/mcp", { headers: { authorization: ["Bearer first", "Bearer second"] } })).status, 400);
    assert.equal(received.length, count);
  });
  await test("unavailable application fails closed", async () => {
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
    assert.equal((await send("/api/mcp")).status, 502);
  });
} finally {
  proxy.closeAllConnections();
  upstream.closeAllConnections();
  await new Promise((resolve) => proxy.close(resolve));
  if (upstream.listening) await new Promise((resolve) => upstream.close(resolve));
}
