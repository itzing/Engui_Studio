---
id: ENGUI-588
title: Diagnose Claude connection failure with credential-safe ingress telemetry
status: Done
assignee: []
created_date: '2026-11-11 20:46'
labels: [mcp, infrastructure]
dependencies: [ENGUI-587]
---

## Description

Owner reports Claude connector fails despite both fixed request headers being configured. Continue the authorized connection setup without exposing other services or weakening MCP authorization. Instrument status-only ingress observations to distinguish network reachability from authentication/protocol failures. Never log token/header values, paths containing queries or request/response bodies.

## Acceptance Criteria

- [x] Observe an actual Claude reconnect attempt using sanitized ingress metadata.
- [x] Resolve the evidenced failure or report the precise external blocker.
- [x] Preserve private routing, workspace authentication and zero paid generation calls.
- [x] Validate, document, commit and push any changes under the owner identity.

## Evidence and chosen correction

Owner confirmed both fixed headers and Streamable HTTP are configured. Reconnect attempt around20:46UTC produced no ingress requests. A controlled public request at20:47:11UTC produced the expected401 diagnostic, proving the observer works. Claude failure is therefore before the application; a specific egress-port restriction is suspected but not proven.

Use a separate userspace Tailscale node named engui-mcp with its own state/socket and Funnel443. This avoids exposing or rerouting the main node's private443/8443 services and avoids another TLS-terminating vendor. The owner must authorize this new node; login URL delivered privately. No changes to main Tailscale routing, DNS or route acceptance.

## Standard-port validation

Owner authorized the isolated node. Ten proxy tests and isolated production build pass. Explicit --statedir fixed certificate provisioning for the DynamicUser daemon; ACME certificate issued. Official SDK passed public relay176.58.90.46 on standard443:15tools, Fairy Tale context,401missing token,403wrong workspace and404unrelated paths. Existing credential retained. Main private443/8443 route objects unchanged. Awaiting owner retry on the new URL to prove the consumer Claude integration; do not claim that UI connection is established yet.

## Owner verification

Owner confirmed at20:54UTC that Claude connects and tools are visible. Standard-HTTPS ingress delivery bc6d57c is complete; no paid validation jobs.
