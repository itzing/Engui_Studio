# ENGUI-535 - Harden mobile video preloading

Status: Done
Created: 2026-09-05T18:10:00Z
Finished: 2026-09-05T18:26:00Z
Labels: [gallery, mobile, tiktok, video, ios]

## Summary

Reduce iPhone/WebKit media pressure by keeping only the active mobile video element loaded in playback surfaces.

## Scope

- Mobile TikTok carousel video lifecycle.
- Mobile fullscreen Gallery viewer video preloading.
- Mobile Gallery details video preview loading hints.
- Focused regression coverage for mobile-only video mounting and cleanup.

## Acceptance Criteria

- [x] TikTok mode mounts a real `<video>` only for the current slot; nearby slots remain poster-only.
- [x] TikTok video elements release their `src` when they leave the current slot or unmount.
- [x] Mobile fullscreen Gallery viewer does not mount inactive video sources and uses no adjacent preload.
- [x] Mobile Gallery details uses poster-backed metadata preload for videos.
- [x] Desktop Gallery carousel and fullscreen behavior remain unchanged.

## Result

- TikTok mode now keeps only the current slot as a real video element; neighbors stay poster-only.
- TikTok video refs release their source when they leave the current slot, including retry remounts.
- Mobile fullscreen Gallery viewer disables adjacent preloading and renders inactive video slides as posters.
- Mobile Gallery details uses a poster and `preload="metadata"` for video previews.
- Validation passed: focused component tests, targeted ESLint with existing warnings only, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and smoke `/m/carousel` plus `/m/gallery`.
