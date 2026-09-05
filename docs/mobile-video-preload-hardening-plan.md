# Mobile Video Preload Hardening Plan

## Context

An iPhone reproduced a long-standing mobile media loading issue strongly enough to destabilize the phone-side media/network stack. Server diagnostics showed healthy MP4 delivery, valid poster derivatives, and working range requests, so the hardening target is client-side video lifecycle pressure.

## Approach

- Keep mobile TikTok mode to one real `<video>` element: the current slot only.
- Render nearby TikTok slots as poster-only entries with no video `src`, no explicit `load()`, and no eager preload.
- Release video resources by pausing, removing `src`, and calling `load()` when a TikTok video leaves the current slot or unmounts.
- On mobile fullscreen Gallery viewer, set YARL carousel preload to zero and render inactive video slides as posters.
- On mobile Gallery details, use `poster` and `preload="metadata"` for video previews.

## Validation

- Focused component tests for TikTok current-only mounting and cleanup.
- Focused component tests for mobile fullscreen inactive video slides.
- Focused mobile details test for video poster and metadata preload.
- Production build, service restart, and smoke checks for `/m/carousel` and `/m/gallery`.

## Rollback

Revert the implementation commit, rebuild, restart `engui-studio.service`, and verify the mobile Gallery and TikTok routes return to the previous behavior.
