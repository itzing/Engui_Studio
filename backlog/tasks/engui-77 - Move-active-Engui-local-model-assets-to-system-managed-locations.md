---
id: ENGUI-77
title: Move active Engui local model assets to system-managed locations
status: Inbox
assignee: []
created_date: '2026-04-15 13:38'
labels:
  - infra
  - models
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the currently used Engui local model assets and launch scripts from ad hoc per-user locations into explicitly system-managed locations with a documented layout, so runtime services and future benchmark tooling use predictable paths. Cover both text prompt helper and vision prompt helper assets, service references, and rollback notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document the target system-managed model layout for active Engui local models.
- [ ] #2 Move or re-point active Engui model assets and launch scripts to the new managed locations without breaking current services.
- [ ] #3 Update service references and docs/notes so the new locations are the canonical source of truth.
- [ ] #4 Preserve a clear rollback path.
<!-- AC:END -->
