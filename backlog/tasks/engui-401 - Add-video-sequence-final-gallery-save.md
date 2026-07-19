---
id: ENGUI-401
title: Add video sequence final Gallery save
status: Done
assignee: []
created_date: '2026-07-19 21:43'
updated_date: '2026-07-19 21:56'
labels: [video-sequences, gallery, desktop, mobile]
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a desktop-only action in Video Sequences to save the rendered final video into Gallery. The saved asset must use normal Gallery storage and appear in existing desktop and mobile Gallery views.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop `/video-sequences` exposes an Add final to Gallery action only after a final render exists.
- [x] #2 `POST /api/video-sequences/:id/add-to-gallery` copies the final MP4 into Gallery-owned storage and creates a `GalleryAsset` with `type: video`.
- [x] #3 Saving is idempotent for the same sequence final video and bucket, returning the existing asset on repeat.
- [x] #4 Gallery snapshot preserves sequence metadata and segment generation/source context.
- [x] #5 Saved final videos appear through existing desktop and mobile Gallery APIs with no mobile add button.
- [x] #6 Focused API/component tests cover success, repeat save, and blocked save without final render.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`. Gallery assets already created by the new action can be removed through normal Gallery trash/permanent delete.

Implemented with a new desktop header action and `POST /api/video-sequences/:id/add-to-gallery`. The API copies the rendered final video into Gallery-owned storage, records `originKind: "video_sequence_final"`, preserves sequence and segment metadata in `generationSnapshot`, queues Gallery derivatives/enrichment for new assets, and returns existing assets for repeat saves.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Desktop Video Sequences can now save rendered final videos into Gallery. Saved videos are normal Gallery video assets, so existing desktop and mobile Gallery views can display them without a mobile-specific add action.
<!-- SECTION:FINAL_SUMMARY:END -->
