---
id: ENGUI-577
title: Open gallery details from the mobile TikTok overlay
status: Done
assignee: []
created_date: '2026-11-08 22:20'
labels: [frontend, mobile, gallery]
dependencies: []
---

## Description

Add an Info icon to the mobile TikTok-mode action overlay. Open the existing Gallery details screen for the currently displayed video. Desktop and other carousel modes remain unchanged.

## Acceptance Criteria

- [x] Mobile TikTok overlay includes an accessible Info button consistent with existing controls.
- [x] Info opens the same Gallery details screen as the gallery for the active video, including after swiping.
- [x] Button interaction does not trigger background swipes or hide the action overlay before navigation.
- [x] Desktop and non-TikTok controls remain unchanged.
- [x] Relevant tests, isolated production build, browser checks, commit/push and deployment complete without real generation jobs.

## Plan

See docs/mobile-tiktok-info.md.

## Completion notes

Added a mobile-only optional Info action to the existing TikTok overlay. It uses the centered asset ID and opens the existing mobile Gallery details route. The ordinary carousel and desktop callback configuration are unchanged.

Validation: 52 existing focused tests passed; isolated production build passed; 11 browser assertions per engine (WebKit and Chromium) passed in both preview and production, including a 320 px screen and post-swipe asset selection. API writes were intercepted and none occurred. No generation jobs were launched.

Existing carousel tests needed workspace-transport mocks compatible with their fetch fixtures; the mobile wrapper test needed a router mock. The serving build was retained for rollback. Production service is active and page health probes return HTTP 200. Evidence: `/home/engui/engui-runs/engui-577-20261108/` and workspace `runs/engui-mobile-tiktok-info-20261108/`.
