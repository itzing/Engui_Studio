---
id: ENGUI-599
title: Recover stalled mobile Gallery and Jobs video without leaving the viewer
status: In Progress
created_date: '2026-11-22 20:23'
labels: [mobile, video, ios, recovery]
---

## Scope
Owner14705 approved recovery after read-only Showdown investigation. Keep the existing persistent player, TikTok behavior and original media files. No database migration or automatic retry loops. Background YouTube interruption on iPhone PWA remains unproven; do not claim this patch definitively fixes it.

## Acceptance
- Shared Gallery/Jobs mobile viewer exposes Retry after a media/play failure or 10 seconds without playback progress.
- Retry resets the source on the same owned video element, preserving muted inline playback; source changes, close and visibility lifecycle remain safe.
- Deliberate pause, hidden/pagehide and source-less image slides do not trigger false stall warnings.
- Copy diagnostics is available on failure from iPhone, with clipboard fallback. Bounded local records contain media state, visibility, muted/inline flags, safe rejection names and available audio-session state, not URLs, prompts or identifiers. No telemetry upload or audio-session policy changes.
- Meaningful regression tests plus read-only real Showdown media in Gallery and fixture Jobs; no paid generations. Staged build, owner commit/push, promote/restart and live smoke. Retain old build for rollback.

## Validation before release
72 targeted tests pass (32 lifecycle/cache/diagnostics/recovery + 40 fullscreen/carousel regressions). Isolated production build c75JRcdCDsomyd2PrTFK0 passes. Candidate browser verification: Chromium26 including real Showdown playback and same-player manual recovery; Linux WebKit10 UI/lifecycle assertions (H264 decoding unavailable there). No attempted server writes or page exceptions. Existing repository TypeScript debt, including unchanged ZoomRef import, remains; additions have no new type diagnostics. See docs/mobile-video-recovery.md.
