---
id: ENGUI-123
title: Generate lightweight local image previews for completed jobs
status: Planned
assignee: []
created_date: '2026-04-19 06:29'
labels:
  - jobs
  - backend
  - performance
  - mobile
  - image
dependencies:
  - ENGUI-18
references:
  - /home/engui/Engui_Studio/src/lib/runpodSupervisor.ts
  - /home/engui/Engui_Studio/src/app/api/generate/route.ts
  - /home/engui/Engui_Studio/src/lib/galleryDerivatives.ts
  - /home/engui/Engui_Studio/prisma/schema.prisma
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate a lightweight local image preview derivative when a job reaches its final completed local result.

The jobs list should not load the original full-resolution image just to render a small card on desktop or mobile. Reuse the existing local derivative pattern where practical, persist the lightweight asset on the job record, and keep derivative generation non-fatal so a preview failure never blocks the main completed result.

Initial scope is image jobs only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 New completed image jobs get a lightweight local preview/thumbnail asset during server-side finalization
- [ ] #2 The job record stores a local preview field for jobs-list rendering, using `thumbnailUrl` unless a better existing field is justified
- [ ] #3 Preview generation failure does not block the job from reaching `completed` with a valid `resultUrl`
- [ ] #4 Preview files use deterministic safe paths/names so later cleanup and deletion can remove them reliably
- [ ] #5 Non-supervisor completion paths that already materialize local image results are aligned so they also populate the preview field
<!-- AC:END -->
