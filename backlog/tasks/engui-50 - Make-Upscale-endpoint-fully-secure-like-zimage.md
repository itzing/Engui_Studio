---
id: ENGUI-50
title: Make Upscale endpoint fully secure like z-image
status: In Progress
assignee: []
created_date: '2026-04-12 14:49'
updated_date: '2026-04-12 14:49'
labels:
  - engui
  - security
  - upscale
  - runpod
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor the Upscale pipeline so it becomes fully secure like the z-image flow.

Requirements:
- Reuse the secure encrypted-input pattern used for z-image wherever applicable.
- Stop relying on unsafe duplicate plain uploads for upscale input.
- Upload only to the location actually consumed by the active endpoint, or eliminate intermediate uploads if the secure contract makes them unnecessary.
- Support both job-based and gallery-asset-based upscale requests.
- Preserve existing result decryption support for encrypted upscale outputs.
- Build, verify, and ship with the current Engui deployment flow.
<!-- SECTION:DESCRIPTION:END -->
