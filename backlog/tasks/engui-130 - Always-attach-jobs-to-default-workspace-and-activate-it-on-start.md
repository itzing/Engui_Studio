---
id: ENGUI-130
title: Always attach jobs to default workspace and activate it on start
status: Done
assignee: []
created_date: '2026-04-19 12:03'
labels:
  - workspace
  - jobs
  - mobile
  - sync
  - backend
references:
  - /home/engui/Engui_Studio/src/app/api/generate/route.ts
  - /home/engui/Engui_Studio/src/app/api/jobs/route.ts
  - /home/engui/Engui_Studio/src/app/api/upscale/route.ts
  - /home/engui/Engui_Studio/src/app/api/elevenlabs/generate/route.ts
  - /home/engui/Engui_Studio/src/lib/context/StudioContext.tsx
priority: high
updated_date: '2026-04-19 12:08'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Jobs should no longer be created with `workspaceId = null` when a default workspace already exists. Server-side job creation paths must resolve the user's default workspace when the request omits `workspaceId`, and the client should initialize its active workspace to the default workspace id on startup so desktop and mobile stay aligned.

This ticket focuses on the main Engui job creation routes and the workspace boot path used by the UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 New jobs created without an explicit workspace id are attached to the user's default workspace
- [x] #2 Main Engui job creation routes no longer persist `workspaceId = null` when a default workspace exists
- [x] #3 Client startup selects the default workspace as active instead of reviving an arbitrary stale workspace id first
- [x] #4 Build and deploy verification pass
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a shared default-workspace resolver and used it in the main Engui job creation routes so missing `workspaceId` now falls back to the user's default workspace instead of persisting `null`. Updated the client workspace boot path to select the default workspace on startup and immediately persist that id as active.

Also migrated the current `user-with-settings` jobs with `workspaceId = null` into the existing default workspace (`214653b8-0416-447a-bdfd-22e00785bedd`) so old jobs become visible under the same default workspace semantics.

Validated with a production build.
<!-- SECTION:FINAL_SUMMARY:END -->
