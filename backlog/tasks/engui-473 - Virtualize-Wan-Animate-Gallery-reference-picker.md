---
id: engui-473
title: Virtualize Wan Animate Gallery reference picker
status: done
labels: [create, video, wan-animate, gallery, desktop, mobile, performance]
---

## Goal

Allow the Create Video Wan Animate Gallery reference picker to scroll through large image galleries normally instead of only exposing the initially loaded page.

## Acceptance Criteria

- [x] The picker uses the Gallery API pagination contract instead of a single fixed first-page fetch.
- [x] The picker virtualizes image rows so large galleries do not render every tile at once.
- [x] Scrolling near unloaded rows fetches the required Gallery pages and fills placeholders.
- [x] Search resets the virtualized list and loads matching images from the first page.
- [x] Selecting an image still loads it into the existing reference image upload state.

## Result

Implemented in this task. The Wan Animate Gallery reference picker now keeps a virtualized row list, requests `/api/gallery/assets` pages as the visible row range moves, renders unloaded cells as placeholders, and preserves the existing Gallery-image-to-reference-file selection path.

## Rollback

Revert the Engui implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/` plus `/m/create`.
