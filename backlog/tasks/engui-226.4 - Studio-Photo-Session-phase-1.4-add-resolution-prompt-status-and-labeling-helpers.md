---
id: ENGUI-226.4
title: >-
  Studio Photo Session phase 1.4 - add resolution, prompt, status, and labeling
  helpers
status: Inbox
assignee: []
created_date: '2026-05-06 18:29'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-226.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
parent_task_id: ENGUI-226
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement shared runtime helpers for derived Studio Session behavior: resolution derivation from short/long/square policy, automatic prompt assembly, run-status derivation, and human-readable shot labeling. These helpers should be pure and reusable across API and UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Resolution helpers derive portrait, landscape, and square output sizes from short-side, long-side, and square-source policy.
- [ ] #2 Prompt assembly helpers combine template inputs, pose inputs, and derived composition context through one canonical path.
- [ ] #3 Run-status and shot-label helpers provide reusable logic for product statuses and labels like Standing 1 or Portrait 2.
<!-- AC:END -->
