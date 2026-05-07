# ENGUI-237.1 - Add durable materialization task state for Studio Session jobs

## Summary
Add a durable database-backed materialization task record for each Studio Session generation job so the server can track whether the job has been materialized into a shot version.

## Status
Inbox

## Created
2026-05-07 08:08

## Labels
studio-sessions, backend, reliability

## Depends on
- ENGUI-237

## Scope
- Add Prisma schema for Studio Session job materialization tasks
- Store jobId/workspaceId/runId/shotId/revisionId and retry metadata
- Add uniqueness and indexes needed for idempotent retries and recovery sweeps
- Keep the schema add-only and safe to roll back in code if needed
