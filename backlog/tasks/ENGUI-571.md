---
id: ENGUI-571
title: Give haptic feedback when the mobile gallery hold clears a return point
status: Done
assignee: []
created_date: '2026-10-30 11:36'
labels: [mobile, frontend]
dependencies: [ENGUI-570]
---

## Description

Provide a short tactile acknowledgement at the successful 600ms hold-to-clear action, before pointer release. Preserve the single gallery return control.

## Acceptance Criteria

- [x] A successful offscreen point clear requests one short haptic response immediately.
- [x] No feedback for short taps, cancelled holds, failed visibility checks or release clicks.
- [x] iPhone Safari uses its native switch feedback; Vibration API is a fallback path for supported mobile browsers. Unsupported/denied feedback never breaks clearing.
- [x] No extra visible/focusable controls, scrolling, audio, dependencies or viewport changes.
- [x] Focused tests, isolated build, browser verification, owner commit/push and deployment complete.

## Plan

See docs/mobile-gallery-clear-haptics.md.

## Completion

62 tests and isolated production build pass. WebKit/Chromium each pass 28 preview and 28 deployed scenarios with zero page errors, production API writes or unexpected API paths. Safari native switch capability is explicitly simulated on Linux, while activation/focus/cleanup use real browser DOM; physical iPhone haptics still require owner confirmation. Deployed 2026-10-30 11:38:43 UTC. Previous build retained under /home/engui/engui-runs/engui-571-20261030/previous.next. No generation jobs, viewport changes, extra controls or dependencies.
