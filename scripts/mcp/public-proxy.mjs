import http from "node:http";
import { pathToFileURL } from "node:url";

const MAX_BODY = 128 * 1024;
const REQUEST_HEADERS = [
  "authorization", "x-workspace-id", "accept", "content-type",
  "mcp-protocol-version", "origin",
];
const RESPONSE_HEADERS = [
  "content-type", "www-authenticate", "allow", "retry-after",
  "mcp-protocol-version",
];

export function createPublicMcpProxy({ authority, aliases = [], upstreamPort = 3010 }) {
  const authorities = new Set([authority, ...aliases]);
  if ([...authorities].some((value) => !value || !/^[a-z0-9.-]+(?::\d+)?$/.test(value))) {
    throw new Error("Exact public hostnames with optional ports are required.");
  }
  let active = 0;
  const server = http.createServer({ maxHeaderSize: 16384 }, (request, response) => {
    const started = Date.now();
    response.once("finish", () => console.info("MCP ingress", JSON.stringify({
      at: new Date().toISOString(),
      method: ["POST", "GET", "DELETE", "OPTIONS", "HEAD"].includes(request.method) ? request.method : "other",
      route: request.url === "/api/mcp" ? "mcp" : "rejected",
      status: response.statusCode,
      hasAuthorization: Boolean(request.headers.authorization),
      hasWorkspace: Boolean(request.headers["x-workspace-id"]),
      durationMs: Date.now() - started,
    })));
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    const reject = (status, message) => {
      request.resume();
      response.setHeader("Connection", "close");
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: message }));
    };
    // Compare raw request targets: do not normalize or decode attacker-controlled paths.
    if (request.url !== "/api/mcp") return reject(404, "Not found.");
    if (!authorities.has(request.headers.host)) return reject(403, "Host is not allowed.");
    if (!["POST", "GET", "DELETE"].includes(request.method)) {
      response.setHeader("Allow", "POST, GET, DELETE");
      return reject(405, "Method not allowed.");
    }
    for (const name of ["authorization", "x-workspace-id", "host"]) {
      let count = 0;
      for (let i = 0; i < request.rawHeaders.length; i += 2) {
        if (request.rawHeaders[i].toLowerCase() === name) count += 1;
      }
      if (count > 1) return reject(400, "Duplicate authority header.");
    }
    if (Number(request.headers["content-length"] || 0) > MAX_BODY) {
      return reject(413, "Request is too large.");
    }
    if (active >= 32) return reject(503, "Server is busy.");
    active += 1;
    let upstream;
    response.once("close", () => { active -= 1; upstream?.destroy(); });
    request.once("error", () => response.destroy());
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY) {
        rejected = true;
        chunks.length = 0;
        reject(413, "Request is too large.");
      } else chunks.push(chunk);
    });
    request.once("end", () => {
      if (rejected || response.destroyed) return;
      const headers = {
        host: request.headers.host,
        "x-forwarded-proto": "https",
        "content-length": String(size),
      };
      for (const name of REQUEST_HEADERS) {
        if (request.headers[name] !== undefined) headers[name] = request.headers[name];
      }
      // Never forward cookies, caller-supplied routing headers, or an arbitrary target.
      upstream = http.request({
        host: "127.0.0.1", port: upstreamPort, path: "/api/mcp",
        method: request.method, headers, timeout: 120000,
      }, (result) => {
        const out = {};
        for (const name of RESPONSE_HEADERS) {
          if (result.headers[name] !== undefined) out[name] = result.headers[name];
        }
        response.writeHead(result.statusCode || 502, out);
        result.once("error", () => response.destroy());
        result.pipe(response);
      });
      upstream.once("timeout", () => upstream.destroy(new Error("Upstream timeout")));
      upstream.once("error", () => {
        if (!response.headersSent && !response.destroyed) reject(502, "MCP is unavailable.");
        else response.destroy();
      });
      upstream.end(Buffer.concat(chunks));
    });
  });
  server.maxConnections = 64;
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  server.setTimeout(125000, (socket) => socket.destroy());
  server.on("upgrade", (_request, socket) => socket.destroy());
  server.on("connect", (_request, socket) => socket.destroy());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createPublicMcpProxy({
    authority: process.env.ENGUI_MCP_PUBLIC_AUTHORITY,
    aliases: (process.env.ENGUI_MCP_PUBLIC_ALIASES || "").split(",").filter(Boolean),
  });
  server.listen(3011, "127.0.0.1", () => console.log("MCP ingress listening on loopback:3011"));
  process.once("SIGTERM", () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
