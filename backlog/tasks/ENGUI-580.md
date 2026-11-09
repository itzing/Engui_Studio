---
id: ENGUI-580
title: Cache mobile video bytes without additional players and delay loading feedback
status: Done
assignee: []
created_date: '2026-11-09 20:46'
labels: [frontend, mobile, video, performance]
dependencies: []
---

## Description

Owner14266 approves bounded neighboring/recent video byte caching and delayed loader after ENGUI-579. Owner explicitly rejects any repacking or transcoding. Preserve one persistent player and existing teardown.

## Acceptance Criteria

- [x] Mobile TikTok and Jobs/Gallery fullscreen reuse cached completed files across revisits without additional video elements or mid-play source replacement.
- [x] Cache bounded by bytes/items, one background fetch, active playback priority, stale/background cancellation and source-safe Blob URL disposal.
- [x] Cold or oversized media streams natively; cache errors fall back without remount loops or disabling playback.
- [x] Existing TikTok loading indicator waits 250ms; poster remains visible and manual Retry remains immediate.
- [x] Manual pause, background, mixed-media, Info and desktop/multi-video behavior remain intact; original media unchanged.
- [x] Unit/browser checks, production build, owner commit/push and deployment complete with retained rollback.

## Plan

See docs/mobile-video-byte-cache.md.

## Completion evidence

- 80 focused tests across9 files and isolated production build passed. Full tsc retains pre-existing repository debt; no new diagnostics in cache/prefetch/ManagedVideo/TikTok files or new tests.
- Chromium final candidate:40 warm TikTok and40 warm Jobs swipes, one player, no additional media requests; cached Blob frames actually decoded and no warm loader flashes. No native-to-Blob replacement during current playback. All Blob URLs released on close.
- WebKit explicitly verifies one-time Blob-to-native fallback for its unsupported H.264 fixture, immediate Retry and no automatic loop; its readiness is simulated only to enter the cache path. This is not iPhone decoding proof.
- Both engines pass mixed-media/ordinary-carousel,11 teardown cases+2 foreground/swipe checks, and11 Info checks in preview and production. Production also passes4 warm Chromium swipes per mode and WebKit fallback checks. All APIs/media intercepted; no jobs or application API writes.
- Deployed TxHJAOnPzxjfWNVvnqWEL. Prior A15oBS0Kn-cCav3ibRcgu retained at /home/engui/engui-runs/engui-580-20261109/previous.next. Original media untouched; no repacking.
- Evidence: workspace runs/engui-video-byte-cache-20261109/REPORT.md. Actual iPhone stability and latency remain to be confirmed by owner.
