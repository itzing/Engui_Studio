---
id: ENGUI-563
title: Add a single mobile gallery return-position button
status: Done
assignee: []
created_date: '2026-10-25 12:00'
labels: [mobile, gallery]
dependencies: []
---

## Description

Implement the owner-approved single icon beside gallery search: save a position, clear while the anchored asset intersects the viewport, or return when it is outside. Do not add a menu, badge bar, or second control. Desktop stays unchanged.

## Acceptance Criteria

- [x] One icon-only button: Save position / Clear position / Return to position, with accessible English labels.
- [x] Capture the visible selected asset, otherwise the first fully visible tile; track actual viewport intersection, not virtualizer overscan.
- [x] Restore by asset ID and viewport offset, including saved filters/search; do not overwrite the point during browsing or returning.
- [x] Persist one point per workspace/device across detail navigation and reloads.
- [x] Handle missing anchors, request failures, and workspace/filter changes without stale jumps.
- [x] Validate the three-state workflow and produce a production build.

## Plan

See docs/mobile-gallery-return-position-plan.md.

## Result

Implemented the single 44px Bookmark / BookmarkX / Undo2 control beside mobile gallery search. An explicit point remains independent of last-viewed selection and persists per workspace/device. Restore uses asset identity and viewport offset, including saved query/filters, and handles missing anchors and network retries.

Validation: 31/31 focused tests passed; production build passed; 11 Chromium fixture workflow checks passed at 390px/320px phone and 1024px tablet widths, with no page errors or API writes. TypeScript comparison against pre-change HEAD found the same 116 diagnostics and zero introduced errors. Updated two pre-workspace test assumptions without changing their product behavior.

Delivery follows the plan: owner-authored commit/push and engui-studio.service restart with HTTP checks. Persistent build/test logs: /home/engui/engui-runs/engui-563-20261025/. Browser evidence: OpenClaw workspace runs/engui-gallery-position-20261025/.
