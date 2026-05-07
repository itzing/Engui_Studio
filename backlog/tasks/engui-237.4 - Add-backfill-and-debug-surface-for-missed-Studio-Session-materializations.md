# ENGUI-237.4 - Add backfill and debug surface for missed Studio Session materializations

## Summary
Add a repair path for already completed Studio Session jobs that missed materialization, plus enough status visibility to detect pending or failed materialization states instead of silently showing empty run results.

## Status
Inbox

## Created
2026-05-07 08:08

## Labels
studio-sessions, backend, reliability

## Depends on
- ENGUI-237
- ENGUI-237.2

## Scope
- Add server-side backfill for completed Studio Session jobs without shot versions or task rows
- Expose materialization-pending or failed state in run payloads/status derivation
- Add lightweight logs or counters for retries/failures during the sweep
