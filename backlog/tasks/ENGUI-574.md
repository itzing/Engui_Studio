---
id: ENGUI-574
title: Toggle image and video when reselecting the mobile Create tab
status: Done
assignee: []
created_date: '2026-10-30 12:10'
labels: [mobile, frontend]
dependencies: []
---

## Description

On the mobile Create root screen, reselecting the bottom Create tab switches Image to Video and Video to Image. Preserve ordinary navigation from other screens and mode-specific drafts.

## Acceptance Criteria

- [x] Reselecting Create at /m/create toggles Image and Video without navigation or job submission.
- [x] Existing top mode controls and draft persistence remain authoritative; Audio/Music reselect enters Image.
- [x] From other tabs and nested Create screens, Create retains normal root navigation without toggling.
- [x] Desktop, tablet layout, viewport sizing and other navigation are unchanged.
- [x] Focused tests, isolated build, browser checks, owner commit/push and deployment complete.

## Plan

See docs/mobile-create-tab-toggle.md.

## Completion

88 focused tests and isolated production build pass. WebKit and Chromium each passed 42 scenarios in preview and deployed HTTPS, including root reselect, nested editor return, separate image/video prompt and settings persistence, reload and returning from Jobs/Gallery/Carousel without toggling. Zero page errors, unexpected API paths or production writes/jobs. Service restarted 2026-10-30 12:15:28 UTC. Previous build retained at /home/engui/engui-runs/engui-574-20261030/previous.next. Desktop/tablet and the standalone iPhone height fix remain unchanged. Physical iPhone interaction awaits owner confirmation.
