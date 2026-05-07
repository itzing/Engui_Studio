# ENGUI-237.2 - Create and recover Studio Session materialization tasks server-side

## Summary
Create durable Studio Session materialization tasks when launch jobs are created, and have the server sweep pending tasks so completed jobs are materialized even after process restarts or missed completion windows.

## Status
Inbox

## Created
2026-05-07 08:08

## Labels
studio-sessions, backend, reliability

## Depends on
- ENGUI-237
- ENGUI-237.1

## Scope
- Create task rows together with Studio Session generation jobs
- Rework materialization to update task status/attempt metadata
- Add recovery sweep to the existing supervisor loop
- Ensure retries are idempotent and safe under repeated ticks
