---
id: ENGUI-52
title: Speed up S3 Explorer delete operations
status: In Progress
assignee: []
created_date: '2026-04-12 15:20'
updated_date: '2026-04-12 15:20'
labels:
  - engui
  - s3-explorer
  - performance
  - storage
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current S3 Explorer delete flow is too slow for both single-file deletes and recursive folder deletes.

Requirements:
- Replace sequential per-object deletion with a much more efficient backend strategy.
- Prefer batch delete for recursive folder deletion when supported.
- Keep a safe fallback path if the storage backend rejects batch deletes.
- Preserve existing UI behavior while improving latency.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
