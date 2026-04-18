---
id: ENGUI-114
title: Restore gallery around last viewed asset with focus-anchored infinite scroll
status: Inbox
assignee: []
created_date: '2026-04-18 12:53'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the gallery assets listing flow so Gallery can reopen around the last viewed asset instead of resetting to page 1 after closing the fullscreen viewer.

Add `focusAssetId` support to the gallery list API using the active gallery query state (filters, search, sort, page size) so the backend can resolve which page contains that asset and return focus metadata.

Refactor the gallery list UI from bottom-only `Load more` into bidirectional infinite scroll that can start from the resolved focus page, allowing users to continue browsing both upward and downward from the restored position.

On viewer close, restore Gallery around the last viewed asset, keep that asset visibly selected with a stronger highlight, and preserve graceful fallback behavior when the asset is no longer present in the current filtered result set.

Add low-priority background prefetch for neighboring pages and keep a moving retention window of up to 3 pages on each side of the current visible page. For pages outside that window, clear only thumbnail/image content while preserving page shells and layout state so scroll position does not jump.
<!-- SECTION:DESCRIPTION:END -->

## Plan

- Implementation plan: [`../../docs/engui-114-gallery-focus-infinite-scroll-plan.md`](../../docs/engui-114-gallery-focus-infinite-scroll-plan.md)
