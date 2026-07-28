---
id: engui-472
title: Add Gallery reference picker to Wan Animate Create
status: done
labels: [create, video, wan-animate, gallery, desktop, mobile]
---

## Goal

Allow Create Video users to choose the Wan Animate reference image from existing Gallery image assets, without removing the current upload and drag/drop paths.

## Acceptance Criteria

- [x] The Wan Animate reference image input exposes a Gallery picker on desktop and mobile Create surfaces.
- [x] The picker lists Gallery image assets from the active workspace with search and newest-first ordering.
- [x] Selecting an image loads it into the existing reference image state so generation submits the same file field used by upload/drop.
- [x] Existing upload, drag/drop, fullscreen preview, and remove behavior still work.
- [x] Focused component tests cover selecting a Gallery reference image and preserving upload behavior.

## Result

Implemented in this task. Wan Animate Create now has a Gallery reference image picker that fetches active-workspace image assets, lets users search and select one, and loads the selected asset into the same reference image state used by upload/drop.

## Rollback

Revert the Engui commit, run `npm run build`, restart `engui-studio.service`, and verify `/` plus `/m/create`.
