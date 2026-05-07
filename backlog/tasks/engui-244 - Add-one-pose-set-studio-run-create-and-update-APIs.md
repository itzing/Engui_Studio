---
id: ENGUI-244
title: Add one-pose-set studio run create and update APIs
status: Inbox
assignee: []
created_date: '2026-05-07 17:49'
labels: [studio, portfolio, refactor]
dependencies: [ENGUI-239, ENGUI-240, ENGUI-241, ENGUI-243]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement new run create/update endpoints under the studio API. A run must belong to one photo session, use exactly one poseSetId, and create shot slots from that pose set and count. Reject multi-category run payloads.

Reference docs:

- `docs/studio-portfolio-refactor-plan.md`
- `docs/studio-portfolio-technical-spec.md`
<!-- SECTION:DESCRIPTION:END -->
