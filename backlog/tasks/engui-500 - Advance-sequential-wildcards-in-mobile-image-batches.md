---
id: ENGUI-500
title: Advance sequential wildcards in mobile image batches
status: Done
assignee: []
created_date: '2026-08-14 07:46'
labels:
  - mobile
  - create
  - wildcards
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mobile image batch generation submits each image sequentially, but each request uses the same initial prompt wildcard selection snapshot. Sequential wildcard cursors returned by `/api/generate` after the first request are not used for the next request in the same batch, so 3x/6x mobile batches can resolve to the same prompt even with unique seeds.

Keep a local prompt wildcard selection cursor inside the batch loop and pass the latest returned selections into the next submit call. Add regression coverage for sequential wildcard advancement across a mobile batch.
<!-- SECTION:DESCRIPTION:END -->
