# Video Sequence Final Gallery Save Plan

## Goal

Allow the desktop Video Sequence Builder to save a rendered final video into Gallery, while keeping Gallery as the single viewer surface for both desktop and mobile.

## Scope

- Desktop add action in `/video-sequences`.
- Backend API for final sequence video transfer to Gallery.
- Gallery-owned storage copy, content hashing, duplicate handling, derivatives, and enrichment.
- Existing desktop and mobile Gallery viewing paths.

## Out of Scope

- Mobile add-to-gallery action.
- Automatic save after rendering.
- Segment-level save actions.
- Gallery collection assets for whole sequence storyboards.

## Implementation

1. Add `POST /api/video-sequences/:id/add-to-gallery`.
2. Resolve the sequence with ordered segments and require `finalVideoUrl`.
3. Read the final video from an allowed local public path under `/generations` or `/results`.
4. Copy bytes into `public/generations/gallery/<workspaceId>/<sha256>.mp4`.
5. Create or return a `GalleryAsset`:
   - `type: "video"`
   - `bucket: "common"`
   - `originKind: "video_sequence_final"`
   - `sourceOutputId: "video-sequence-final:<sequenceId>:<finalVideoUrl>"`
   - `generationSnapshot` with sequence and segment context
6. Queue existing Gallery derivatives and enrichment for newly created assets.
7. Add a compact desktop header button next to the final-video link.
8. Dispatch the existing `galleryAssetChanged` browser event after save so Gallery refreshes.

## Validation

- Focused API tests for create, repeat save, and missing final video.
- Focused component helper coverage for the new header tooltip.
- `git diff --check`
- `npx prisma validate`
- `npm run build`
- Restart `engui-studio.service`
- HTTP smoke checks for `/` and `/m/gallery`

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`. Any assets manually created through the new action can be deleted through Gallery.
