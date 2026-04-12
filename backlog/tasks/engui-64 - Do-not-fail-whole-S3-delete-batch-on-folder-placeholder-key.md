---
id: ENGUI-64
title: Do not fail whole S3 delete batch on folder placeholder key
status: In Progress
assignee: []
created_date: '2026-04-12 17:12'
updated_date: '2026-04-12 17:12'
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
Prevent S3 folder deletion from failing the whole delete batch when the provider rejects a folder placeholder key while other delete targets like folder markers can still be removed.

Requirements:
- Keep deleting valid keys even if a placeholder folder key fails.
- Return useful backend results for verification.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
