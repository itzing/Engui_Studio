---
id: ENGUI-62
title: Delete empty S3 folder placeholders and markers
status: In Progress
assignee: []
created_date: '2026-04-12 16:27'
updated_date: '2026-04-12 16:27'
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
Fix empty-folder deletion in S3 Bucket Viewer by deleting both folder marker objects and folder placeholder keys when present.

Requirements:
- Remove empty folders reliably in the current S3 provider.
- Keep visible delete logs and verification.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
