---
id: ENGUI-171
title: Extend gallery save APIs and job output state for common vs draft buckets
status: Inbox
assignee: []
created_date: '2026-04-23 09:05'
labels:
  - gallery
  - backend
  - api
dependencies:
  - ENGUI-175
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the manual gallery-save API surface so job outputs can be saved explicitly as common or draft. The add-to-gallery endpoint should accept a semantic bucket, validate it, and persist it. The job-output read path should become bucket-aware as well, so the UI can tell whether a given output already has a common save, a draft save, both, or neither, instead of relying on one global alreadyInGallery boolean.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /api/gallery/assets/from-job-output accepts bucket=common|draft and defaults to common when omitted
- [ ] #2 The save API persists the selected bucket for new gallery entries
- [ ] #3 The save API no longer blocks intentional duplicate entries only because contentHash matches an existing asset
- [ ] #4 /api/jobs/[id] exposes bucket-aware saved-state data so UI actions can reason about common and draft separately
<!-- AC:END -->
