---
id: engui-146
title: Rework mobile gallery grid selection and infinite scroll
status: in_progress
priority: high
labels: [mobile, gallery, pwa, virtuoso]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Rework the route-based mobile gallery so it behaves like a dense touch-first media browser instead of a card list.

## Desired outcome

Mobile gallery uses a dense 3-column virtualized grid with infinite scroll, remembers the current asset selection, and opens fullscreen viewer on second tap of the selected tile.

## Acceptance criteria

- [x] Mobile gallery loads additional pages while scrolling down
- [x] Mobile gallery renders as a dense 3-column grid without text metadata in tiles
- [x] Video tiles show only preview thumbnails plus a translucent play indicator
- [x] First tap selects a tile and visibly highlights it without obscuring the preview
- [x] Selected tile shows overlay actions
- [x] Second tap on the selected tile opens fullscreen viewer
- [x] Viewer selection updates the remembered gallery asset so gallery restore returns to that item
- [ ] Fullscreen viewer gesture parity is completed in a follow-up pass

## Progress notes

Current pass reuses `VirtuosoGrid` for mobile gallery virtualization but keeps a mobile-specific renderer and selection model. It also wires selection persistence and viewer-open behavior to the route-based mobile gallery flow without changing desktop gallery composition.
