---
id: ENGUI-572
title: Confirm gallery hold-to-clear visibly above the held button
status: Done
assignee: []
created_date: '2026-10-30 11:45'
labels: [mobile, frontend]
dependencies: [ENGUI-570, ENGUI-571]
---

## Description

Owner reports no haptic on iOS 26.6.2 and approved a short Position cleared badge above the existing mobile gallery return button. Replace the ineffective haptic workaround with visible confirmation at the moment of successful hold-to-clear.

## Acceptance Criteria

- [x] Position cleared appears above the held button at the successful 600ms clear, before release, then disappears automatically.
- [x] No extra interactive control, layout shift or pointer interception; accessible status text, English UI.
- [x] No message for short/cancelled/visibility-rejected holds; no release resave. Workspace changes/unmount clean up timers.
- [x] Remove the ineffective haptic helper and its tests; preserve existing Save/Clear/Return, paste and viewport behavior.
- [x] Focused tests, isolated build, preview/production browser checks, owner commit/push and deployment.

## Plan

See docs/mobile-gallery-clear-confirmation.md.

## Completion

61 targeted tests and isolated production build pass. WebKit and Chromium each passed 30 scenarios in preview and on deployed HTTPS, with zero JavaScript errors, unexpected API paths or production API writes. Screenshots at 320/390px show the entire badge above the button before release; it survives release and dismisses automatically. The failed haptic helper is removed. Service deployed 2026-10-30 11:49:15 UTC; previous build retained in /home/engui/engui-runs/engui-572-20261030/previous.next. No generation jobs or viewport changes. Native iPhone confirmation is not claimed by browser fixtures.
