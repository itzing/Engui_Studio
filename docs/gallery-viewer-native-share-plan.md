# Gallery Viewer Native Share Plan

## Goal

Add a viewer-level Share action for Gallery image and video assets in the fullscreen Gallery Viewer.

## Approach

- Add a shared client helper that downloads the asset `originalUrl` as a `Blob`, wraps it as a `File`, and calls `navigator.share({ files })` when supported.
- Fall back to `navigator.share({ url })` if file share is not supported or file preparation fails.
- Fall back to copying the URL to the clipboard when Web Share URL sharing is unavailable.
- Show the button only for image and video assets, placed next to the existing Favorite control in `GalleryFullscreenViewer`.
- Do not show Share in desktop or mobile Gallery Details.

## Validation

- Focused unit tests for the helper.
- Focused component tests for viewer visibility and details exclusion.
- Targeted lint, Prisma validate, production build, service restart, and HTTP smoke checks.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
