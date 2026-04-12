---
id: ENGUI-66
title: Stop creating per-job folders in secure-jobs storage
status: In Progress
assignee: []
created_date: '2026-04-12 17:27'
updated_date: '2026-04-12 17:27'
labels:
  - engui
  - storage
  - security
  - cleanup
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stop creating separate S3 folders per job under `secure-jobs`. Store secure job files directly under `secure-jobs` using filename prefixes instead, so cleanup is simpler and no phantom job folders accumulate.

Requirements:
- Remove per-job folder creation in secure job storage flows.
- Store files under `secure-jobs` with unique prefixes instead of nested folders.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
