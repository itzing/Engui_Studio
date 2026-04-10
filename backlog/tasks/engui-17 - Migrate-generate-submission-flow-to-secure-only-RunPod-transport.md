---
id: ENGUI-17
title: Migrate generate submission flow to secure-only RunPod transport
status: Planned
assignee: []
created_date: '2026-04-10 17:59'
labels:
  - jobs
  - backend
  - api
  - spec
dependencies:
  - ENGUI-15
  - ENGUI-16
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-implementation-spec.md
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-migration-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace plaintext and endpoint-specific secure submission logic in `POST /api/generate` and `RunPodService` with the new common secure-only contract using `_secure`, `media_inputs[]`, and `transport_request.output_dir`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `/api/generate` creates an attempt-scoped secure transport upload under `secure-jobs/.../inputs/`
- [ ] #2 Request payloads use the common contract instead of legacy plaintext media transport fields
- [ ] #3 Sensitive structured fields move into `_secure` and media moves into `media_inputs[]`
- [ ] #4 Generation submission persists the initial `secureState` and no longer depends on endpoint-specific secure toggles
- [ ] #5 Plaintext transport upload to S3 or `/runpod-volume` is removed from the active generation path
<!-- AC:END -->
