---
id: ENGUI-194
title: Persist scene snapshots on jobs and add reuse from job
status: Done
assignee: []
created_date: '2026-04-24 16:49'
labels:
  - frontend
  - backend
dependencies: [ENGUI-189, ENGUI-193]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When Prompt Constructor generation runs from `scene_template_v2`, persist the immutable serialized scene snapshot on the created job together with the rendered prompt and source scene identity when available. Then expose a reuse flow from job details that opens a new editable Prompt Constructor draft initialized from that stored snapshot. Reuse must start from the captured scene state that actually produced the job, not from whatever the current saved scene has become later.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Generation from `scene_template_v2` stores a serializable immutable scene snapshot on the created job
- [x] #2 Job records retain the rendered prompt and source scene identity together with the snapshot payload
- [x] #3 Job details expose a reuse flow that opens a new editable Prompt Constructor draft from the stored scene snapshot
- [x] #4 Editing the original saved scene later does not mutate snapshots already attached to existing jobs
<!-- AC:END -->
