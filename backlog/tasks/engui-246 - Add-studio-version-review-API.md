---
id: ENGUI-246
title: Add studio version review API
status: Inbox
assignee: []
created_date: '2026-05-07 17:49'
labels: [studio, portfolio, refactor]
dependencies: [ENGUI-239, ENGUI-240]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement PATCH review endpoint for StudioSessionShotVersion to set reviewState, reviewNote, and reviewedAt. Support unreviewed, pick, maybe, reject, hero, and needs_retry states. Preserve compatibility with existing rejected/hidden fields.

Reference docs:

- `docs/studio-portfolio-refactor-plan.md`
- `docs/studio-portfolio-technical-spec.md`
<!-- SECTION:DESCRIPTION:END -->
