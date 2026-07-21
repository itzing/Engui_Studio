# ENGUI-423 - Close desktop gallery after img2vid reuse

status: done
labels: [desktop, gallery, reuse, img2vid]

## Goal

Close the desktop Gallery overlay after a user opens an image gallery asset with `To img2vid`.

## Scope

- Desktop Gallery overlay details flow.
- Successful gallery asset reuse into the Create video workflow.
- Preserve existing mobile Gallery behavior.
- Preserve non-`img2vid` desktop reuse behavior.

## Validation

- Focused component regression tests for desktop Gallery close behavior.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify desktop Gallery returns to the previous behavior.

## Result

Implemented for the desktop Gallery overlay. `GalleryAssetDialog` now emits an optional successful-reuse callback, and `DesktopGalleryOverlay` closes the Gallery overlay when that successful action is `img2vid`. Non-`img2vid` reuse paths and mobile Gallery details are unchanged.
