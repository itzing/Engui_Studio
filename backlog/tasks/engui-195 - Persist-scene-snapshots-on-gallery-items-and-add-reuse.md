---
id: ENGUI-195
title: Persist scene snapshots on gallery items and add reuse
status: Done
assignee: []
created_date: '2026-04-24 16:50'
labels:
  - frontend
  - backend
dependencies: [ENGUI-194]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the new scene snapshot contract into gallery persistence so gallery items saved from Prompt Constructor-driven jobs can carry the same serialized scene state used at generation time. Add a gallery-side reuse flow that initializes a new editable Prompt Constructor draft from the stored gallery snapshot. This should make gallery assets reusable as scene starting points even when the original source scene has since changed or been deleted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Gallery items saved from scene-template jobs can persist the serialized scene snapshot together with source job and rendered prompt context
- [x] #2 Gallery UI exposes a reuse flow that opens a new editable Prompt Constructor draft from the stored gallery snapshot
- [x] #3 Reuse from gallery does not depend on the original editable scene still existing unchanged
- [x] #4 Existing gallery save flows do not regress for non-Prompt-Constructor generation paths
<!-- AC:END -->
