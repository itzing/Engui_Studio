---
id: ENGUI-591
title: Restore video Random Seed when reusing Gallery videos in img2vid
status: In Progress
assignee: []
created_date: '2026-11-13 20:40'
labels: [create, video, gallery, mobile, desktop, regression]
dependencies: []
---

## Description

Owner14400 reports that To img2vid from a Gallery video loses the Random Seed checkbox. Trace submission, Gallery metadata, reuse payload and form hydration on desktop/mobile, then repair the confirmed omission without changing seed generation semantics.

## Acceptance Criteria

- [x] Video Randomize true/false and actual seed persist through job and Gallery snapshots.
- [x] Reusing a video restores the flag into the video form, including an already-mounted form with opposite state.
- [x] Image-to-video handoff still preserves the existing video draft; video/source-image seed flags are independent.
- [x] Regression tests and intercepted Chromium/WebKit checks pass on desktop/mobile.
- [ ] Owner commit/push, production build, deployment and health checks complete without paid generation.

## Rollback

Retain the previous production .next build and restore it with an explicit engui-studio.service restart if needed. No database migration or historical metadata rewrite.

## Pre-deployment evidence

- Original defect reproduced by eight new draft tests and on the old production UI in Chromium/WebKit.
- 95 focused API/reuse/carousel tests and 32 video form tests pass (127 total). Video form fixtures now use workspace-scoped storage, real API Responses and constructible URL mocks.
- Isolated production build passes. All 36 applicable preview browser checks pass, including targeted retries after correcting browser fixture priming and feed entry IDs.
- Read-only sample of the 200 newest Gallery videos: 192 true, eight false, no missing flags.
- Deployment and production validation pending.
