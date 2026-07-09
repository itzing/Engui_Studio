---
id: engui-362
title: Normalize video sequence resolution model
status: done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make desktop Video Sequence Builder use one sequence-level resolution for all segment generations, with no hidden per-segment resolution overrides.

## Acceptance Criteria

- [x] WAN22 segment generation always sends `width` and `height` from `VideoSequence`.
- [x] `width` and `height` from sequence/default/segment generation options are ignored or stripped before generation.
- [x] Applying a Gallery video as the first segment updates the sequence resolution and aspect ratio from the source video metadata when available.
- [x] Desktop `/video-sequences` exposes sequence-level resolution controls for image-start/manual workflows.
- [x] Regression tests cover Gallery video resolution seeding, ignored generation option overrides, and sequence resolution controls.
- [x] Production build passes and `engui-studio.service` is restarted.

## Result

Video Sequence generation now has a single sequence-level resolution. Segment generation strips `width`, `height`, and `aspectRatio` from generation option JSON and sends only `VideoSequence.width` and `VideoSequence.height`. Gallery video seeding for segment 1 reads local video metadata with FFmpeg and updates the sequence resolution. The desktop builder header exposes manual sequence width and height controls for image-start workflows.
