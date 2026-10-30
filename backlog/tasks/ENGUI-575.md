---
id: ENGUI-575
title: Toggle Gallery and Draft membership in mobile fullscreen Jobs
status: Done
assignee: []
created_date: '2026-10-30 12:50'
labels: [mobile, frontend]
dependencies: []
---

## Description

Keep Gallery and Draft icons visible after saving a job output in the phone fullscreen Jobs viewer. Saved icons remove that output from the corresponding bucket, while unsaved icons add it as before.

## Acceptance Criteria

- [x] Saved Gallery/Draft actions remain visible, highlighted and accessible with remove labels.
- [x] Each action toggles only its bucket for the displayed output; removal trashes matching assets without deleting the job or other bucket copies.
- [x] Pending actions prevent duplicate requests; errors preserve valid state and show English feedback, including partial multi-copy removal.
- [x] Image/video and reopening the viewer reflect saved state; existing upscale eligibility and desktop/detail screens remain unchanged.
- [x] Tests, isolated build, browser validation, owner commit/push and production deployment complete without real jobs or gallery mutations during tests.

## Plan

See docs/mobile-jobs-fullscreen-gallery-toggle.md.

## Completion

103 focused tests and isolated production build pass. WebKit and Chromium each passed 50 scenarios in preview-final and deployed HTTPS, including independent Gallery/Draft remove/re-add, retained state on failures, busy buttons, image/video fullscreen, reopen/reload persistence, and a delayed detail response racing a confirmed removal. Each engine simulated 12 gallery mutations in memory; zero real API writes, unexpected API paths, page errors or generation jobs. Saved icons fit 320/390px and the 390px WebKit screenshot was visually inspected. Service restarted 2026-10-30 13:00:04 UTC. Preview exited 0. Previous build retained at /home/engui/engui-runs/engui-575-20261030/previous.next. Physical iPhone confirmation remains user-side.
