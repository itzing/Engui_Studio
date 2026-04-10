---
id: ENGUI-16
title: Build shared secure envelope and transport helpers for RunPod jobs
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
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-secure-runpod-implementation-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement shared Engui helpers for structured secure blocks, media envelopes, DEK wrapping, binding or AAD validation, and secure transport upload or download under `/runpod-volume/secure-jobs/{jobId}/{attemptId}/...`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Engui has one shared helper path for `_secure`, encrypted endpoint responses, and media envelope handling
- [ ] #2 Media transport helpers read and write only ciphertext objects under the secure namespace
- [ ] #3 Helper APIs enforce binding validation for `jobId`, `modelId`, `attemptId`, `direction`, and media `role` or `kind`
- [ ] #4 Helper usage does not leak crypto metadata into S3 object metadata or `job.options`
<!-- AC:END -->
