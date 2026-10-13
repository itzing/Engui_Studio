# ENGUI-561 - Curate Showdown framing parts and deploy

Status: In Progress
Created: 2026-10-13
Labels: [showdown, migration, release]

## Scope
Seven character/default-outfit mappings; pose visibility metadata; idempotent migration; regression checks and production deployment.

## Acceptance Criteria
- [x] All seven Showdown looks render crop-specific prompts.
- [x] Other workspaces and completed history are unchanged.
- [x] Migration rehearsal and backup completed.
- [ ] Production build, restart and health checks pass without paid jobs.
