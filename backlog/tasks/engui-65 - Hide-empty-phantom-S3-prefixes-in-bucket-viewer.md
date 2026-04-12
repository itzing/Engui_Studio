---
id: ENGUI-65
title: Hide empty phantom S3 prefixes in Bucket Viewer
status: In Progress
assignee: []
created_date: '2026-04-12 17:16'
updated_date: '2026-04-12 17:16'
labels:
  - engui
  - s3-explorer
  - storage
  - bug
  - ui
  - regression
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hide phantom folder prefixes in S3 Bucket Viewer when the S3 provider returns a CommonPrefix but recursive inspection shows no remaining objects inside it.

Requirements:
- Do not show empty phantom prefixes after delete.
- Keep non-empty folders visible.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
