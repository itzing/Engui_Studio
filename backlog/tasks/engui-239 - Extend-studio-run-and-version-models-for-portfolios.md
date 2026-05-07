---
id: ENGUI-239
title: Extend studio run and version models for portfolios
status: Done
assignee: []
created_date: '2026-05-07 17:49'
labels: [studio, portfolio, refactor]
dependencies: [ENGUI-238]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend existing StudioSessionRun with nullable portfolioId, photoSessionId, poseSetId, run name/settings/prompt override/resolution/count fields. Extend StudioSessionShotVersion with reviewState, reviewNote, and reviewedAt. Preserve legacy hidden/rejected fields and existing run/template behavior.

Reference docs:

- `docs/studio-portfolio-refactor-plan.md`
- `docs/studio-portfolio-technical-spec.md`
<!-- SECTION:DESCRIPTION:END -->
