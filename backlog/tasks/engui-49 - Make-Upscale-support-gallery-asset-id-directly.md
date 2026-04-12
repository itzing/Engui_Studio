---
id: ENGUI-49
title: Make Upscale support gallery asset id directly
status: In Progress
assignee: []
created_date: '2026-04-12 14:31'
updated_date: '2026-04-12 14:31'
labels:
  - engui
  - api
  - gallery
  - upscale
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the Upscale flow so gallery preview items can be upscaled directly from a gallery asset id rather than depending on a source job id.

Requirements:
- `/api/upscale` should accept a gallery asset reference for image upscale.
- The backend should use the gallery asset's original media URL and workspace ownership data to create the upscale job.
- The center image panel should call the gallery-asset path when the preview comes from Gallery.
- Do not rely on `sourceJobId` for gallery upscale.
- Build, verify, and ship with the current Engui deployment flow.
<!-- SECTION:DESCRIPTION:END -->
