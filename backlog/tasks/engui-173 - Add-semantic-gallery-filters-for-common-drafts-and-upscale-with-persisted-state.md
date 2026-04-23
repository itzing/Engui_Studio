---
id: ENGUI-173
title: >-
  Add semantic gallery filters for common, drafts, and upscale with persisted
  state
status: Inbox
assignee: []
created_date: '2026-04-23 09:05'
labels:
  - gallery
  - frontend
  - api
  - mobile
dependencies:
  - ENGUI-175
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend gallery filtering beyond media type by adding a second semantic filter row for all, common, drafts, and upscale. The gallery assets API should accept bucket filtering, and the RightPanel gallery UI should combine semantic filtering with the existing media-type filters, favorites, trash, search, and sort. Default semantic filter should be common on first open, but the last-used semantic filter state should persist and be restored.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 /api/gallery/assets accepts semantic bucket filtering for all/common/draft/upscale
- [ ] #2 RightPanel gallery UI renders a second semantic filter row alongside the existing media-type filters
- [ ] #3 Default semantic filter is common on first open
- [ ] #4 Last-used semantic filter state is persisted and restored with the rest of the gallery filter state
<!-- AC:END -->
