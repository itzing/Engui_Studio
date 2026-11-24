# ENGUI-608 — Download original artifacts through MCP

## Status
Validated; production rollout pending.

## Scope and authorization
Owner14853 requests downloading complete Job artifacts from MCP, not only previews. MCP only; UI, endpoint and generation behavior unchanged. Full-cycle authorization. Preserve existing preview tool.

## Implementation
Add read-scoped engui_download_artifact(source), returning an expiring scoped URL, original filename/MIME/byte count/SHA-256. Stream exact owned local Job or Gallery originals without resize/re-encode; support image/video/audio original files. Signed capability expires after at most10minutes, is bound to source/content/workspace/credential, and is invalid after credential revocation/expiry or source removal. No arbitrary path/URL fetch, no durable download copies, no new DB schema. Public ingress permits only the exact bounded download route. Guide and discovery distinguish preview from original.

## Verification and rollback
Isolated SDK/integration cases: byte-exact download, preview remains bounded, large streaming original, wrong workspace, traversal/symlinks, signature tampering, expiry/revocation/trash/change, no private path/token in logs. Public ingress tests and build, candidate HTTP and production SDK/download proof without inference. Keep previous Next build and proxy script for rollback; no DB restore needed.

## Candidate verification
140 MCP regression cases passed across five files (one legacy read-tool-count expectation updated and its24-case suite rerun).11 ingress tests passed. Production build passed;251 existing TypeScript diagnostic lines are unchanged with zero added diagnostics. Built-server official SDK plus actual streaming ingress passed14 HTTP checks (original byte equality, full dimensions, attachment/length, no-header capability GET/HEAD, exact-route gate, Gallery and credential revocation). No paid inference. Private evidence: /home/engui/engui-runs/engui-608-20261124.
