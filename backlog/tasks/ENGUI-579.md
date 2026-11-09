---
id: ENGUI-579
title: Stabilize mobile video startup and reuse fullscreen players
status: Done
assignee: []
created_date: '2026-11-09 16:50'
labels: [frontend, mobile, video, reliability]
dependencies: []
---

## Description

Owner approved follow-up after ENGUI-578 did not resolve system-wide iOS video freezes. Remove proven competing startup load/pause controls and reduce player churn. No claim of a confirmed iOS root cause.

## Acceptance Criteria

- [x] Mobile TikTok reuses one element across swipes and changes source only at the committed swipe destination.
- [x] Mobile Jobs/Gallery fullscreen reuses one element across video and mixed-media navigation.
- [x] No post-play preload load or premature current-player pause; no automatic mobile remount loop on errors/stalls.
- [x] Background/foreground, manual pause, source replacement, swipe/Info/actions and desktop/multi-video behavior remain valid.
- [x] Bounded local diagnostics contain no media URLs, prompts, credentials or network uploads.
- [x] Relevant regression and prolonged browser checks, build, owner commit/push and deployment completed with retained rollback.

## Plan

See docs/mobile-persistent-video.md. Evidence: workspace runs/engui-video-freeze-followup-20261109/REPORT.md.

## Completion evidence

- 70 targeted tests passed; isolated production build passed.
- Final candidate Chromium and WebKit: 80 TikTok and 80 Jobs swipes per engine retain one player, 81 play requests, zero source-backed load resets. Mixed-media Gallery and ordinary multi-video carousel checks passed.
- Preview and production: 11 teardown cases, 2 foreground/swipe checks and 11 Info checks per engine, with intercepted APIs/media and no jobs or writes. Production additionally passed mixed-media and carousel smoke probes.
- Deployed build A15oBS0Kn-cCav3ibRcgu; previous cXIKN94cTIiR1fbDYit9Z retained in /home/engui/engui-runs/engui-579-20261109/previous.next.
- Full TypeScript check remains red on pre-existing repository errors (including ZoomRef and React test mock typing); build and focused tests pass. Linux WebKit validates lifecycle/UI but does not decode this H.264 fixture; Chromium does.
- Actual iPhone/system-wide freeze resolution is still unconfirmed. Evidence: workspace runs/engui-persistent-video-20261109/REPORT.md.
