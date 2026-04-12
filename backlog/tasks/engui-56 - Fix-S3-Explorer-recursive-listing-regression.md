---
id: ENGUI-56
title: Fix S3 Explorer recursive listing regression
status: In Progress
assignee: []
created_date: '2026-04-12 15:58'
updated_date: '2026-04-12 15:58'
labels:
  - engui
  - s3-explorer
  - regression
  - storage
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the recursive S3 listing path introduced for unified delete planning, which currently returns 500 for some prefixes and breaks S3 Explorer delete flow.

Requirements:
- Diagnose the failing recursive listing path.
- Restore working delete behavior for selected folders/files.
- Keep the browser-visible progress log where possible.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
