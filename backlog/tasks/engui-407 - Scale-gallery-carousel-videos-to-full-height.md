# ENGUI-407 - Scale Gallery carousel videos to full height

status: done
labels: [gallery, desktop, video, viewer, polish]

## Goal

Make desktop Gallery Carousel videos fill the full scene height while preserving each video's aspect ratio.

## Scope

- Keep the carousel desktop-only.
- Keep the no-repeat feed, edge-to-edge spacing, muted autoplay, click pause/resume, speed slider, and end-of-feed behavior.
- Set carousel card height to the full 16:9 scene height.
- Derive card width from `height * aspectRatio` without enforcing a minimum width that could distort proportions.
- Add focused helper coverage for the full-height sizing contract.

## Validation

- Focused Vitest for gallery carousel helper/component coverage.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.
