# ENGUI-237.3 - Guard Studio Session job deletion until materialization finishes

## Summary
Prevent finished Studio Session jobs from being deleted before their outputs are durably materialized into shot versions, so users cannot accidentally erase the only remaining recovery path.

## Status
Inbox

## Created
2026-05-07 08:08

## Labels
studio-sessions, backend, ux, reliability

## Depends on
- ENGUI-237
- ENGUI-237.1

## Scope
- Reject single-job deletion when Studio Session materialization is still pending
- Apply the same rule to bulk clear-finished flows
- Return a clear conflict message so the UI/user knows why deletion is blocked
