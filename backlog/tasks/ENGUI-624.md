---
id: ENGUI-624
title: Shorten mobile queue start and finish banners to one second
status: In Progress
created_date: '2026-11-27'
labels: [mobile, notifications]
---

Owner15112 requested1second display for both mobile queue start and completion banners.
Change shared banner dismissal7000ms to1000ms. Keep2500ms queue-settle delay, unread badge, click/dismiss behavior, desktop and MCP unchanged.
Update existing timeout assertion, run existing notification tests and isolated production build, deploy with previous build retained, commit and push.
