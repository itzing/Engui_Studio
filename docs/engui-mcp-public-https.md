# Public MCP ingress for Claude

## Architecture

Public endpoint: `https://massive.taild3a871.ts.net:10000/api/mcp`.

Tailscale Funnel terminates TLS on dedicated port 10000 and forwards to `127.0.0.1:3011`. The system service `engui-mcp-proxy.service` accepts exactly `/api/mcp` and forwards to the fixed Engui endpoint `http://127.0.0.1:3010/api/mcp`. Other paths, queries, unknown hosts, duplicate authority headers and oversized bodies are rejected. Cookies and caller-supplied routing headers are not forwarded. Request/response bodies and credentials are not logged. The proxy has no database or credential access.

Private Tailscale Serve ports 443 and 8443 retain their existing routes. In particular, `/`, `/openclaw`, application APIs and static media are NOT exposed through the public ingress. Do not enable Funnel on an existing private port.

Application authorization remains mandatory: a workspace-scoped bearer credential plus matching `X-Workspace-Id`. The public hostname including port must appear in `ENGUI_MCP_ALLOWED_HOSTS`. The proxy sets the trusted upstream protocol to HTTPS. No OAuth, query-string credential or anonymous workspace fallback is added.

## Claude setup

1. Add a custom connector using the public endpoint above.
2. Choose **No sign in** (there is no OAuth login; bearer authorization is still required).
3. Under **Request headers**, add `Authorization: Bearer <workspace-token>` and `X-Workspace-Id: <workspace-uuid>`.
4. Add/connect the connector, then enable it in the desired conversation.

Fairy Tale workspace: `ec208506-661d-4906-ada0-4cc1b93c87d2`.

The dedicated credential is provisioned separately, expires in 30 days and carries `read,generate,curate,cancel`. It is never stored in this repository. Generation still requires the owner's conversational authorization; connection smoke tests must use read-only tools only.

Claude custom connectors run from Anthropic's infrastructure, including when configured in Claude Desktop. A private Tailscale-only URL cannot be reached. Claude supports fixed request headers; OAuth is not required for this deployment.

Reference: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

## Installation inventory

- Versioned proxy: `scripts/mcp/public-proxy.mjs`.
- Versioned service template: `scripts/mcp/engui-mcp-proxy.service`.
- Installed proxy: `/usr/local/lib/engui-mcp/public-proxy.mjs` (root-owned).
- Service: `/etc/systemd/system/engui-mcp-proxy.service` (dynamic unprivileged user).
- Public authority: `/etc/engui-mcp-proxy.conf` (`ENGUI_MCP_PUBLIC_AUTHORITY=massive.taild3a871.ts.net:10000`).
- Engui host allowlist: `/etc/systemd/system/engui-studio.service.d/91-mcp-public.conf`.

Enable only the new port after validating the proxy:

```sh
sudo -n tailscale funnel --bg --https=10000 --yes http://127.0.0.1:3011
```

Tailscale may require the account owner to authorize Funnel for this node. That approval does not itself publish all existing Serve routes. Inspect the final configuration and ensure `AllowFunnel` contains only port 10000.

## Validation

```sh
node --test scripts/mcp/public-proxy.test.mjs
systemctl status engui-mcp-proxy.service engui-studio.service --no-pager
tailscale funnel status --json
```

Use the official MCP SDK to initialize, list tools and call `engui_get_context`. Check missing credentials (401), a valid credential with wrong workspace (403), unrelated paths (404), and valid TLS. Confirm the workspace is Fairy Tale and no generation batches were created. Independently resolve public DNS when validating internet ingress; local MagicDNS resolves the tailnet address and alone does not prove Funnel reachability.

## Rollback

```sh
sudo -n tailscale funnel --https=10000 off
sudo -n systemctl disable --now engui-mcp-proxy.service
```

Remove only the new `91-mcp-public.conf` drop-in, run `systemctl daemon-reload`, and restart `engui-studio.service`. Leave `90-mcp.conf` and private Serve routes untouched. Never use `tailscale serve reset` or `tailscale funnel reset` for this rollback. Revoke the dedicated credential through `scripts/mcp/credentials.ts` if retiring the connector. No database restore is required.

## Deployment evidence (2026-11-11)

- Eight security/transport tests passed, covering raw path isolation, unknown hosts, methods, body limits, header filtering, credentials, origin preservation, duplicate authorization and upstream failure.
- Isolated production build passed, serving artifact replaced with the prior build retained, and Engui service health checks returned 200. The previous Next.js child did not exit during graceful shutdown; unit-scoped SIGKILL completed the approved restart. No new MCP generation or active recent provider job was present.
- Official SDK initialized over verified TLS through public Funnel relay IP `185.40.234.55`, independently resolved through public DNS (not MagicDNS), discovered all 15 tools, and read Fairy Tale context.
- Missing credential returned 401, workspace mismatch returned 403, and root/OpenClaw/unrelated API/query paths returned 404.
- The private Serve configuration for ports 443 and 8443 is byte-for-byte equivalent at the route-object level. Only port 10000 is listed in AllowFunnel.
- A dedicated Fairy Tale credential expires on 2026-12-11. The token was written to a private file for owner delivery; no secret appears in version control.
- No generation, curation or cancellation tool was called. Owner-side final connection in Claude remains to be completed using the delivered settings.

Build and public SDK evidence: `/home/engui/engui-runs/engui-mcp-public-20261111/`. Routing backup, deployment logs and rollback evidence: OpenClaw workspace `runs/engui-mcp-public-https-20261111/`.
