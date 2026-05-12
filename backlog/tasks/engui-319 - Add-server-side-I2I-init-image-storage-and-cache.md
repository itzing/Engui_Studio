---
id: ENGUI-319
title: Add server-side I2I init image storage and cache
status: Done
assignee: []
created_date: '2026-05-12 19:32'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the server-side image lifecycle needed for Z-Image I2I in desktop Create Image. Paste/file/URL inputs should create a server-side init image record/artifact with preview metadata. On Generate, prepare or reuse a cached PNG job-copy by `(initImageId + longSide)`, preserving aspect ratio, compositing alpha onto white, and using a 24 hour TTL for temporary originals and prepared copies.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Server/API layer for I2I init image intake.
- URL fetch path that normalizes remote URLs into local init image artifacts.
- Prepared PNG job-copy generation.
- Server-side cache keyed by `initImageId + longSide`.
- TTL cleanup for temporary I2I images.

## Acceptance Criteria

- Paste/file/URL input can create an `initImageId`, `previewUrl`, `originalWidth`, and `originalHeight`.
- Original init image is never modified by job preparation.
- Prepared job copy is PNG, has the selected long side, preserves aspect ratio, and composites alpha onto white.
- Same `initImageId + longSide` reuses the cached job copy.
- Different long side creates a distinct prepared copy.
- Temporary originals and prepared copies are eligible for cleanup after 24 hours.
- The implementation does not send raw large base64 images directly in RunPod job payloads.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Implemented in the current Z-Image I2I change set. Verified with endpoint Python compile/workflow structural check, Engui targeted lint, production build, and Engui service restart.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
