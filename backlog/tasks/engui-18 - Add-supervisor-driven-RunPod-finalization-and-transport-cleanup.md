---
id: ENGUI-18
title: Add supervisor-driven RunPod finalization and transport cleanup
status: Planned
assignee: []
created_date: '2026-04-10 17:59'
labels:
  - jobs
  - backend
  - infra
  - spec
dependencies:
  - ENGUI-15
  - ENGUI-16
  - ENGUI-17
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-implementation-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the Engui server-side supervisor loop that polls RunPod, decrypts `transport_result_secure`, materializes the final local plaintext result, records normalized failures, resumes after restart, and owns cleanup of all secure transport objects.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Supervisor is the only lifecycle owner for active RunPod jobs
- [ ] #2 Successful jobs are marked `completed` only after local result materialization and `job.resultUrl` write
- [ ] #3 Finalization failures become `failed` with normalized `source`, `error.code`, and `error.message`
- [ ] #4 Transport cleanup runs for every terminal job and records warning state on cleanup failure without changing the main terminal status
- [ ] #5 Supervisor can resume unfinished jobs after service restart
<!-- AC:END -->
