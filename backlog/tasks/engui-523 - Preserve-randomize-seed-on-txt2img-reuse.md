# engui-523 - Preserve randomize seed on txt2img reuse

Labels: [gallery, reuse, create, seed]

## Summary

Keep the source image Randomize seed setting when a gallery/video reuse flow opens txt2img.

## Scope

- Gallery asset API metadata used by video reference picking.
- Video source-image metadata saved in Create Video drafts.
- Gallery video `txt2img` reuse payloads.

## Acceptance Criteria

- [x] Gallery image API responses expose `randomizeSeed` alongside `seed`.
- [x] Selecting a Gallery image as a video reference stores source `seed` and `randomizeSeed` metadata.
- [x] Gallery video To txt2img reuse can recover source image metadata from `galleryAssetId` for older video snapshots.
- [x] Image Create opens with Randomize enabled when the source image was generated with Randomize enabled.

## Result

- Added `randomizeSeed` to gallery list API responses.
- Stored `seed` and `randomizeSeed` when selecting a Gallery image as a video reference.
- Added a gallery-asset metadata merge for video To txt2img reuse when source snapshots point at `galleryAssetId`.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify txt2img reuse returns to the previous metadata behavior.
