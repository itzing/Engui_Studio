---
id: ENGUI-224
title: Fix iPhone PWA swipe-to-home gesture being trapped by mobile shell
status: Inbox
assignee: []
created_date: '2026-05-06 09:17'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On iPhone in the installed PWA, swiping up from the bottom sometimes drags the page instead of triggering the system home gesture and haptic feedback. Other apps do not show this behavior. Investigate the mobile shell/layout scroll and overscroll settings, identify what traps the bottom-edge gesture, and adjust the shell so iOS can recognize swipe-to-home reliably without breaking normal in-app scrolling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The installed iPhone PWA no longer traps the bottom swipe gesture on the mobile shell during normal use.
- [ ] #2 Normal vertical scrolling inside mobile screens still works after the fix.
- [ ] #3 The change is limited to mobile shell/layout behavior and does not regress desktop routes.
<!-- AC:END -->
