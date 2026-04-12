---
id: ENGUI-55
title: Unify S3 Explorer delete plan for folders and files
status: In Progress
assignee: []
created_date: '2026-04-12 15:46'
updated_date: '2026-04-12 15:46'
labels:
  - engui
  - s3-explorer
  - ux
  - debugging
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix S3 Explorer delete behavior so selecting multiple folders/files works through one consistent delete plan.

Requirements:
- Recursively expand selected folders into concrete object keys before delete.
- Use one shared delete execution path for current-folder delete and multi-select delete.
- Update log timestamps when statuses change, not only when rows are created.
- Preserve browser-visible progress logs.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
