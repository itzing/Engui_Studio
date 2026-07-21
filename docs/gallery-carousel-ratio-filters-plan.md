# Gallery carousel ratio filters

## Goal

Add explicit `Landscape` and `Portrait` filters to Gallery Carousel so the feed uses only gallery assets whose orientation is selected.

## Product Behavior

- Desktop carousel controls show `Landscape` and `Portrait` checkboxes near `Images`.
- Mobile `/m/carousel` settings show the same checkboxes before `Start`.
- Both checkboxes default to enabled.
- Videos are filtered by their stored media dimensions/aspect ratio, falling back to the carousel's default video ratio when metadata is missing.
- Image slots use only image assets matching the selected orientations.
- If both are unchecked, the carousel shows an empty feed state.

## Implementation

1. Add shared orientation helpers in `src/lib/galleryVideoCarousel.ts`.
2. Add shared `GalleryVideoCarousel` props/state for initial orientation filters.
3. Filter loaded video/image assets before feed construction.
4. Add desktop and mobile checkbox controls.
5. Cover helper, desktop component, and mobile settings behavior with focused tests.
