# ENGUI-409 - Add optional Gallery carousel image slots

status: done
labels: [gallery, desktop, video, image, viewer]

## Goal

Add an optional Images checkbox to the desktop Gallery Carousel. When enabled, the carousel inserts image slots after every two video slots.

## Scope

- Keep the feature desktop-only.
- Add an `Images` checkbox to the fullscreen carousel header.
- Keep Images off by default whenever the carousel opens.
- Load gallery images through the existing Gallery assets API.
- When Images is enabled, rebuild the carousel feed from scratch.
- When Images is disabled, rebuild the carousel feed from scratch with videos only.
- Insert one image slot after every two video slots.
- Preselect five images for each image slot when possible.
- Select each image slot's five images ahead of time with similar dimensions/aspect ratios so the slot keeps stable sizing.
- Cycle image slots to a new image every second while the slot remains visible.
- Preserve video behavior: no-repeat shuffled videos, edge-to-edge spacing, full-height scaling, muted autoplay, click pause/resume, speed slider, Shuffle, Refresh, and fullscreen close.

## Validation

- Focused helper tests for mixed video/image feed construction and image slot grouping.
- Focused component tests for loading image assets, toggling Images, and rebuilding the feed.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the Gallery carousel opens with video-only playback.

## Result

Implemented for the desktop fullscreen Gallery Carousel. The carousel header now has a default-off `Images` checkbox. Enabling it reloads gallery videos plus images and rebuilds the feed with one image slot after every two video slots. Each image slot preselects up to five images by similar dimensions/aspect ratio, uses a stable slot ratio, and advances to the next image every second while playback is running. Disabling Images reloads and rebuilds the carousel as video-only.
