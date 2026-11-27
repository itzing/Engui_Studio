---
id: ENGUI-624
title: Shorten mobile queue start and finish banners to one second
status: Done
created_date: '2026-11-27'
labels: [mobile, notifications]
---

Owner15112 requested1second display for both mobile queue start and completion banners.
Change shared banner dismissal7000ms to1000ms. Keep2500ms queue-settle delay, unread badge, click/dismiss behavior, desktop and MCP unchanged.
Update existing timeout assertion, run existing notification tests and isolated production build, deploy with previous build retained, commit and push.

## Completed
- Both banners dismiss after1000ms;2500ms completion settle delay unchanged.
- Updated existing timeout assertion;27 existing notification tests passed.
- Isolated production build co7ieM-tA-Al8cucYw_Ul installed; engui-studio.service active and /m/create HTTP200.
- Previous build -cpTlYyNIiSQkGX92G2-v retained in /home/engui/engui-runs/engui-624-20261127/previous.next. No desktop/MCP change or job cancellation.
