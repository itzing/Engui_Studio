---
id: ENGUI-57
title: Fix S3 Explorer delete 500 errors
status: In Progress
assignee: []
created_date: '2026-04-12 16:02'
updated_date: '2026-04-12 16:02'
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
Fix backend failures in `/api/s3-storage/delete` introduced during the S3 Explorer delete-flow refactor.

Requirements:
- Reproduce the failing request shape.
- Restore working delete behavior for folder/file delete plans.
- Keep browser-visible progress logs if possible.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
