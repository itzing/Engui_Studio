---
id: ENGUI-226.1
title: Studio Photo Session phase 1.1 - add Prisma schema and workspace relations
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies: []
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-226
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the core Prisma models and workspace relations for Studio Photo Session templates, category rules, runs, shots, revisions, and versions. Keep the schema minimal for v1 but extensible for future overrides and richer asset handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Workspace-scoped Prisma models exist for templates, runs, shots, revisions, and versions.
- [ ] #2 Relations between templates, runs, shots, revisions, versions, workspaces, and source jobs are defined cleanly.
- [ ] #3 The schema leaves room for future category-level and shot-level override fields without requiring a later structural rewrite.
<!-- AC:END -->
