---
id: ENGUI-60
title: Fix S3 folder delete 500 on marker objects
status: In Progress
assignee: []
created_date: '2026-04-12 16:18'
updated_date: '2026-04-12 16:18'
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
Fix remaining 500 errors when deleting folders in the S3 Bucket Viewer, especially for empty folders and folder marker objects.

Requirements:
- Diagnose the exact delete backend failure.
- Make empty and non-empty folder deletion reliable.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
