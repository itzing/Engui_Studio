---
id: ENGUI-125
title: Backfill lightweight previews for existing completed image jobs
status: Planned
assignee: []
created_date: '2026-04-19 06:30'
labels:
  - jobs
  - backend
  - maintenance
  - performance
  - image
dependencies:
  - ENGUI-123
references:
  - /home/engui/Engui_Studio/src/lib/runpodSupervisor.ts
  - /home/engui/Engui_Studio/src/lib/galleryDerivatives.ts
  - /home/engui/Engui_Studio/src/app/api/jobs/route.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a safe batched backfill path for already completed image jobs that predate the new jobs-list preview generation.

The goal is to improve the existing jobs history over time without requiring every old job to be regenerated. The backfill should be idempotent, skip jobs that already have a valid lightweight preview, and tolerate missing/non-local originals without turning the job itself into a failure.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A batched backfill path exists for completed image jobs missing a valid lightweight preview field
- [ ] #2 Backfill is idempotent and skips jobs that already have a usable generated preview
- [ ] #3 Missing, deleted, or non-local original files are skipped safely with logging instead of causing crashes
- [ ] #4 Batch size / execution limits are explicit so large histories do not run as one unbounded job
- [ ] #5 The backfill reports generated, skipped, and failed counts clearly enough for manual monitoring
<!-- AC:END -->
