---
id: ENGUI-592
title: Add non-spammy mobile in-app queue lifecycle notifications
status: Done
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
- [x] Focused tests, browser checks, isolated build, owner commit/push and production verification pass without paid jobs.

## Plan and rollback
See docs/mobile-queue-notifications.md. Preserve previous.next and restore/restart service if necessary. No server API/schema changes.

## Pre-deployment verification

- 63 focused tests pass across lifecycle, rendered mobile integration, tab navigation, workspace isolation and iPhone height sizing.
- Isolated production build passes; original serving build is unchanged during verification.
- Browser lifecycle checks use intercepted APIs and synthetic jobs only. Final preview and production reports are recorded after rollout.
- Repository-wide TypeScript diagnostics exist outside the changed files; no diagnostics in changed modules.

## Deployment verification

- Feature commit fa4743d authored/committed as Artem Ovechkin and pushed via owner itzing.
- Production deployed at 2026-11-17 12:31:50 UTC; service active and root/Create/Gallery/Jobs HTTP 200.
- Full corrected production suite: 19 browser checks per engine in Chromium and WebKit (38 total), zero page errors or unmocked API mutations. Preview also verified 19 checks per engine with fixture corrections documented in the private report.
- Previous build retained at /home/engui/engui-runs/engui-592-20261117/previous.next. No live jobs, database changes, server summaries or new polling.
- Evidence: workspace runs/engui-592-20261117/REPORT.md. Physical iPhone behavior has not been tested.
