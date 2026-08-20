# ENGUI-517 - Regenerate video thumbnails as full-frame posters

Status: Done
Created: 2026-08-20T21:25:54Z
Finished: 2026-08-20T21:42:00Z

## Goal

Use gallery video thumbnails as full-frame video posters instead of square cropped thumbnails, while keeping gallery tiles visually cropped to their center.

## Scope

- Gallery video derivative generation and backfill.
- Desktop and mobile gallery tile rendering.
- Mobile TikTok carousel poster loading.

## Acceptance Criteria

- [x] Video thumbnail derivatives are generated from the first frame without square crop distortion.
- [x] Existing gallery videos can be backfilled to the new full-frame poster thumbnail.
- [x] Gallery tiles still show the centered middle crop of a video poster.
- [x] TikTok mode uses the thumbnail poster layer while videos load instead of relying on the browser's first-frame display.
- [x] Focused tests cover derivative generation and TikTok poster behavior.

## Result

Implemented on 2026-08-20.

- Video gallery derivatives now write `poster` thumbnails from the first frame without forcing a 480x480 crop.
- Gallery grid tiles continue to render thumbnails with centered `object-cover`, so they show the middle crop of the full poster.
- TikTok video slots now keep the thumbnail poster layer visible for current and neighboring videos until the video is ready.
- Backfilled `2151/2151` gallery video thumbnails to `*-poster-*` derivatives; `0` failed.
- Validation passed: focused gallery derivative/carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel` plus gallery views.
