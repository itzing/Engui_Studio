---
id: ENGUI-175
title: Add gallery asset bucket model and allow intentional duplicate entries
status: Inbox
assignee: []
created_date: '2026-04-23 09:04'
labels:
  - gallery
  - backend
  - api
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a semantic bucket field to GalleryAsset so gallery entries can be classified as common, draft, or upscale. In the same migration, remove the hard uniqueness gate on workspaceId + contentHash because product now requires separate duplicate entries even for byte-identical media. Existing assets should migrate safely to bucket=common with no historical upscale backfill in phase one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GalleryAsset has a bucket field with allowed values common, draft, and upscale
- [ ] #2 Existing gallery assets migrate to bucket=common without data loss
- [ ] #3 Hard uniqueness on workspaceId + contentHash is removed or replaced so intentional duplicate entries are allowed
- [ ] #4 Indexes still support efficient gallery listing by workspace, trash state, bucket, and recency
<!-- AC:END -->
