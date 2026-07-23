# Mobile Gallery Carousel Portrait Landscape Plan

## Objective

Support a mobile-only playback mode where selecting only `Landscape` on `/m/carousel` starts the carousel in portrait device orientation and moves the tape from bottom to top.

## Behavior

- If `Landscape` is enabled and `Portrait` is disabled, portrait device orientation renders the player instead of the rotate-phone gate.
- In that mode the carousel slots use full viewport width, keep their landscape aspect ratio, and travel upward.
- Existing landscape device orientation keeps the horizontal carousel.
- Existing mixed/portrait-enabled filters keep the current rotate-phone gate in portrait orientation.
- Tap pause/resume and swipe close remain available on the mobile overlay.

## Implementation

- Add a movement axis prop to `GalleryVideoCarousel`.
- Generalize slot placement, spawning, trimming, pointer scrubbing, and frame movement to operate on the active axis.
- Pass the vertical axis only from mobile `/m/carousel` when the device is portrait and only the `Landscape` ratio filter is selected.

## Validation

- Add focused tests for the mobile portrait landscape-only pass-through.
- Add component coverage that vertical mode emits `translate3d(..., negativeY, 0)` movement and keeps horizontal mode unchanged.
