---
id: ENGUI-59
title: Fix empty S3 folder deletion in Bucket Viewer
status: In Progress
assignee: []
created_date: '2026-04-12 16:15'
updated_date: '2026-04-12 16:15'
labels:
  - engui
  - s3-explorer
  - storage
  - bug
  - regression
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix S3 Bucket Viewer folder deletion so empty folders are actually removed instead of showing progress while the folder remains visible.

Requirements:
- Make deletion work for empty folders.
- Preserve working folder/file delete behavior for non-empty selections.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
