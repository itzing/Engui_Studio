# ENGUi-385 - Fix mobile gallery video fullscreen landscape

## Status

Done

## Context

Mobile Gallery fullscreen video previews fill the screen in portrait, but in landscape they render small in the center. The viewer currently reserves large vertical padding and caps video height on mobile, which leaves too little media space in landscape.

## Scope

- Mobile Gallery fullscreen viewer video slides.
- Keep image zoom/swipe behavior unchanged.
- Keep desktop Gallery viewer behavior unchanged.

## Acceptance Criteria

- [x] Gallery videos use the full available viewport in mobile portrait and landscape.
- [x] Landscape video previews are constrained by `object-contain`, not by fixed vertical padding.
- [x] Viewer controls still overlay above the media and close/favorite actions remain accessible.
- [x] Production build passes.

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`.
