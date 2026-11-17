---
id: ENGUI-592
title: Add non-spammy mobile in-app queue lifecycle notifications
status: In Progress
assignee: []
created_date: '2026-11-17 12:14'
labels: [mobile, jobs, notifications]
dependencies: []
---

## Description
Owner14606 approved one global start and one aggregated finish banner per queue cycle. In-app only, frontend-only, existing jobs list/polling; explicitly no server summary.

## Acceptance Criteria

- [x] Start once when first queued job runs; final summary once after all jobs settle, including newly added jobs.
- [x] Truthful failures/cancellation/removal and finalizing; no false completion on loading or network errors.
- [x] All mobile screens including fullscreen, View jobs and dismiss, unread Jobs dot; no desktop notifications.
- [x] No duplicate notifications across navigation/reload, workspace isolation, latest-only on foreground.
- [ ] Focused tests, browser checks, isolated build, owner commit/push and production verification pass without paid jobs.

## Plan and rollback
See docs/mobile-queue-notifications.md. Preserve previous.next and restore/restart service if necessary. No server API/schema changes.

## Pre-deployment verification

- 63 focused tests pass across lifecycle, rendered mobile integration, tab navigation, workspace isolation and iPhone height sizing.
- Isolated production build passes; original serving build is unchanged during verification.
- Browser lifecycle checks use intercepted APIs and synthetic jobs only. Final preview and production reports are recorded after rollout.
- Repository-wide TypeScript diagnostics exist outside the changed files; no diagnostics in changed modules.
