---
id: ENGUI-578
title: Release mobile video resources across navigation and backgrounding
status: Done
assignee: []
created_date: '2026-11-08 23:39'
labels: [frontend, mobile, video, reliability]
dependencies: []
---

## Description

Fix confirmed mobile video lifecycle gaps in Jobs/Gallery fullscreen, details/preview and carousel. Owner reports an iOS-wide playback failure that also affects native YouTube until reboot; this change addresses application resource handling, not a proven system-level root cause.

## Acceptance Criteria

- [x] Closing, switching or unmounting a mobile video synchronously pauses and detaches its source before its reference is lost.
- [x] Background/pagehide releases sources and cancels pending playback/retry work; foreground restores the current source/time and only resumes intended playback.
- [x] Re-rendering controls does not unload/reload the same video or force playback after a user pause.
- [x] Fullscreen/TikTok retain one active video; desktop behavior and intentional multi-video modes remain intact.
- [x] Regression tests and intercepted browser lifecycle checks pass, including Info navigation and repeated transitions.
- [x] Build, commit/push and deployment are complete with a retained rollback build, without generation jobs.

## Plan

See docs/mobile-video-lifecycle.md. Diagnostic evidence: workspace runs/engui-ios-video-freeze-20261108/REPORT.md.

## Completion

Implemented stable mobile video ownership with synchronous teardown before callback detachment, source replacement cleanup, visibility/page lifecycle suspension, position/play-intent restoration, and stale-play guards. Mobile Jobs/Gallery viewers, details/preview, tablet Create preview and carousel use it. Carousel background retries, Flow timers and movement suspend while hidden. Desktop native rendering remains unchanged.

Validation: 67 tests passed; isolated production build passed. Both Chromium and WebKit passed 12 teardown/repeated-open scenarios plus a foreground/manual-pause check and 11 prior Info/swipe regressions, in preview and production. No API writes or generation jobs. Linux WebKit validation covers lifecycle/UI, not actual iOS hardware decoding. The owner must validate the reported system-wide freeze on the affected iPhone.

Production build cXIKN94cTIiR1fbDYit9Z is active; prior build rFR89OJo5UPYUQSrnAM_3 retained for rollback. TypeScript review fixed the new source-prop typing errors; the existing ZoomRef declaration issue and unrelated project type debt remain outside this task. Evidence: workspace runs/engui-mobile-video-lifecycle-20261108/ and /home/engui/engui-runs/engui-578-20261108/.
