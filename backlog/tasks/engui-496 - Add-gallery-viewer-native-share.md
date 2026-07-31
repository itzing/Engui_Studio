# engui-496 - Add gallery viewer native share

## Status

Done

## Context

Gallery fullscreen viewer should expose a Share action for image and video assets. The button belongs next to the viewer Favorite control, not in Gallery Details, gallery lists, or global toolbars.

## Acceptance Criteria

- [x] Gallery fullscreen viewer shows Share next to Favorite for image and video assets only.
- [x] Desktop and mobile Gallery Details do not show Share.
- [x] Share attempts native file sharing for the original image/video media.
- [x] If file sharing is unsupported or unavailable, the action falls back to native URL share, then clipboard copy.
- [x] Audio assets do not show Share.
- [x] Focused tests cover file share and fallback behavior.
- [x] Production build, service restart, smoke checks, commit, and push complete.

## Result

Gallery fullscreen viewer now shows a Share button only for image and video assets, placed alongside the viewer controls near Favorite. Desktop and mobile Gallery Details do not show Share. The shared client helper tries native file sharing first, falls back to native URL sharing, and finally copies the asset URL to the clipboard when needed. Focused helper and component tests cover file share, URL fallback, clipboard fallback, viewer placement, details exclusion, and audio exclusion.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
