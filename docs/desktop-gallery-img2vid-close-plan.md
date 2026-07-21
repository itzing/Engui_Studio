# Desktop Gallery img2vid close plan

## Goal

When a desktop user opens an image from Gallery details with `To img2vid`, the Gallery overlay should close so the user lands back on the Create workspace with the reused image ready for video generation.

## Product Behavior

- `Open in img2vid` from desktop Gallery details persists the Create reuse draft as before.
- After successful reuse, the Gallery details dialog closes and the desktop Gallery overlay closes.
- `txt2img`, `img2img`, `scene-template-v2`, upscale, tags, favorite, and trash actions keep their existing behavior.
- Mobile Gallery details are unchanged.

## Implementation

1. Add an optional successful-reuse callback to `GalleryAssetDialog`.
2. Call the callback only after the reuse payload is persisted and the success toast is emitted.
3. In `DesktopGalleryOverlay`, close the overlay when the completed reuse action is `img2vid`.
4. Add focused component coverage for `img2vid` close and non-`img2vid` no-close behavior.
