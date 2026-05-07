# ENGUI-237 - Durable Studio Session materialization pipeline

## Summary
Make Studio Session output materialization a durable server-side pipeline that does not depend on an active client, lucky in-memory supervisor timing, or the continued existence of a job row after completion.

## Status
Inbox

## Created
2026-05-07 08:08

## Labels
studio-sessions, desktop, backend, reliability

## Depends on
- ENGUI-230.3
- ENGUI-236

## Scope
- Introduce durable materialization task state for Studio Session generation jobs
- Create the task at Studio Session job launch time, not only on completion
- Add recovery sweep logic so completed jobs are materialized after restarts or missed ticks
- Prevent deletion of finished Studio Session jobs before durable materialization completes
- Add repair/backfill support for already completed Studio Session jobs that never produced shot versions
- Surface pending or failed materialization states in run status derivation/UI payloads where needed

## Notes
The intended contract is: a completed Studio Session job must eventually produce a `StudioSessionShotVersion` without any dependency on the web client remaining open.
