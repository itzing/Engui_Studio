---
id: ENGUI-19
title: Convert status polling to read-only local job state and remove legacy completion routes
status: Planned
assignee: []
created_date: '2026-04-10 17:59'
labels:
  - jobs
  - backend
  - frontend
  - api
  - spec
dependencies:
  - ENGUI-18
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-implementation-spec.md
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-migration-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make `/api/generate/status` a read-only view over local Engui state, remove browser-driven finalization from `StudioContext`, and delete legacy completion routes no longer used by the secure flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `/api/generate/status` no longer polls RunPod or mutates lifecycle state
- [ ] #2 Frontend polling no longer calls `/api/download` or performs result finalization
- [ ] #3 `/api/webhook/complete` is removed from the repo
- [ ] #4 `/api/download` is removed from the repo
- [ ] #5 Completed polling responses expose the ready local result URL for current jobs UI compatibility
<!-- AC:END -->
