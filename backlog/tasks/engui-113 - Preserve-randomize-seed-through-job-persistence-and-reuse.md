---
id: ENGUI-113
title: Preserve randomize seed through job persistence and reuse
status: Inbox
assignee: []
created_date: '2026-04-17 23:43'
labels: []
dependencies: [ENGUI-99]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix image-generation persistence so `randomizeSeed` is not lost after job submission, RunPod queue updates, or reuse flows. Ensure it remains stored in job options, survives client-side status transitions, and restores correctly into ImageGenerationForm during reuse.
<!-- SECTION:DESCRIPTION:END -->
