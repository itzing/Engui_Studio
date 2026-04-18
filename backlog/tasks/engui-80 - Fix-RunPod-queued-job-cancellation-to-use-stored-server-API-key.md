---
id: ENGUI-80
title: Fix RunPod queued job cancellation to use stored server API key
status: Inbox
assignee: []
created_date: '2026-04-16 19:58'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cancel paths currently read RunPod API key from settings.apiKeys.runpod while submission/status use settings.runpod.apiKey. Unify cancellation code to use settings.runpod.apiKey so upstream RunPod cancel is actually sent for queued jobs.
<!-- SECTION:DESCRIPTION:END -->
