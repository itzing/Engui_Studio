---
id: ENGUI-61
title: Keep S3 delete log visible and verify delete results
status: In Progress
assignee: []
created_date: '2026-04-12 16:22'
updated_date: '2026-04-12 16:22'
labels:
  - engui
  - s3-explorer
  - storage
  - ui
  - bug
  - regression
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep the S3 delete log visible after delete operations finish and verify actual delete results instead of trusting the backend response blindly.

Requirements:
- Do not hide delete logs immediately after completion.
- Re-check whether deleted folders/files are actually gone after delete completes.
- Surface failures clearly in the UI.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
