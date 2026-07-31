# engui-496 - Add gallery viewer native share

## Status

Done

## Context

Gallery asset details should expose a viewer-level Share action for image and video assets. The button belongs next to the viewing/favorite controls, not in gallery lists or global toolbars.

## Acceptance Criteria

- [x] Desktop Gallery Asset dialog shows Share next to Favorite for image and video assets only.
- [x] Mobile Gallery Details shows Share next to Favorite for image and video assets only.
- [x] Share attempts native file sharing for the original image/video media.
- [x] If file sharing is unsupported or unavailable, the action falls back to native URL share, then clipboard copy.
- [x] Audio assets do not show Share.
- [x] Focused tests cover file share and fallback behavior.
- [x] Production build, service restart, smoke checks, commit, and push complete.

## Result

Desktop Gallery Asset dialog and Mobile Gallery Details now show a Share button only for image and video assets, placed alongside the viewer action controls near Favorite. The shared client helper tries native file sharing first, falls back to native URL sharing, and finally copies the asset URL to the clipboard when needed. Focused helper and component tests cover file share, URL fallback, clipboard fallback, and audio exclusion.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
