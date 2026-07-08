---
id: engui-346
title: Keep desktop gallery open when closing viewer with Escape
status: Done
assignee: Rocky
created: 2026-07-08
---

## Summary

Fix desktop Gallery keyboard handling so Escape closes the open fullscreen image/video viewer first without also closing the Gallery overlay.

## Acceptance Criteria

- [x] With desktop Gallery open and a viewer item open, Escape closes only the viewer.
- [x] With desktop Gallery open and no viewer item open, Escape still closes the Gallery overlay.
- [x] Focused validation and production build pass.

## Notes

- Scope is desktop Gallery overlay keyboard behavior.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
