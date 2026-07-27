# Gallery Carousel Gallery View Plan

## Goal

Add a `Gallery View` checkbox to Carousel settings across desktop, phone, and iPad. The setting switches Carousel from the default shuffle feed to a gallery-order feed anchored to the current Gallery selection.

## Behavior

- `Gallery View` off: keep the current shuffle behavior.
- `Gallery View` on: fetch gallery assets in Gallery order, anchor playback to the current or last selected Gallery asset when available, and fall back to the first matching asset otherwise.
- Existing Carousel filters remain active on top of the selected feed mode: Videos, Images, Landscape, Portrait, Only favorites, Speed, and Scrub.
- Images in `Gallery View` become single-image slots in gallery order.
- Images in shuffle mode keep the existing grouped image-slot behavior.

## Surfaces

- Desktop Gallery Carousel receives the currently selected Gallery asset from the desktop Gallery overlay.
- Phone and iPad `/m/carousel` read the last selected Gallery asset from the existing per-workspace Gallery selection storage.
- Mobile and iPad Gallery no longer need dedicated Carousel buttons.

## Validation

- Focused unit tests for shared Carousel and mobile Carousel settings.
- Targeted ESLint.
- Production build.
- Service restart and smoke checks for `/`, `/m/gallery`, `/m/carousel`, and `/api/jobs`.
