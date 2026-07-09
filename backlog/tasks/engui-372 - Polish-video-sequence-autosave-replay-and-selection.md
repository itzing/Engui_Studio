---
id: engui-372
title: Polish video sequence autosave, replay, and selection
status: Done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make the desktop Video Sequence Builder preserve edits and playback context more reliably.

## Acceptance Criteria

- [x] Selected segment edits autosave after changes.
- [x] Switching segments or sequences persists the current segment draft first.
- [x] Stitched preview replay from the end starts from the first completed segment consistently.
- [x] Last selected sequence and segment are restored after page reload.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Rollback

Revert the implementation commit, rebuild the app, and restart `engui-studio.service`.

## Result

The desktop Video Sequence Builder now debounces segment draft autosave, flushes pending changes before switching segment/sequence, restarts ended preview playback from the first completed timeline item, and stores/restores the last selected sequence and segment per workspace in localStorage.
