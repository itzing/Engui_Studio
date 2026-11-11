---
id: ENGUI-587
title: Expose authenticated MCP through an isolated public HTTPS ingress
status: Done
assignee: []
created_date: '2026-11-11 20:36'
labels: [mcp, infrastructure]
dependencies: []
---

## Description

Owner14316 explicitly authorizes a public HTTPS ingress for Claude, bound to the Fairy Tale workspace by credential and header. Preserve the private Engui and OpenClaw routes. No application UI changes, OpenClaw client setup or paid generation.

## Plan

Use a dedicated Tailscale Funnel HTTPS port 10000 and loopback proxy on 3011. The proxy accepts exactly /api/mcp, rejects other paths and query strings, forwards only selected headers to a fixed upstream, and leaves token/workspace authorization to Engui. Existing private ports 443 and 8443 are unchanged. A new public domain/reverse proxy would require additional DNS and certificate operations, so reuse Tailscale TLS.

## Acceptance Criteria

- [x] Negative tests prove unrelated routes, traversal, queries and untrusted hosts cannot reach Engui.
- [x] Authorized HTTP SDK discovery/context succeed; missing credentials and workspace mismatch fail.
- [x] Public ingress is verified, or any owner-required Tailscale policy step is explicitly documented.
- [x] Existing private routes and service health are preserved; no paid jobs are created.
- [x] Commit and push under the owner identity; retain routing backup and rollback instructions.

## Rollback

Disable only Funnel port 10000, stop the dedicated proxy, remove its Engui allowlist drop-in, and restart Engui. Never reset the entire Tailscale Serve configuration. Revoke the newly provisioned credential if the connector is retired.

## Completion Notes

Implemented an exact-path loopback proxy and isolated DynamicUser service; published only Funnel port 10000 after owner enabled the node capability. Eight security tests, isolated production build and public-IP official SDK initialization/discovery/context checks passed. Missing auth, workspace mismatch and unrelated routes were rejected. Existing private routes preserved; zero MCP batches. Dedicated 30-day Fairy Tale credential delivered separately. See docs/engui-mcp-public-https.md for configuration, evidence and rollback.
