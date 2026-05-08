---
id: ENGUI-297
title: Make Studio pose preview candidates collapsible and compact
status: Done
assignee: []
created_date: '2026-05-08 13:53'
labels:
  - studio-sessions
  - pose-library
  - ui
dependencies: []
priority: medium
completed_date: '2026-05-08 13:56'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pose detail Preview candidates section takes too much space. Make it collapsible and reduce candidate thumbnail/card size by about 4x area while keeping Set primary/Delete actions accessible.
<!-- SECTION:DESCRIPTION:END -->

## Resolution

- Preview candidates section is collapsed by default and toggles open/closed from the section header.
- Header shows a candidate count badge and keeps Generate preview visible.
- Candidate cards use compact `w-28` sizing with smaller controls, roughly quartering the visible card area compared with the previous grid.
- Validation: production build passed.
