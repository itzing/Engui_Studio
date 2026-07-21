# ENGUI-406 - Tighten Gallery carousel video spacing

status: done
labels: [gallery, desktop, video, viewer, bugfix]

## Goal

Remove the large black horizontal gaps between desktop Gallery Carousel videos so mixed-aspect video cards travel as a contiguous edge-to-edge chain.

## Scope

- Keep the carousel desktop-only.
- Keep the existing no-repeat shuffled feed, muted autoplay, click pause/resume, speed slider, and end-of-feed behavior.
- Replace fixed scene-width spawn spacing with adjacency-based slot placement.
- Use a tiny edge overlap to avoid visible subpixel seams between consecutive cards.
- Add focused helper coverage for the slot spacing contract.

## Validation

- Focused Vitest for gallery carousel helper/component coverage.
- Targeted lint/type sanity for touched files where practical.
- Production build, service restart, and route smoke checks.
