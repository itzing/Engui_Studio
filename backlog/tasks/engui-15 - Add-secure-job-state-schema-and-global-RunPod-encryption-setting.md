---
id: ENGUI-15
title: Add secure job state schema and global RunPod encryption setting
status: In Progress
assignee: []
created_date: '2026-04-10 17:59'
labels:
  - jobs
  - backend
  - infra
  - spec
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-implementation-spec.md
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-migration-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the durable Engui-side foundations for the secure-only RunPod flow: one structured `Job.secureState` field, support for `finalizing` status, and one global RunPod encryption key setting stored through the existing settings flow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Job schema includes a durable `secureState` field for supervisor-owned secure transport and finalization state
- [ ] #2 Job status handling supports `finalizing` without breaking existing jobs UX
- [ ] #3 Settings service, settings API, and settings UI expose one global `runpod.fieldEncKeyB64` field and remove endpoint-specific secure key fields
- [ ] #4 Generation submission fails fast with a clear error when the global key is missing or invalid
- [ ] #5 Existing code paths no longer depend on `encryptSensitiveZImage`, `zImageFieldEncKeyB64`, `encryptSensitiveUpscale`, or `upscaleFieldEncKeyB64`
<!-- AC:END -->
