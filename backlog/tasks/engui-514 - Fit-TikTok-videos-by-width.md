# ENGUI-514 - Fit TikTok videos by width

Status: Done
Created: 2026-08-20T20:35:00Z
Finished: 2026-08-20T20:41:00Z

## Goal

Make mobile TikTok carousel videos fit inside the viewport by width and stay centered, allowing black bars above and below instead of cropping video edges.

## Scope

- Mobile TikTok carousel video and poster rendering in `GalleryVideoCarousel`.
- Preserve normal desktop/gallery carousel object-cover behavior.

## Acceptance Criteria

- [x] TikTok video elements use contained rendering instead of cropping.
- [x] TikTok poster overlays use the same contained rendering for current and neighbor video slots.
- [x] Normal non-TikTok carousel video/image rendering remains unchanged.
- [x] Focused tests cover TikTok contained video and poster classes.

## Result

Implemented on 2026-08-20.

- TikTok video elements now render with `object-contain`, keeping the full frame centered inside the viewport and allowing black bars above/below.
- TikTok poster overlays also render with `object-contain`, matching video geometry while loading and preventing a crop jump.
- Non-TikTok carousel media still uses existing cover rendering.
- Validation passed: focused carousel Vitest, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/m/carousel`.
