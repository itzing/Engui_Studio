---
id: ENGUI-226
title: Studio Photo Session v1 phase 1 — domain foundations and runtime helpers
status: Inbox
assignee: []
created_date: '2026-05-06 18:21'
labels:
  - studio-sessions
  - desktop
dependencies: []
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the Studio Photo Session v1 domain foundation layer: Prisma models, workspace-scoped persistence shape, static pose-library ingestion, and shared runtime helpers for template/run/shot/revision/version behavior. This phase should establish the canonical types and helper APIs that later UI and execution phases depend on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prisma schema additions exist for studio-session templates, category rules, runs, shots, revisions, and versions.
- [ ] #2 The provided pose library is normalized through a shared helper layer with stable category/orientation/framing accessors.
- [ ] #3 Shared runtime helpers exist for unique random pose picking, resolution derivation, prompt assembly, run status derivation, and shot labeling.
- [ ] #4 The domain model keeps room for future category overrides and shot-level overrides without exposing them in v1 UI.
<!-- AC:END -->
