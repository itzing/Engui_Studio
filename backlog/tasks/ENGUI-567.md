---
id: ENGUI-567
title: Recover mobile panel position after keyboard dismissal without replacing the shell
status: Done
assignee: []
created_date: '2026-10-28 22:35'
labels: [mobile, frontend, regression]
dependencies: []
---

## Description

Owner confirmed ENGUI-566 rollback restores mobile availability and still needs the original iPhone keyboard-dismissal panel drift fixed. Investigate the failed controller in WebKit and implement a smaller, bounded correction while preserving the working shell.

## Acceptance Criteria

- [x] Preserve normal mobile shell layout; do not restore the fixed body/visualViewport sizing controller from 0f445de.
- [x] Recover residual document scrolling after keyboard dismissal, including dismissal without blur and navigation away from a focused editor.
- [x] Do not reset nested scroll positions, fight an open keyboard or pinch zoom, or register a recurring scroll correction loop.
- [x] Validate native browser bindings and app loading/navigation in WebKit as well as Chromium; distinguish synthetic dismissal tests from physical iPhone validation.
- [x] Run focused regressions and production build, commit/push as owner, deploy and check client rendering without jobs or API writes.

## Plan

See docs/mobile-keyboard-dismissal-recovery.md.

## Result

Implemented bounded document-pan recovery in MobileAppProviders and mobileKeyboardRecovery. The working CSS, shell, nav and safe-area layout are unchanged. The helper does not subscribe to scroll events or use an animation loop, does not blur editors, and cancels timers/listeners on mobile exit. Keyboard geometry state is retained across mobile routes.

Validation: 51 focused tests and targeted TypeScript check passed. Native WebKit 26 and Chromium recovery probes each passed six checks using real scroll/timer APIs and synthetic keyboard-height changes. Full-app browser checks each passed 13 scenarios in both engines against the isolated preview and again against deployed HTTPS: no page errors, API writes or unexpected API requests. Production build ran in a separate source snapshot; the running build was not overwritten during compilation. All 10 deployed HTTP checks returned 200.

Service restarted at 2026-10-28 22:41:53 UTC. Previous owner-confirmed build retained at /home/engui/engui-runs/engui-567-20261028/previous.next. Preview stopped cleanly. No generation jobs or production API writes were submitted. Physical iPhone keyboard behavior still requires owner confirmation; Linux WebKit is not a native iPhone test.

Evidence: /home/engui/engui-runs/engui-567-20261028/REPORT.md and OpenClaw workspace runs/engui-mobile-keyboard-v2-20261028/.
